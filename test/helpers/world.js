// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, fake Hub'Eau, geo.api.gouv.fr
// and baignades.sante.gouv.fr serving answers built on the recorded ones of
// test/fixtures (filtered the way the real APIs filter), a manual clock, a
// temporary /data, and the integration wired on top through registerHandlers.
// Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
export const fixtureText = (name) =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

// The clock starts on 20/08/2026, in the bathing season.
export const START = Date.parse('2026-08-20T08:00:00Z');
export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// A house in the centre of Orléans (public coordinates of the town hall area).
export const HOUSE = {
  id: 'house-1',
  name: 'Maison',
  selector: 'maison',
  latitude: 47.9029,
  longitude: 1.9093,
};

export const ORLEANS = '45234';
export const OLIVET = '45232';
export const SAINT_JEAN_DE_BRAYE = '45284';
// A commune far from the house (Blois), for the radius.
export const BLOIS = '41018';

// Bathing sites: two (invented) around Orléans, and the page recorded by hand
// for a site of the Gard (see test/fixtures/README.md).
export const LAKE = '045000101';
export const RIVER = '045000102';
export const MOULINET = '030002007';

/** The communes geo.api.gouv.fr knows here: centre `[lon, lat]`, approximate. */
export const COMMUNES = [
  { code: ORLEANS, nom: 'Orléans', codeDepartement: '45', centre: [1.9161, 47.8828] },
  { code: OLIVET, nom: 'Olivet', codeDepartement: '45', centre: [1.9003, 47.8634] },
  {
    code: SAINT_JEAN_DE_BRAYE,
    nom: 'Saint-Jean-de-Braye',
    codeDepartement: '45',
    centre: [1.9758, 47.9128],
  },
  { code: BLOIS, nom: 'Blois', codeDepartement: '41', centre: [1.3359, 47.5861] },
];

const ROW = fixture('hubeau/resultats_dis-45234-1340.json').data[0];
const ENVELOPE = fixture('hubeau/resultats_dis-45234-1340.json');

// The parameters a synthetic sample can carry, in the shape of the recorded row.
const PARAMETER_ROWS = {
  NO3: {
    code_parametre: '1340',
    libelle_parametre: 'Nitrates (en NO3)',
    libelle_unite: 'mg/L',
    limite_qualite_parametre: '<=50 mg/L',
  },
  PH: {
    code_parametre: '1302',
    libelle_parametre: 'pH',
    libelle_unite: 'unité pH',
    limite_qualite_parametre: null,
    reference_qualite_parametre: '>=6,5 et <=9 unité pH',
  },
  TH: {
    code_parametre: '1345',
    libelle_parametre: 'Titre hydrotimétrique',
    libelle_unite: '°f',
    limite_qualite_parametre: null,
  },
  CL2LIB: {
    code_parametre: '1398',
    libelle_parametre: 'Chlore libre *',
    libelle_unite: 'mg(Cl2)/L',
    limite_qualite_parametre: null,
  },
  CL2TOT: {
    code_parametre: '1399',
    libelle_parametre: 'Chlore total *',
    libelle_unite: 'mg(Cl2)/L',
    limite_qualite_parametre: null,
  },
  ECOLI: {
    code_parametre: '1449',
    libelle_parametre: 'Escherichia coli /100ml - MF',
    libelle_unite: 'n/(100mL)',
    limite_qualite_parametre: '<=0 n/(100mL)',
  },
};

/**
 * The rows of one sample. `params` maps a SISE code to a number or to the
 * laboratory text ("<0,10"); conformity codes default to C.
 */
