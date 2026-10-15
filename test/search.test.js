// -----------------------------------------------------------------------------
// The "Find bathing sites" action: around the house, in a commune, and what it
// answers without a house or a service.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE, OLIVET, createWorld } from './helpers/world.js';

async function run(t, fields, options = {}) {
  const world = await createWorld({ config: { bathing_around: '0' }, ...options });
  t.after(() => world.app.stop());
  const ack = await world.fake.action('find_bathing_sites', fields);
  assert.equal(ack.success, true);
  return { world, message: ack.data.message };
}

test('around the house: the sites of the communes within the distance', async (t) => {
  const { message } = await run(t, { radius: '5' });
  assert.equal(
    message.fr,
    "2 site(s) de baignade. Copiez les codes dans « Sites de baignade », puis enregistrez :\n045000101 — PLAN D'EAU DU LAC (Olivet, 4,4 km)\n045000102 — PLAGE DE LA LOIRE (Olivet, 4,4 km)",
  );
  assert.match(message.en, /Olivet, 4\.4 km/);
});

test('in a commune, by its INSEE code', async (t) => {
  const { message } = await run(t, { commune: OLIVET });
  assert.match(message.de, /^2 Badestelle\(n\)/);
  assert.match(message.es, /045000101 — PLAN D'EAU DU LAC \(Olivet\)/);
});

test('a postcode, a commune without site, no house, a service down', async (t) => {
  assert.match((await run(t, { commune: '450' })).message.fr, /pas son code postal/);
  assert.equal((await run(t, { commune: '45234' })).message.en, 'No bathing site found.');
  assert.match((await run(t, {}, { houses: [] })).message.en, /has no location in Gladys/);
  const world = await createWorld({ config: { bathing_around: '0' } });
  t.after(() => world.app.stop());
  world.api.down.baignades = 503;
  const ack = await world.fake.action('find_bathing_sites', { commune: OLIVET });
  assert.match(ack.data.message.fr, /ne répond pas/);
  assert.ok(HOUSE);
});
