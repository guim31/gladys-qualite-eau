// -----------------------------------------------------------------------------
// The monitor against the recorded and hand-made answers: which communes and
// sites are followed, the states they publish, the daily refresh without any
// onPoll, the heartbeat, the triggers, the failures of the services and what
// survives a restart.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TRIGGERS } from '../src/monitor.js';
import {
  BLOIS,
  DAY,
  HOUR,
  HOUSE,
  LAKE,
  MOULINET,
  OLIVET,
  ORLEANS,
  RIVER,
  create,
  createApi,
  createClock,
  createWorld,
  discovered,
  featureId,
  last,
  tick,
} from './helpers/world.js';

async function worldWith(t, codes, options = {}) {
  const world = await createWorld({ config: { bathing_around: '10' }, ...options });
  t.after(() => world.app.stop());
  const devices = {};
  for (const code of codes) {
    devices[code] = await create(world, code);
  }
  return { world, devices };
}

const statesOf = (world, device, key) =>
  world.fake.states.filter((state) => state.device_feature_external_id === featureId(device, key));
const hubeauRequests = (world) =>
  world.api.requests.filter((url) => url.host === 'hubeau.eaufrance.fr').length;

test('the commune of the house: its tap water, named by geo.api.gouv.fr', async (t) => {
  const { world, devices } = await worldWith(t, [ORLEANS]);
  const tap = devices[ORLEANS];
  assert.equal(tap.name, 'Eau du robinet · Orléans');
  assert.equal(tap.should_poll, false);
  assert.deepEqual(tap.params, [
    { name: 'INSEE_CODE', value: ORLEANS },
    { name: 'DISTRIBUTOR', value: 'SUEZ AQUALIGE' },
    {
      name: 'NETWORKS',
      value: 'ORLEANS, SAINT JEAN DE LA RUELLE, ORLEANS-ST JEAN LE BLANC-ST PRYVÉ',
    },
  ]);
  // The routine sample of 20/07 assessed the bacteria only: the physico-chemical
  // conformity is that of the recorded sample of 11/05.
  assert.equal(last(world, tap, 'bacteriological'), 0);
  assert.equal(last(world, tap, 'physico_chemical'), 0);
  assert.equal(last(world, tap, 'sample_date'), '20/07/2026');
  assert.equal(
    last(world, tap, 'conclusion'),
    "Eau d'alimentation conforme aux exigences de qualité en vigueur pour l'ensemble des paramètres mesurés.",
  );
  // The recorded nitrates, the synthetic hardness and pH of the same sample,
  // and the newest chlorine (the routine sample measures it).
  assert.equal(last(world, tap, 'nitrates'), 3.5);
  assert.equal(last(world, tap, 'hardness'), 18.5);
  assert.equal(last(world, tap, 'ph'), 7.6);
  assert.equal(last(world, tap, 'chlorine'), 0.21);
});

test('the house coordinates are rounded before leaving, and never stored', async (t) => {
  const { world } = await worldWith(t, []);
  const asked = world.api.requests.filter(
    (url) => url.host === 'geo.api.gouv.fr' && url.searchParams.has('lat'),
  );
  assert.ok(asked.length > 0);
  assert.equal(asked[0].searchParams.get('lat'), '47.903');
  assert.equal(asked[0].searchParams.get('lon'), '1.909');
  await world.store.flush();
  const saved = JSON.stringify(await world.store.load());
  assert.doesNotMatch(saved, /47\.90/);
  assert.doesNotMatch(saved, /1\.909/);
});

test('typed INSEE codes replace the commune of the house', async (t) => {
  const world = await createWorld({
    config: { communes: `${OLIVET} ${BLOIS}`, bathing_around: '0' },
  });
  t.after(() => world.app.stop());
  const names = world.fake.discoveredDevices.map((device) => device.name);
  assert.deepEqual(names, ['Eau du robinet · Olivet', 'Eau du robinet · Blois']);
  // No sample for those in the fake Hub'Eau: the configuration screen says so.
  assert.match(world.fake.connectionStatus.message.fr, /Aucun prélèvement .* 45232, 41018/);
  const olivet = await create(world, OLIVET);
  assert.equal(last(world, olivet, 'conclusion'), 'Aucun prélèvement publié depuis un an');
});