export function sampleRows({
  code,
  commune = ORLEANS,
  at,
  bact = 'C',
  pc = 'C',
  conclusion = ROW.conclusion_conformite_prelevement,
  params = {},
}) {
  return Object.entries(params).map(([se, value]) => {
    const text = typeof value === 'number' ? String(value).replace('.', ',') : value;
    const numeric =
      typeof value === 'number'
        ? value
        : Number(String(value).replace(/[<>]/, '').replace(',', '.'));
    return {
      ...ROW,
      ...PARAMETER_ROWS[se],
      code_parametre_se: se,
      code_prelevement: code,
      code_commune: commune,
      nom_commune: commune === ORLEANS ? ROW.nom_commune : 'COMMUNE',
      date_prelevement: new Date(at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      resultat_alphanumerique: text,
      resultat_numerique: numeric,
      conclusion_conformite_prelevement: conclusion,
      conformite_limites_bact_prelevement: bact,
      conformite_limites_pc_prelevement: pc,
      conformite_references_bact_prelevement: bact,
      conformite_references_pc_prelevement: pc,
    };
  });
}

/** The sample recorded on 11/05/2026 in Orléans, completed with pH, hardness and chlorine. */
export const RECORDED_SAMPLE = {
  code: ROW.code_prelevement,
  at: Date.parse(ROW.date_prelevement),
  params: { NO3: 3.5, PH: 7.6, TH: 18.5, CL2LIB: '<0,10' },
};
/** A routine sample of 20/07/2026: bacteria only, physico-chemistry "sans objet". */
export const ROUTINE_SAMPLE = {
  code: '04500171111',
  at: Date.parse('2026-07-20T08:30:00Z'),
  pc: 'S',
  params: { ECOLI: '<1', CL2LIB: 0.21 },
};

/** A consultSite.do page in the layout of the hand-made fixture. */
export function sitePageHtml({ name, seasonStart, seasonEnd, bans = [], samples = [] }) {
  const day = (iso) => iso.split('-').reverse().join('/');
  const words = { good: 'Bon', average: 'Moyen', poor: 'Mauvais', null: 'Non renseign&eacute;' };
  return [
    '<html><head><meta charset="utf-8">',
    `<title>Qualit&eacute; des eaux de baignade &gt; ${name}</title></head><body><table>`,
    seasonStart ? `<tr><td>D&eacute;but de la saison : ${day(seasonStart)}</td></tr>` : '',
    seasonEnd ? `<tr><td>Fin de la saison : ${day(seasonEnd)}</td></tr>` : '',
    ...bans.map(
      (ban) =>
        `<tr><td>Interdiction de baignade du ${day(ban.from)}${ban.to ? ` au ${day(ban.to)}` : ''}</td></tr>`,
    ),
    '</table><table>',
    ...samples.map(
      (sample) =>
        `<tr><td><img src="images/fr/boutons/fleche_ronde.gif"></td><td>${day(sample.date)}</td><td>${words[sample.result]}</td></tr>`,
    ),
    '</table></body></html>',
  ].join('\n');
}

/**
 * Fake Hub'Eau, geo.api.gouv.fr and baignades.sante.gouv.fr.
 * `api.down.hubeau` / `.geo` / `.baignades`: 'network', a status (503) or false.
 */
export function createApi() {
  const api = {
    rows: [...sampleRows(RECORDED_SAMPLE), ...sampleRows(ROUTINE_SAMPLE)],
    sites: {
      [OLIVET]: [
        { isite: '000101', nom: "PLAN D'EAU DU LAC" },
        { isite: '000102', nom: 'PLAGE DE LA LOIRE' },
      ],
    },
    pages: {
      [LAKE]: {
        name: "PLAN D'EAU DU LAC",
        seasonStart: '2026-06-15',
        seasonEnd: '2026-08-31',
        samples: [
          { date: '2026-07-01', result: 'good' },
          { date: '2026-08-12', result: 'good' },
        ],
      },
      [RIVER]: {
        name: 'PLAGE DE LA LOIRE',
        seasonStart: '2026-07-01',
        seasonEnd: '2026-08-31',
        samples: [{ date: '2026-08-10', result: 'average' }],
      },
    },
    rawPages: { [MOULINET]: fixtureText('baignades/consultSite-030002007.synthetic.html') },
    down: { hubeau: false, geo: false, baignades: false },
    requests: [],

    /** Add a sample (see sampleRows). */
    addSample(sample) {
      api.rows.push(...sampleRows(sample));
    },

    hubeau(url) {
      const params = url.searchParams;
      if (!url.pathname.endsWith('/qualite_eau_potable/resultats_dis')) {
        return null;
      }
      const since = params.has('date_min_prelevement')
        ? Date.parse(`${params.get('date_min_prelevement')}T00:00:00Z`)
        : 0;
      const codes = params.get('code_parametre_se')?.split(',');
      const fields = params.get('fields')?.split(',');
      const data = api.rows
        .filter(
          (row) =>
            row.code_commune === params.get('code_commune') &&
            Date.parse(row.date_prelevement) >= since &&
            (!codes || codes.includes(row.code_parametre_se)),
        )
        .sort((a, b) => Date.parse(b.date_prelevement) - Date.parse(a.date_prelevement))
        .slice(0, Number(params.get('size') ?? 20))
        .map((row) =>
          fields ? Object.fromEntries(fields.map((field) => [field, row[field] ?? null])) : row,
        );
      return { ...ENVELOPE, count: data.length, next: null, data };
    },

    geo(url) {
      const params = url.searchParams;
      const shape = (commune) => ({
        code: commune.code,
        nom: commune.nom,
        codeDepartement: commune.codeDepartement,
        ...(params.get('fields')?.includes('centre')
          ? { centre: { type: 'Point', coordinates: commune.centre } }
          : {}),
      });
      const departments = /^\/departements\/(\w+)\/communes$/.exec(url.pathname);
      if (departments) {
        return COMMUNES.filter((c) => c.codeDepartement === departments[1]).map(shape);
      }
      const one = /^\/communes\/(\w+)$/.exec(url.pathname);
      if (one) {
        const commune = COMMUNES.find((c) => c.code === one[1]);
        return commune ? shape(commune) : 404;
      }
      if (url.pathname === '/communes' && params.has('lat')) {
        const lat = Number(params.get('lat'));
        const lon = Number(params.get('lon'));
        // The commune whose centre is nearest, within 15 km: a stand-in for the contours.
        const nearest = COMMUNES.map((c) => ({
          c,
          d: Math.hypot(c.centre[0] - lon, c.centre[1] - lat),
        })).sort((a, b) => a.d - b.d)[0];
        return nearest.d < 0.15 ? [shape(nearest.c)] : [];
      }
      return null;
    },

    baignades(url) {
      const params = url.searchParams;
      if (url.pathname.endsWith('/siteList.do')) {
        return { sites: api.sites[params.get('insee_com')] ?? [] };
      }
      if (url.pathname.endsWith('/consultSite.do')) {
        const code = params.get('site');
        if (api.rawPages[code]) {
          return { html: api.rawPages[code] };
        }
        const page = api.pages[code];
        return { html: page ? sitePageHtml(page) : '<html><body>Site inconnu</body></html>' };
      }
      return null;
    },

    async fetch(input) {
      const url = new URL(input);
      api.requests.push(url);
      const service = {
        'hubeau.eaufrance.fr': 'hubeau',
        'geo.api.gouv.fr': 'geo',
        'baignades.sante.gouv.fr': 'baignades',
      }[url.host];
      const down = api.down[service];
      if (down === 'network') {
        throw new TypeError('fetch failed');
      }
      if (down) {
        return { status: down, text: async () => 'Service Unavailable' };
      }
      const body = service ? api[service](url) : null;
      if (body === null || body === 404) {
        return { status: 404, text: async () => 'Not Found' };
      }
      if (body.html !== undefined) {
        const bytes = new TextEncoder().encode(body.html);
        return {
          status: 200,
          headers: new Headers({ 'content-type': 'text/html;charset=UTF-8' }),
          arrayBuffer: async () => bytes.buffer,
        };
      }
      return { status: 200, text: async () => JSON.stringify(body) };
    },
  };
  return api;
}

/** A manual clock; `sleep` moves it forward instead of waiting. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
    async sleep(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] true: the monitor's own timer runs (mock it)
 */
export async function createWorld({
  config = {},
  devices = [],
  houses = [HOUSE],
  api = createApi(),
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-qualite-eau-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, {
    store,
    fetch: api.fetch,
    timers,
    now: clock.now,
    sleep: clock.sleep,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** The device published for a commune or a site, from the last discovery list. */
export const discovered = (world, code) =>
  world.fake.discoveredDevices.find(
    (device) =>
      device.params.some((p) => ['INSEE_CODE', 'SITE_CODE'].includes(p.name) && p.value === code) &&
      device.external_id.endsWith(`:${code}`),
  );

/** Create the device of a commune or a site in Gladys, as the user would. */
export async function create(world, code) {
  const device = discovered(world, code);
  if (!device) {
    throw new Error(`${code} is not in the discovered devices`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** The last value published for one feature of a device. */
export const last = (world, device, key) => world.fake.lastState(featureId(device, key));

/** Move the clock and run one tick. */
export async function tick(world, ms = HOUR) {
  world.clock.advance(ms);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
