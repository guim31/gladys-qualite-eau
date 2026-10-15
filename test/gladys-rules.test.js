// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on every device discovered from realistic
// inputs: the tap water of the commune of the house and of typed INSEE codes,
// the bathing sites around the house and typed by code, from the recorded and
// hand-made answers of test/fixtures, in every feature-name language.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES } from '../src/config.js';
import { MOULINET, OLIVET, ORLEANS, createWorld } from './helpers/world.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

const CONFIGS = [
  // The house: its commune, and the bathing sites within 10 km.
  { bathing_around: '10' },
  // Typed communes and a typed site.
  { communes: `${ORLEANS}, ${OLIVET}`, bathing_around: 'commune', bathing_sites: MOULINET },
];

for (const language of LANGUAGES) {
  for (const [index, config] of CONFIGS.entries()) {
    test(`every discovered device follows the Gladys rules (${language} names, configuration ${index + 1})`, async (t) => {
      const world = await createWorld({ config: { ...config, language } });
      t.after(() => world.app.stop());
      const devices = world.fake.discoveredDevices;
      assert.ok(devices.length >= 3, `${devices.length} devices`);
      const kinds = new Set(devices.map((device) => device.external_id.split(':')[2]));
      assert.deepEqual([...kinds].sort(), ['bathing', 'tap']);

      const deviceIds = new Set();
      const deviceNames = new Set();
      for (const device of devices) {
        const where = device.name;
        assert.ok(!deviceIds.has(device.external_id), `${where}: duplicate device external_id`);
        deviceIds.add(device.external_id);
        assert.ok(!deviceNames.has(device.name), `${where}: duplicate device name`);
        deviceNames.add(device.name);

        // should_poll: true if and only if poll_frequency is provided, in ms.
        if (device.poll_frequency === undefined) {
          assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
        } else {
          assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
          assert.ok(
            table.poll_frequencies_ms.includes(device.poll_frequency),
            `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
          );
        }

        assert.ok(device.features.length > 0, `${where}: no feature`);
        const externalIds = new Set();
        const names = new Set();
        for (const feature of device.features) {
          const at = `${where} / ${feature.name}`;
          const pair = table.pairs[`${feature.category}/${feature.type}`];
          assert.ok(
            pair,
            `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`,
          );
          assert.ok(
            pair.label_en && pair.label_fr && pair.icon,
            `${at}: couple without label or icon`,
          );

          assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
          assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
          assert.ok(
            Number.isFinite(feature.min) && Number.isFinite(feature.max),
            `${at}: finite min/max`,
          );
          assert.ok(feature.min <= feature.max, `${at}: min > max`);
          assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
          assert.equal(
            typeof feature.has_feedback,
            'boolean',
            `${at}: has_feedback must be a boolean`,
          );
          if (feature.unit !== undefined) {
            assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
          }
          if (feature.unit !== undefined && table.units_by_category?.[feature.category]) {
            assert.ok(
              table.units_by_category[feature.category].includes(feature.unit),
              `${at}: ${feature.unit} is not a unit of ${feature.category}`,
            );
          }

          assert.ok(!externalIds.has(feature.external_id), `${at}: duplicate external_id`);
          externalIds.add(feature.external_id);
          assert.ok(feature.name.length <= 40, `${at}: name longer than 40 characters`);
          assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
          names.add(feature.name);
        }
      }
    });
  }
}

test('a feature alone of its type is the risk badge of a bathing site, whose label says enough', async (t) => {
  // The dashboard shows the generic label of a type when a feature is alone of
  // it on its device: the three numbers without unit share theirs, so their
  // names (which carry the unit) are shown.
  const world = await createWorld({ config: { bathing_around: '10' } });
  t.after(() => world.app.stop());
  for (const device of world.fake.discoveredDevices) {
    const counts = {};
    for (const feature of device.features) {
      const couple = `${feature.category}/${feature.type}`;
      counts[couple] = (counts[couple] ?? 0) + 1;
    }
    assert.ok(!counts['unknown/unknown'] || counts['unknown/unknown'] >= 2, device.name);
  }
});