test('a non-compliant sample: red badge, its conclusion, and the trigger once', async (t) => {
  const { world, devices } = await worldWith(t, [ORLEANS]);
  const tap = devices[ORLEANS];
  const conclusion =
    "Eau non conforme aux limites de qualité pour le paramètre E. coli. Faire bouillir l'eau avant consommation.";
  world.api.addSample({
    code: '04500179999',
    at: Date.parse('2026-08-19T07:00:00Z'),
    bact: 'N',
    pc: 'S',
    conclusion,
    params: { ECOLI: 3 },
  });
  await tick(world, DAY);
  assert.equal(last(world, tap, 'bacteriological'), 3);
  assert.equal(last(world, tap, 'physico_chemical'), 0);
  assert.equal(last(world, tap, 'conclusion'), conclusion);
  assert.deepEqual(world.fake.sceneEvents, [
    {
      key: TRIGGERS.TAP,
      data: {
        commune: tap.external_id,
        commune_name: 'Orléans',
        sample_date: '19/08/2026',
        conclusion,
        bacteriological: 'non_compliant',
        physico_chemical: 'not_measured',
      },
    },
  ]);
  await tick(world, DAY);
  assert.equal(world.fake.sceneEvents.length, 1, 'the same sample fires once');
});

test('a sample under a derogation is yellow, and fires no trigger', async (t) => {
  const { world, devices } = await worldWith(t, [ORLEANS]);
  world.api.addSample({
    code: '04500178888',
    at: Date.parse('2026-08-18T07:00:00Z'),
    bact: 'C',
    pc: 'D',
    params: { NO3: 52 },
  });
  await tick(world, DAY);
  assert.equal(last(world, devices[ORLEANS], 'physico_chemical'), 1);
  assert.equal(last(world, devices[ORLEANS], 'nitrates'), 52);
  assert.deepEqual(world.fake.sceneEvents, []);
});

test('the first reading fires nothing, even on a non-compliant sample', async (t) => {
  const api = createApi();
  api.addSample({
    code: '04500177777',
    at: Date.parse('2026-08-10T07:00:00Z'),
    bact: 'N',
    params: { ECOLI: 9 },
  });
  const { world, devices } = await worldWith(t, [ORLEANS], { api });
  assert.equal(last(world, devices[ORLEANS], 'bacteriological'), 3);
  assert.deepEqual(world.fake.sceneEvents, []);
});

test('one reading a day, by the internal timer, without any onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { world, devices } = await worldWith(t, [ORLEANS], { timers: true });
  const poll = t.mock.method(world.monitor, 'poll');
  const before = hubeauRequests(world);
  // 23 hourly ticks: nothing is due yet.
  for (let i = 0; i < 23; i += 1) {
    world.clock.advance(HOUR);
    t.mock.timers.tick(HOUR);
    await world.monitor.running;
  }
  assert.equal(hubeauRequests(world), before);
  world.api.addSample({
    code: '04500175555',
    at: Date.parse('2026-08-20T09:00:00Z'),
    params: { NO3: 4.1 },
  });
  world.clock.advance(HOUR);
  t.mock.timers.tick(HOUR);
  await world.monitor.running;
  assert.equal(hubeauRequests(world), before + 5, 'the samples and the four parameters, once');
  assert.equal(last(world, devices[ORLEANS], 'nitrates'), 4.1);
  assert.equal(last(world, devices[ORLEANS], 'sample_date'), '20/08/2026');
  assert.equal(poll.mock.callCount(), 0);
});

test('only the changes are published, plus a heartbeat every 12 hours', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const { world, devices } = await worldWith(t, [ORLEANS]);
  const tap = devices[ORLEANS];
  const count = statesOf(world, tap, 'hardness').length;
  await tick(world, HOUR);
  await tick(world, HOUR);
  assert.equal(statesOf(world, tap, 'hardness').length, count, 'nothing new, nothing sent');
  t.mock.timers.tick(12 * HOUR + 1000);
  await tick(world, HOUR);
  assert.equal(statesOf(world, tap, 'hardness').length, count + 1, 'the heartbeat');
});

