// -----------------------------------------------------------------------------
// The monitor: which communes and bathing sites are followed, their last
// results, the states published to Gladys and the scene triggers. Everything
// the SDK handlers, the action and the widget need goes through it (src/app.js
// wires it).
//
// Followed communes (tap water): the INSEE codes of the configuration, or else
// the commune of the house (found from its location by geo.api.gouv.fr), plus
// every commune whose device the user created. Followed bathing sites: the
// codes of the configuration, those of the communes followed or around the
// house (`bathing_around`), plus every site whose device the user created.
// Deleting a device stops following what only it followed.
//
// Scheduling: the devices are published with should_poll: false (the core does
// not poll external devices reliably, GladysAssistant/Gladys#3198). A timer
// ticks every hour: it reads again a commune or a site whose last reading is a
// day old (an hour after a failure), and publishes the states. The Ministry of
// Health publishes the tap water results about once a month and the bathing
// results once a week or so in season: one reading a day is plenty, and stays
// polite with services that publish no quota. What only changes once in a
// while (the commune of the house, the communes around it, the sites of a
// commune) is asked again once a week.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat
// every 12 hours, so the dashboard never shows a monthly value as "no recent
// value". A bathing site out of season publishes no quality: there is no
// current result, and the badge then says so.
//
// Logs: at info, only the lifecycle (start, configuration saved, a
// non-compliant sample, a bathing site turning poor or prohibited and back). A
// failure that repeats at every tick is logged once, then at debug until it
// recovers, with one line at recovery. LOG_LEVEL=debug shows every reading.
// The coordinates of the house are never logged.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { MAX_COMMUNES, MAX_SITES, departmentOf } from './config.js';
import { BATHING, TAP, buildBathingDevice, buildTapDevice, idsOf, parseId } from './devices.js';
import { Baignades, banOn, departmentOfSite, isOverseas } from './baignades.js';
import { Geo } from './geo.js';
import { HubEau, waterQualityOf } from './hubeau.js';
import {
  BATHING_NAMES,
  BATHING_STATUS,
  CONFORMITY,
  NOT_MEASURED,
  STATUS,
  UNSAFE,
  VALUES,
  formatDay,
  formatIsoDay,
  join,
  render,
} from './messages.js';

const logger = createLogger({ name: 'qualite-eau' });

export const WIDGET_KEY = 'water_quality';
export const TRIGGERS = { TAP: 'tap_water_non_compliant', BATHING: 'bathing_unsafe' };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_TIMINGS = {
  tickMs: HOUR,
  // One reading a day; a few minutes of margin so the hourly tick does not
  // push it to the next hour every day.
  refreshMs: DAY - 5 * MINUTE,
  retryMs: HOUR,
  metadataMaxAgeMs: 7 * DAY,
  // Samples looked at for the conclusions, and for the parameters (the
  // hardness is measured once a year or less in small communes).
  samplesWindowMs: 365 * DAY,
  parametersWindowMs: 2 * 365 * DAY,
  // A non-compliant sample published later than this after it was taken fires
  // no trigger: it is history, not news.
  triggerMaxAgeMs: 90 * DAY,
  // A bathing season whose dates are not published: a sample younger than
  // this is taken as current.
  sampleFreshMs: 30 * DAY,
  heartbeatMs: 12 * HOUR,
  // Between two requests to the same service, to stay polite.
  requestSpacingMs: 250,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
};

/** `YYYY-MM-DD` of a time in the time zone of Gladys (TZ). */
export const localDay = (time) =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(time),
  );

