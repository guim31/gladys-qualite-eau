// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, a non-compliant sample, a bathing site turning unsafe and back),
// never one line per tick or per reading; a failure that repeats at every tick
// is logged once, plus one line when it is over. Never the house coordinates:
// the configuration holds no secret, the location of the home is the
// sensitive data.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY,
  HOUR,
  HOUSE,
  LAKE,
  ORLEANS,
  captureLogs,
  create,
  createWorld,
  tick,
} from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function followed(t, config = {}) {
  const world = await createWorld({ config: { bathing_around: '10', ...config } });
  t.after(() => world.app.stop());
  await create(world, ORLEANS);
  await create(world, LAKE);
  return world;
}

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  const world = await createWorld({ config: { bathing_around: '10' } });
  t.after(() => world.app.stop());
  assert.deepEqual(lines.map(strip), [
    '[INFO] [qualite-eau] Started: 1 commune(s) and 2 bathing site(s) followed, read once a day',
  ]);
});

test('normal days of readings write nothing at info', async (t) => {
  const world = await followed(t);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 72; i += 1) {
    if (i === 30) {
      world.api.addSample({
        code: '04500170001',
        at: world.clock.now() - HOUR,
        params: { NO3: 3.9 },
      });
      world.api.pages[LAKE].samples.push({ date: '2026-08-21', result: 'average' });
    }
    await tick(world, HOUR);
  }
  assert.deepEqual(lines, []);
});

test('LOG_LEVEL=debug shows the readings, never the house coordinates', async (t) => {
  const lines = captureLogs(t, 'debug');
  const world = await followed(t);
  await tick(world, DAY);
  assert.ok(lines.some((line) => /Refresh cycle: 3 reading/.test(line.text)));
  assert.ok(lines.some((line) => /Orléans: 2 sample\(s\) in a year/.test(line.text)));
  const all = lines.map((line) => line.text).join('\n');
  assert.doesNotMatch(all, new RegExp(String(HOUSE.latitude).replace('.', '\\.')));
  assert.doesNotMatch(all, new RegExp(String(HOUSE.longitude).replace('.', '\\.')));
  assert.doesNotMatch(all, /47\.903|1\.909/);
});

test('a non-compliant sample is one info line', async (t) => {
  const world = await followed(t);
  const lines = captureLogs(t, 'info');
  world.api.addSample({
    code: '04500179999',
    at: Date.parse('2026-08-19T07:00:00Z'),
    bact: 'N',
    params: { ECOLI: 3 },
  });
  await tick(world, DAY);
  await tick(world, DAY);
  assert.deepEqual(lines.map(strip), [
    '[INFO] [qualite-eau] Orléans: non-compliant tap water sample of 2026-08-19',
  ]);
});

test('a bathing site turning poor and back is one info line each', async (t) => {
  const world = await followed(t);
  const lines = captureLogs(t, 'info');
  world.api.pages[LAKE].samples.push({ date: '2026-08-21', result: 'poor' });
  await tick(world, DAY);
  world.api.pages[LAKE].samples.push({ date: '2026-08-22', result: 'good' });
  await tick(world, DAY);
  assert.deepEqual(lines.map(strip), [
    "[INFO] [qualite-eau] PLAN D'EAU DU LAC: bathing good -> poor",
    "[INFO] [qualite-eau] PLAN D'EAU DU LAC: bathing poor -> good",
  ]);
});

test("Hub'Eau down at every retry: one warning, then one line at recovery", async (t) => {
  const world = await followed(t);
  const lines = captureLogs(t, 'info');
  world.api.down.hubeau = 503;
  await tick(world, DAY);
  for (let i = 0; i < 4; i += 1) {
    await tick(world, HOUR);
  }
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', "[qualite-eau] Hub'Eau unreachable: hubeau.eaufrance.fr: HTTP 503"]],
  );
  world.api.down.hubeau = false;
  await tick(world, HOUR);
  assert.deepEqual(lines.slice(1).map(strip), ["[INFO] [qualite-eau] Hub'Eau answers again"]);
});

test('baignades.sante.gouv.fr down: one warning, then one line at recovery', async (t) => {
  const world = await followed(t);
  const lines = captureLogs(t, 'info');
  world.api.down.baignades = 'network';
  await tick(world, DAY);
  for (let i = 0; i < 4; i += 1) {
    await tick(world, HOUR);
  }
  assert.equal(lines.length, 1);
  assert.match(
    lines[0].text,
    /\[WARN\].*baignades\.sante\.gouv\.fr unreachable: baignades\.sante\.gouv\.fr: fetch failed/,
  );
  world.api.down.baignades = false;
  await tick(world, HOUR);
  assert.match(lines.at(-1).text, /\[INFO\].*baignades\.sante\.gouv\.fr answers again/);
});

test('states refused at every tick: one warning, then one line at recovery', async (t) => {
  const world = await followed(t);
  const lines = captureLogs(t, 'info');
  const publish = t.mock.method(world.gladys, 'publishChangedStates', async () => {
    throw new Error('Gladys unreachable');
  });
  for (let i = 0; i < 3; i += 1) {
    await tick(world, HOUR);
  }
  assert.ok(publish.mock.callCount() >= 3);
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', '[qualite-eau] Publishing the states failed: Gladys unreachable']],
  );
  publish.mock.restore();
  await tick(world, HOUR);
  assert.match(lines.at(-1).text, /\[INFO\].*Publishing the states works again/);
});

test('saving the configuration is one info line', async (t) => {
  const world = await followed(t);
  const lines = captureLogs(t, 'info');
  await world.fake.configUpdated({ bathing_around: '0' });
  assert.deepEqual(lines.map(strip), [
    '[INFO] [qualite-eau] Configuration saved: 1 commune(s) and 1 bathing site(s) followed',
  ]);
});