test('the onPoll fallback answers without asking the services again', async (t) => {
  const { world, devices } = await worldWith(t, [ORLEANS]);
  const before = hubeauRequests(world);
  await world.fake.poll(devices[ORLEANS]);
  assert.equal(hubeauRequests(world), before);
});

test('bathing sites around the house: names, result, sample, season', async (t) => {
  const { world, devices } = await worldWith(t, [LAKE, RIVER]);
  const lake = devices[LAKE];
  assert.equal(lake.name, "PLAN D'EAU DU LAC");
  assert.deepEqual(lake.params, [
    { name: 'SITE_CODE', value: LAKE },
    { name: 'INSEE_CODE', value: OLIVET },
  ]);
  assert.equal(last(world, lake, 'quality'), 0);
  assert.equal(last(world, lake, 'result'), 'Bon');
  assert.equal(last(world, lake, 'sample_date'), '12/08/2026');
  assert.equal(last(world, lake, 'season'), "Ouverte jusqu'au 31/08");
  assert.equal(last(world, devices[RIVER], 'quality'), 1);
  assert.equal(last(world, devices[RIVER], 'result'), 'Moyen');
  // Blois is beyond 10 km: its sites are not asked for.
  const listed = world.api.requests
    .filter((url) => url.pathname.endsWith('/siteList.do'))
    .map((url) => url.searchParams.get('insee_com'));
  assert.ok(listed.includes(OLIVET) && listed.includes(ORLEANS));
  assert.ok(!listed.includes(BLOIS));
});

test('a typed site: its name from its page, a pending sample does not hide the last result', async (t) => {
  const world = await createWorld({ config: { bathing_around: '0', bathing_sites: MOULINET } });
  t.after(() => world.app.stop());
  // Its page is read before the device is created: the name comes from it.
  await world.monitor.refreshSite(MOULINET);
  await world.monitor.publishDiscovered();
  const site = await create(world, MOULINET);
  assert.equal(site.name, 'LE MOULINET - BEAU RIVAGE');
  // 18/08 "Non renseigné": the result of 04/08 stays.
  assert.equal(last(world, site, 'result'), 'Bon');
  assert.equal(last(world, site, 'sample_date'), '04/08/2026');
  // The ban of 12/07 to 14/07 is over.
  assert.equal(last(world, site, 'quality'), 0);
});

test('a ban in force: prohibited, red, and the trigger', async (t) => {
  const { world, devices } = await worldWith(t, [LAKE]);
  world.api.pages[LAKE].bans = [{ from: '2026-08-20', to: null }];
  await tick(world, DAY);
  assert.equal(last(world, devices[LAKE], 'quality'), 3);
  assert.equal(last(world, devices[LAKE], 'result'), 'Baignade interdite');
  assert.deepEqual(world.fake.sceneEvents, [
    {
      key: TRIGGERS.BATHING,
      data: {
        site: devices[LAKE].external_id,
        site_name: "PLAN D'EAU DU LAC",
        status: 'prohibited',
        status_name: 'Baignade interdite',
        sample_date: '12/08/2026',
      },
    },
  ]);
});

test('poor, then prohibited fires twice; back to good fires nothing', async (t) => {
  const { world } = await worldWith(t, [LAKE]);
  world.api.pages[LAKE].samples.push({ date: '2026-08-20', result: 'poor' });
  await tick(world, DAY);
  world.api.pages[LAKE].bans = [{ from: '2026-08-21', to: '2026-08-25' }];
  await tick(world, DAY);
  world.api.pages[LAKE].samples.push({ date: '2026-08-26', result: 'good' });
  await tick(world, 5 * DAY);
  assert.deepEqual(
    world.fake.sceneEvents.map((event) => event.data.status),
    ['poor', 'prohibited'],
  );
});

test('out of season: no quality published, the season says so', async (t) => {
  const clock = createClock(Date.parse('2026-10-15T08:00:00Z'));
  const { world, devices } = await worldWith(t, [LAKE], { clock });
  const lake = devices[LAKE];
  assert.equal(last(world, lake, 'quality'), undefined);
  assert.equal(last(world, lake, 'result'), 'Hors saison');
  assert.equal(last(world, lake, 'season'), 'Fermée (saison du 15/06 au 31/08)');
  assert.equal(last(world, lake, 'sample_date'), '12/08/2026');
});