const unique = (items) => [...new Set(items)];
const round = (value) => Math.round(value * 1000) / 1000;

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] fetch, for every service
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {Function} [options.sleep] `(ms) => Promise`
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, sleep, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.hubeau = new HubEau({ fetch: fetchImpl });
    this.baignades = new Baignades({ fetch: fetchImpl });
    this.geo = new Geo({ fetch: fetchImpl });
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.sleep = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    this.configuredCommunes = [];
    this.configuredSites = [];
    this.problems = emptyProblems();
    this.resolved = false;
    this.lastCycleAt = -Infinity;
    this.statusMessage = undefined;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1) {
      this.data = { ...emptyData(), ...saved };
    }
    await this.resolve();
    await this.publishDiscovered();
    await this.updateConnectionStatus();
    logger.info(
      `Started: ${this.communes().length} commune(s) and ${this.sites().length} bathing site(s) followed, read once a day`,
    );
    this.schedule();
    this.runCycle();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    await this.publishDiscovered();
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates();
    this.requestRefresh();
  }

  async reconfigure(config) {
    this.config = config;
    // What depends on the house or on the radius is looked up again.
    this.data.home = null;
    this.data.around = null;
    await this.resolve();
    await this.publishDiscovered();
    await this.updateConnectionStatus();
    logger.info(
      `Configuration saved: ${this.communes().length} commune(s) and ${this.sites().length} bathing site(s) followed`,
    );
    await this.runCycle();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.timings.tickMs);
    this.cycleTimer.unref?.();
  }

  save() {
    return this.store.save(this.data);
  }

  // --- What is followed ----------------------------------------------------------

  /** Codes of the devices of one kind that exist in Gladys. */
  created(kind) {
    return unique(
      (this.gladys.devices ?? [])
        .map((device) => parseId(this.gladys, device.external_id))
        .filter((parsed) => parsed?.kind === kind)
        .map((parsed) => parsed.code),
    );
  }

  isCreated(kind, code) {
    const id = idsOf(this.gladys, kind, code).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  communes() {
    return unique([...this.configuredCommunes, ...this.created(TAP)]);
  }

  sites() {
    return unique([...this.configuredSites, ...this.created(BATHING)]);
  }

  /**
   * The house of the configuration: the one chosen (its selector, as
   * `getHouses()` gives it), or else the first house of Gladys that has a
   * location. Without one, `problem` says why: `noHouse`, `houseUnlocated` or
   * `houseGone`, with the `name` of the house.
   */
  async findHouse() {
    let houses;
    try {
      houses = await this.gladys.getHouses();
      this.recovered('houses', 'The houses of Gladys can be read again');
    } catch (err) {
      this.failed('houses', 'warn', `Cannot read the houses of Gladys: ${err.message}`);
      return { house: null, problem: { key: 'noHouse' } };
    }
    const located = (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude);
    const selector = this.config.houseSelector;
    if (!selector) {
      const house = houses.find(located) ?? null;
      return { house, problem: house ? null : { key: 'noHouse' } };
    }
    const chosen = houses.find((house) => house.selector === selector);
    if (!chosen) {
      return { house: null, problem: { key: 'houseGone', name: selector } };
    }
    if (!located(chosen)) {
      return { house: null, problem: { key: 'houseUnlocated', name: chosen.name } };
    }
    return { house: chosen, problem: null };
  }

  /**
   * The commune of the house, cached a week: `{ commune }` or `{ problem }`.
   * Only the selector of the house is stored with it, never its coordinates.
   */
  async homeCommune() {
    const selector = this.config.houseSelector ?? null;
    const cached = this.data.home;
    if (
      cached &&
      (cached.house ?? null) === selector &&
      this.now() - cached.at < this.timings.metadataMaxAgeMs
    ) {
      return cached.commune ? { commune: cached.commune } : { problem: { key: 'noCommune' } };
    }
    const { house, problem } = await this.findHouse();
    if (!house) {
      return { problem };
    }
    let commune;
    try {
      commune = await this.geo.communeAt(house.latitude, house.longitude);
      this.recovered('geo', 'geo.api.gouv.fr answers again');
    } catch (err) {
      this.failed('geo', 'warn', `geo.api.gouv.fr unreachable: ${err.message}`);
      return cached?.commune ? { commune: cached.commune } : { problem: { key: 'geoDown' } };
    }
    this.data.home = { house: selector, commune, at: this.now() };
    if (commune) {
      this.rememberCommune(commune);
    }
    return commune ? { commune } : { problem: { key: 'noCommune' } };
  }

  rememberCommune(commune) {
    this.data.names[commune.code] = {
      ...this.data.names[commune.code],
      name: commune.name,
      at: this.now(),
    };
  }

  /** The name of a commune, from geo.api.gouv.fr, cached a week; failures keep the code. */
  async lookupName(code) {
    const known = this.data.names[code];
    if (known && this.now() - known.at < this.timings.metadataMaxAgeMs) {
      return;
    }
    try {
      const commune = await this.geo.commune(code);
      this.recovered('geo', 'geo.api.gouv.fr answers again');
      this.data.names[code] = { name: commune?.name ?? known?.name ?? null, at: this.now() };
    } catch (err) {
      this.failed('geo', 'warn', `geo.api.gouv.fr unreachable: ${err.message}`);
    }
  }

  /** The bathing sites of a commune, cached a week. */
  async sitesOfCommune(commune) {
    const cached = this.data.communeSites[commune];
    if (cached && this.now() - cached.at < this.timings.metadataMaxAgeMs) {
      return cached.sites;
    }
    const sites = await this.baignades.sitesOfCommune(commune, departmentOf(commune));
    this.data.communeSites[commune] = { sites, at: this.now() };
    for (const site of sites) {
      this.data.siteNames[site.code] = { name: site.name, commune };
    }
    return sites;
  }

  /** The communes within `km` of the house, cached a week: `{ communes }` or `{ problem }`. */
  async communesAround(km) {
    const selector = this.config.houseSelector ?? null;
    const cached = this.data.around;
    if (
      cached &&
      cached.km === km &&
      (cached.house ?? null) === selector &&
      this.now() - cached.at < this.timings.metadataMaxAgeMs
    ) {
      return { communes: cached.communes };
    }
    const { house, problem } = await this.findHouse();
    if (!house) {
      return { problem };
    }
    let around;
    try {
      around = await this.geo.communesAround(house.latitude, house.longitude, km);
      this.recovered('geo', 'geo.api.gouv.fr answers again');
    } catch (err) {
      this.failed('geo', 'warn', `geo.api.gouv.fr unreachable: ${err.message}`);
      return cached ? { communes: cached.communes } : { problem: { key: 'geoDown' } };
    }
    const communes = around.map(({ code }) => code);
    this.data.around = { house: selector, km, communes, at: this.now() };
    return { communes };
  }

  /**
   * Resolve the configuration into communes and bathing sites. A failure keeps
   * what was found before and is tried again at the next tick.
   */
  async resolve() {
    const problems = emptyProblems();
    const config = this.config;
    let communes = config.communeCodes;
    if (communes.length === 0) {
      const home = await this.homeCommune();
      if (home.problem) {
        problems.house = home.problem;
      }
      communes = home.commune ? [home.commune.code] : [];
    }
    if (communes.length > MAX_COMMUNES) {
      problems.tooMany = MAX_COMMUNES;
      communes = communes.slice(0, MAX_COMMUNES);
    }
    for (const code of communes) {
      await this.lookupName(code);
    }

    let sites = [...config.siteCodes];
    let complete = true;
    let siteCommunes = [];
    if (config.bathingAround === 'commune') {
      siteCommunes = communes;
    } else if (typeof config.bathingAround === 'number') {
      const around = await this.communesAround(config.bathingAround);
      if (around.problem) {
        problems.house ??= around.problem;
      }
      siteCommunes = around.communes ?? [];
    }
    try {
      for (const [index, commune] of siteCommunes.entries()) {
        if (index > 0 && !this.data.communeSites[commune]) {
          await this.sleep(this.timings.requestSpacingMs);
        }
        sites.push(...(await this.sitesOfCommune(commune)).map((site) => site.code));
      }
      this.recovered('sites', 'baignades.sante.gouv.fr answers again: bathing sites found');
    } catch (err) {
      complete = false;
      this.failed('sites', 'warn', `Cannot list the bathing sites yet: ${err.message}`);
    }
    sites = unique(sites);
    if (sites.length > MAX_SITES) {
      problems.tooMany = Math.min(problems.tooMany ?? MAX_SITES, MAX_SITES);
      sites = sites.slice(0, MAX_SITES);
    }
    this.configuredCommunes = communes;
    // A failed listing keeps the sites found before it.
    this.configuredSites = complete ? sites : unique([...this.configuredSites, ...sites]);
    this.problems = problems;
    this.resolved = true;
    await this.save();
  }

  // --- Discovery and connection status -----------------------------------------

  communeOf(code) {
    const entry = this.data.communes[code];
    return {
      code,
      name: this.data.names[code]?.name ?? entry?.name ?? code,
      distributor: entry?.distributor ?? null,
      networks: entry?.networks ?? [],
    };
  }

  siteOf(code) {
    const known = this.data.siteNames[code];
    return {
      code,
      name: known?.name ?? this.data.sites[code]?.name ?? code,
      commune: known?.commune ?? null,
    };
  }

  discoveredDevices() {
    const language = this.config.language;
    return [
      ...this.communes().map((code) => buildTapDevice(this.gladys, this.communeOf(code), language)),
      ...this.sites().map((code) => buildBathingDevice(this.gladys, this.siteOf(code), language)),
    ];
  }

  async publishDiscovered() {
    await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
  }

  async updateConnectionStatus() {
    const { house, tooMany } = this.problems;
    const parts = [];
    if (this.failing.has('hubeau')) {
      parts.push(render(STATUS, 'hubeauDown'));
    }
    if (this.failing.has('baignades') || this.failing.has('sites')) {
      parts.push(render(STATUS, 'baignadesDown'));
    }
    if (house) {
      parts.push(render(STATUS, house.key, { name: house.name }));
    }
    const empty = this.communes().filter((code) => this.data.communes[code]?.empty);
    if (empty.length > 0) {
      parts.push(render(STATUS, 'unknownCommune', { codes: empty.join(', ') }));
    }
    if (this.config.invalid.length > 0) {
      parts.push(render(STATUS, 'invalid', { values: this.config.invalid.join(', ') }));
    }
    const unknownSites = this.sites().filter((code) => this.data.sites[code]?.unknown);
    if (unknownSites.length > 0) {
      parts.push(render(STATUS, 'unknownSite', { codes: unknownSites.join(', ') }));
    }
    if (tooMany) {
      parts.push(render(STATUS, 'tooMany', { max: tooMany }));
    }
    if (this.communes().length === 0 && this.sites().length === 0 && !house) {
      parts.push(render(STATUS, 'none'));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = !this.failing.has('hubeau') && !this.failing.has('baignades');
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  async onDeviceCreated(device) {
    const parsed = parseId(this.gladys, device.external_id);
    if (!parsed) {
      return;
    }
    const known = parsed.kind === TAP ? this.data.communes : this.data.sites;
    if (!known[parsed.code]?.fetchedAt) {
      await this.runCycle();
    }
    // The SDK forgot the states of the device: everything is published again.
    await this.publishStates();
    this.requestRefresh();
  }

  async onDeviceUpdated(device) {
    await this.onDeviceCreated(device);
  }

  async onDeviceDeleted() {
    // What only that device followed is no longer followed.
    await this.publishDiscovered();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    if (!parseId(this.gladys, device.external_id)) {
      return;
    }
    // The tick reads what is due; between two ticks, the states are enough.
    if (this.now() - this.lastCycleAt >= this.timings.tickMs / 2) {
      await this.runCycle();
    } else {
      await this.publishStates();
    }
  }

  // --- Cycles ------------------------------------------------------------------

  runCycle() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle()
      .then(() => this.recovered('cycle', 'Refresh cycles work again'))
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  /** Whether an entry is due for a reading: a day after the last one, an hour after a failure. */
  due(entry) {
    if (!entry?.fetchedAt && !entry?.failedAt) {
      return true;
    }
    const now = this.now();
    if (entry.failedAt && (!entry.fetchedAt || entry.failedAt > entry.fetchedAt)) {
      return now - entry.failedAt >= this.timings.retryMs;
    }
    return now - entry.fetchedAt >= this.timings.refreshMs;
  }

  async cycle() {
    this.lastCycleAt = this.now();
    const before = this.discoveredKey();
    await this.resolve();
    let changed = false;
    let read = 0;
    for (const code of this.communes()) {
      if (this.due(this.data.communes[code])) {
        changed = (await this.refreshCommune(code)) || changed;
        read += 1;
      }
    }
    for (const code of this.sites()) {
      if (this.due(this.data.sites[code])) {
        if (read > 0) {
          await this.sleep(this.timings.requestSpacingMs);
        }
        changed = (await this.refreshSite(code)) || changed;
        read += 1;
      }
    }
    if (this.discoveredKey() !== before) {
      await this.publishDiscovered();
    }
    await this.publishStates();
    await this.updateConnectionStatus();
    await this.save();
    logger.debug(`Refresh cycle: ${read} reading(s)`);
    if (changed) {
      this.requestRefresh();
    }
  }

  discoveredKey() {
    return JSON.stringify(this.discoveredDevices());
  }

  /** Read the tap water of a commune; resolves true when what is shown changed. */
  async refreshCommune(code) {
    const previous = this.data.communes[code] ?? null;
    const now = this.now();
    let samples;
    let parameters;
    try {
      samples = await this.hubeau.samples(code, now - this.timings.samplesWindowMs);
      parameters = await this.hubeau.parameters(code, now - this.timings.parametersWindowMs);
      this.recovered('hubeau', "Hub'Eau answers again");
    } catch (err) {
      this.data.communes[code] = { ...previous, failedAt: now };
      this.failed('hubeau', 'warn', `Hub'Eau unreachable: ${err.message}`);
      return false;
    }
    const quality = waterQualityOf(samples);
    const latest = quality.latest;
    const entry = {
      fetchedAt: now,
      failedAt: null,
      empty: samples.length === 0,
      name: latest?.communeName ?? previous?.name ?? null,
      distributor: latest?.distributor ?? previous?.distributor ?? null,
      networks: latest?.networks ?? previous?.networks ?? [],
      latest: latest && {
        code: latest.code,
        at: latest.at,
        conclusion: latest.conclusion,
        bacteriological: latest.bacteriological,
        physicoChemical: latest.physicoChemical,
      },
      bacteriological: quality.bacteriological,
      physicoChemical: quality.physicoChemical,
      parameters,
    };
    this.data.communes[code] = entry;
    const name = this.communeOf(code).name;
    logger.debug(
      `${name}: ${samples.length} sample(s) in a year, latest ${latest ? localDay(latest.at) : 'none'}`,
    );
    if (previous?.latest && latest && latest.code !== previous.latest.code) {
      await this.newSamples(
        code,
        samples.filter((sample) => sample.at > previous.latest.at),
      );
    }
    const view = (item) =>
      JSON.stringify([
        item?.latest,
        item?.bacteriological,
        item?.physicoChemical,
        item?.parameters,
        item?.empty,
      ]);
    return view(previous) !== view(entry);
  }

  /** Samples published since the last reading: one line and one trigger for a non-compliant one. */
  async newSamples(code, samples) {
    const nonCompliant = samples.find(
      (sample) => sample.bacteriological === 'N' || sample.physicoChemical === 'N',
    );
    if (!nonCompliant) {
      return;
    }
    const name = this.communeOf(code).name;
    logger.info(`${name}: non-compliant tap water sample of ${localDay(nonCompliant.at)}`);
    if (this.now() - nonCompliant.at > this.timings.triggerMaxAgeMs || !this.isCreated(TAP, code)) {
      return;
    }
    const keyOf = (value) => CONFORMITY[value]?.key ?? NOT_MEASURED;
    const language = this.config.language;
    await this.gladys
      .publishSceneEvent(TRIGGERS.TAP, {
        commune: idsOf(this.gladys, TAP, code).device,
        commune_name: name,
        sample_date: formatDay(nonCompliant.at, language),
        conclusion: nonCompliant.conclusion ?? VALUES[language].noConclusion,
        bacteriological: keyOf(nonCompliant.bacteriological),
        physico_chemical: keyOf(nonCompliant.physicoChemical),
      })
      .catch((err) => logger.warn(`${TRIGGERS.TAP} event refused: ${err.message}`));
  }

  /** Read the page of a bathing site; resolves true when what is shown changed. */
  async refreshSite(code) {
    const previous = this.data.sites[code] ?? null;
    const now = this.now();
    const year = Number(localDay(now).slice(0, 4));
    let page;
    try {
      page = await this.baignades.site(code, year);
      this.recovered('baignades', 'baignades.sante.gouv.fr answers again');
    } catch (err) {
      this.data.sites[code] = { ...previous, failedAt: now };
      this.failed('baignades', 'warn', `baignades.sante.gouv.fr unreachable: ${err.message}`);
      return false;
    }
    const unknown =
      !page.name && !page.seasonStart && page.samples.length === 0 && page.bans.length === 0;
    this.data.sites[code] = {
      fetchedAt: now,
      failedAt: null,
      year,
      unknown,
      name: page.name ?? previous?.name ?? null,
      page,
    };
    const status = this.statusOf(code);
    const before = this.data.statuses[code];
    this.data.statuses[code] = status;
    const name = this.siteOf(code).name;
    logger.debug(`${name}: ${status}, ${page.samples.length} sample(s) this season`);
    if (before !== undefined && before !== status) {
      await this.statusChanged(code, before, status);
    }
    return JSON.stringify(previous?.page) !== JSON.stringify(page);
  }

  async statusChanged(code, before, status) {
    const name = this.siteOf(code).name;
    const unsafe = UNSAFE.includes(status);
    if (unsafe || UNSAFE.includes(before)) {
      logger.info(`${name}: bathing ${before} -> ${status}`);
    }
    const worse = unsafe && UNSAFE.indexOf(status) > UNSAFE.indexOf(before);
    if (!worse || !this.isCreated(BATHING, code)) {
      return;
    }
    const language = this.config.language;
    const last = this.lastSample(code);
    await this.gladys
      .publishSceneEvent(TRIGGERS.BATHING, {
        site: idsOf(this.gladys, BATHING, code).device,
        site_name: name,
        status,
        status_name: BATHING_NAMES[language][status],
        sample_date: last ? formatIsoDay(last.date, language, { year: true }) : '',
      })
      .catch((err) => logger.warn(`${TRIGGERS.BATHING} event refused: ${err.message}`));
  }

  /**
   * The last sample of a site that has a result; a newer one still waiting
   * for its analysis ("Non renseigné") does not hide it.
   */
  lastSample(code) {
    const samples = this.data.sites[code]?.page?.samples ?? [];
    return samples.findLast((sample) => sample.result !== null) ?? samples.at(-1) ?? null;
  }

  /**
   * The season of a site today: `{ open, start, end, allYear }`. Overseas,
   * bathing is all year round. Without published dates, a recent sample
   * means the season is open.
   */
  seasonOf(code) {
    const page = this.data.sites[code]?.page;
    if (isOverseas(departmentOfSite(code))) {
      return { open: true, start: null, end: null, allYear: true };
    }
    const start = page?.seasonStart ?? null;
    const end = page?.seasonEnd ?? null;
    if (start && end) {
      const today = localDay(this.now());
      return { open: start <= today && today <= end, start, end, allYear: false };
    }
    const last = this.lastSample(code);
    const recent =
      last !== null &&
      this.now() - Date.parse(`${last.date}T12:00:00Z`) <= this.timings.sampleFreshMs;
    return { open: recent, start, end, allYear: false };
  }

  /** good, average, poor, prohibited, off_season, no_sample or unknown. */
  statusOf(code) {
    const page = this.data.sites[code]?.page;
    if (!page) {
      return 'unknown';
    }
    if (banOn(page.bans, localDay(this.now()))) {
      return 'prohibited';
    }
    if (!this.seasonOf(code).open) {
      return 'off_season';
    }
    const last = this.lastSample(code);
    if (!last) {
      return 'no_sample';
    }
    return last.result ?? 'unknown';
  }

  // --- States ------------------------------------------------------------------

  tapStates(code) {
    const entry = this.data.communes[code];
    if (!entry?.fetchedAt) {
      return [];
    }
    const ids = idsOf(this.gladys, TAP, code);
    const texts = VALUES[this.config.language];
    if (entry.empty || !entry.latest) {
      return [{ device_feature_external_id: ids.conclusion, text: texts.noSample }];
    }
    const states = [];
    for (const key of ['bacteriological', 'physicoChemical']) {
      const level = CONFORMITY[entry[key]?.value];
      if (level) {
        const feature = key === 'bacteriological' ? ids.bacteriological : ids.physico_chemical;
        states.push({ device_feature_external_id: feature, state: level.gladys });
      }
    }
    states.push(
      {
        device_feature_external_id: ids.conclusion,
        text: entry.latest.conclusion ?? texts.noConclusion,
      },
      {
        device_feature_external_id: ids.sample_date,
        text: formatDay(entry.latest.at, this.config.language),
      },
    );
    for (const key of ['nitrates', 'hardness', 'chlorine', 'ph']) {
      const parameter = entry.parameters?.[key];
      if (parameter) {
        states.push({ device_feature_external_id: ids[key], state: round(parameter.value) });
      }
    }
    return states;
  }

  bathingStates(code) {
    const entry = this.data.sites[code];
    if (!entry?.fetchedAt) {
      return [];
    }
    const ids = idsOf(this.gladys, BATHING, code);
    const language = this.config.language;
    const status = this.statusOf(code);
    const states = [];
    const level = BATHING_STATUS[status].gladys;
    if (level !== null) {
      states.push({ device_feature_external_id: ids.quality, state: level });
    }
    states.push({ device_feature_external_id: ids.result, text: BATHING_NAMES[language][status] });
    const last = this.lastSample(code);
    if (last) {
      states.push({
        device_feature_external_id: ids.sample_date,
        text: formatIsoDay(last.date, language, { year: true }),
      });
    }
    states.push({ device_feature_external_id: ids.season, text: this.seasonText(code) });
    return states;
  }

  seasonText(code) {
    const language = this.config.language;
    const texts = VALUES[language];
    const season = this.seasonOf(code);
    if (season.allYear) {
      return texts.allYear;
    }
    if (!season.start || !season.end) {
      return texts.seasonUnknown;
    }
    const start = formatIsoDay(season.start, language);
    const end = formatIsoDay(season.end, language);
    return season.open ? texts.seasonOpen({ end }) : texts.seasonClosed({ start, end });
  }

  /** The states of every device created in Gladys. */
  statesOfCreated() {
    return [
      ...this.created(TAP).flatMap((code) => this.tapStates(code)),
      ...this.created(BATHING).flatMap((code) => this.bathingStates(code)),
    ];
  }

  async publishStates() {
    const states = this.statesOfCreated();
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next tick (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }

  /** What the widget shows of a commune's tap water. */
  tapView(code) {
    const entry = this.data.communes[code];
    const keyOf = (item) => CONFORMITY[item?.value]?.key ?? NOT_MEASURED;
    const bacteriological = keyOf(entry?.bacteriological);
    const physicoChemical = keyOf(entry?.physicoChemical);
    const order = ['not_measured', 'compliant', 'derogation', 'non_compliant'];
    const worst =
      order.indexOf(bacteriological) > order.indexOf(physicoChemical)
        ? bacteriological
        : physicoChemical;
    return {
      code,
      name: this.communeOf(code).name,
      read: Boolean(entry?.fetchedAt),
      empty: Boolean(entry?.empty),
      bacteriological,
      physicoChemical,
      overall: worst,
      sampleAt: entry?.latest?.at ?? null,
      conclusion: entry?.latest?.conclusion ?? null,
      parameters: entry?.parameters ?? {},
    };
  }

  /** What the widget shows of a bathing site. */
  bathingView(code) {
    const entry = this.data.sites[code];
    return {
      code,
      name: this.siteOf(code).name,
      read: Boolean(entry?.fetchedAt),
      status: this.statusOf(code),
      lastSample: this.lastSample(code),
      season: entry?.fetchedAt ? this.seasonText(code) : null,
    };
  }

  /** The time of the newest reading shown, for the attribution. */
  updatedAt(communes, sites) {
    const times = [
      ...communes.map((code) => this.data.communes[code]?.fetchedAt),
      ...sites.map((code) => this.data.sites[code]?.fetchedAt),
    ].filter((time) => typeof time === 'number');
    return times.length > 0 ? Math.max(...times) : null;
  }
}

function emptyProblems() {
  return { house: null, tooMany: null };
}

function emptyData() {
  return {
    version: 1,
    home: null,
    around: null,
    names: {},
    communeSites: {},
    siteNames: {},
    communes: {},
    sites: {},
    statuses: {},
  };
}