test('overseas, bathing is all year round', async (t) => {
  const api = createApi();
  api.pages['974000001'] = {
    name: "PLAGE DE L'ERMITAGE (SYNTHETIC)",
    samples: [{ date: '2026-08-18', result: 'good' }],
  };
  const world = await createWorld({
    config: { bathing_around: '0', bathing_sites: '974000001' },
    api,
  });
  t.after(() => world.app.stop());
  const site = await create(world, '974000001');
  assert.equal(last(world, site, 'season'), "Toute l'année");
  assert.equal(last(world, site, 'quality'), 0);
});

test("Hub'Eau down: the last values stay, read again an hour later", async (t) => {
  const { world, devices } = await worldWith(t, [ORLEANS]);
  world.api.down.hubeau = 503;
  await tick(world, DAY);
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /Hub'Eau does not answer/);
  assert.equal(last(world, devices[ORLEANS], 'hardness'), 18.5);
  world.api.down.hubeau = false;
  const before = hubeauRequests(world);
  await tick(world, 30 * 60 * 1000);
  assert.equal(hubeauRequests(world), before, 'not before an hour');
  await tick(world, 30 * 60 * 1000);
  assert.equal(hubeauRequests(world), before + 5);
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('a house without location, or gone: the configuration screen says it', async (t) => {
  const unlocated = await createWorld({
    config: { house: HOUSE.selector },
    houses: [{ ...HOUSE, latitude: null, longitude: null }],
  });
  t.after(() => unlocated.app.stop());
  assert.match(unlocated.fake.connectionStatus.message.fr, /« Maison » n'a pas de position/);
  assert.deepEqual(unlocated.fake.discoveredDevices, []);
  const none = await createWorld({ houses: [] });
  t.after(() => none.app.stop());
  assert.match(none.fake.connectionStatus.message.en, /Give your house a location in Gladys/);
  const gone = await createWorld({ config: { house: 'chalet' } });
  t.after(() => gone.app.stop());
  assert.match(gone.fake.connectionStatus.message.en, /"chalet" no longer exists/);
});

test('invalid tokens of the configuration are listed, not followed', async (t) => {
  const world = await createWorld({ config: { communes: '45000 4523', bathing_sites: 'plage' } });
  t.after(() => world.app.stop());
  assert.match(world.fake.connectionStatus.message.fr, /Ignoré .*4523, plage/);
});

test('a created device keeps being followed when the configuration no longer names it', async (t) => {
  const { world } = await worldWith(t, [ORLEANS, LAKE]);
  await world.fake.configUpdated({ communes: OLIVET, bathing_around: '0' });
  const ids = world.fake.discoveredDevices.map((device) => device.external_id.split(':').pop());
  assert.deepEqual(ids.sort(), [LAKE, OLIVET, ORLEANS].sort());
  await world.fake.deviceDeleted(discovered(world, LAKE));
  // The fake keeps the device list; Gladys would drop it: the next discovery follows.
  assert.ok(world.fake.discoveredDevices.length >= 2);
});

test('a restart reads nothing again before a day, and remembers what the triggers compare', async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gladys-qualite-eau-'));
  const first = await worldWith(t, [ORLEANS, LAKE], { dataDir });
  await first.world.app.stop();
  const api = createApi();
  const clock = createClock(first.world.clock.now() + HOUR);
  const devices = Object.values(first.devices);
  const world = await createWorld({
    config: { bathing_around: '10' },
    api,
    clock,
    dataDir,
    devices,
  });
  t.after(() => world.app.stop());
  assert.equal(
    api.requests.filter(
      (url) => url.host !== 'geo.api.gouv.fr' && !url.pathname.endsWith('/siteList.do'),
    ).length,
    0,
  );
  assert.equal(world.fake.lastState(featureId(first.devices[ORLEANS], 'hardness')), 18.5);
  api.pages[LAKE].samples.push({ date: '2026-08-21', result: 'poor' });
  await tick(world, DAY);
  assert.deepEqual(
    world.fake.sceneEvents.map((event) => event.key),
    [TRIGGERS.BATHING],
  );
});
