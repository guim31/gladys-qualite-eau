// -----------------------------------------------------------------------------
// The `water_quality` dashboard widget: the content fits the core vocabulary
// and budget (validateWidgetContent, empty array = rendered as sent), every
// bound feature exists on a published device, and the colours follow the
// results.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_COLORS, validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { WIDGET_KEY } from '../src/monitor.js';
import { bathingValue, tapValue } from '../src/widgets.js';
import { DAY, LAKE, ORLEANS, RIVER, create, createWorld, tick } from './helpers/world.js';

async function worldWith(t, codes, config = {}) {
  const world = await createWorld({ config: { bathing_around: '10', ...config } });
  t.after(() => world.app.stop());
  const devices = [];
  for (const code of codes) {
    devices.push(await create(world, code));
  }
  return { world, devices };
}

async function content(world, settings = {}, language = 'fr') {
  const ack = await world.fake.widgetGet(WIDGET_KEY, { settings, language, units: 'metric' });
  assert.equal(ack.success, true);
  return ack.data.content;
}

const features = (devices) =>
  new Set(devices.flatMap((device) => device.features.map((feature) => feature.external_id)));

test('the overview: the tap water, its hardness, the sites, valid in every language', async (t) => {
  const { world, devices } = await worldWith(t, [ORLEANS, LAKE, RIVER]);
  for (const language of LANGUAGES) {
    const widget = await content(world, {}, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
  }
  const widget = await content(world);
  const tile = widget.components.find((c) => c.type === 'value');
  assert.deepEqual(tile, {
    type: 'value',
    label: 'Dureté (°f)',
    device_feature: 'ext:test-integration:tap:45234:hardness',
  });
  assert.ok(features(devices).has(tile.device_feature));
  const items = widget.components.find((c) => c.type === 'status').items;
  assert.deepEqual(items, [
    {
      label: 'Eau du robinet · Orléans',
      value: 'Conforme · 18,5 °f',
      color: WIDGET_COLORS.SUCCESS,
      icon: 'droplet',
    },
    { label: "PLAN D'EAU DU LAC", value: 'Bon · 12/08', color: WIDGET_COLORS.SUCCESS, icon: 'sun' },
    {
      label: 'PLAGE DE LA LOIRE',
      value: 'Moyen · 10/08',
      color: WIDGET_COLORS.WARNING,
      icon: 'sun',
    },
  ]);
  assert.match(widget.components.at(-1).text, /^Sources : Hub'Eau, ministère de la Santé · /);
});

test('a non-compliant tap water or an unsafe site adds a heading in red', async (t) => {
  const { world } = await worldWith(t, [ORLEANS, LAKE]);
  world.api.pages[LAKE].bans = [{ from: '2026-08-20', to: null }];
  await tick(world, DAY);
  let widget = await content(world, {}, 'en');
  assert.deepEqual(widget.components[0], {
    type: 'text',
    variant: 'heading',
    text: 'Bathing not advised',
  });
  const lake = widget.components.find((c) => c.type === 'status').items[1];
  assert.deepEqual(
    [lake.value, lake.color, lake.icon],
    ['Bathing prohibited', WIDGET_COLORS.DANGER, 'x-circle'],
  );
  world.api.addSample({ code: 'N1', at: world.clock.now() - DAY, bact: 'N', params: { ECOLI: 2 } });
  await tick(world, DAY);
  widget = await content(world, {}, 'de');
  assert.equal(widget.components[0].text, 'Leitungswasser nicht konform');
  assert.equal(
    widget.components.find((c) => c.type === 'status').items[0].color,
    WIDGET_COLORS.DANGER,
  );
});

test('the detail of a commune: four live tiles, the conformities, the conclusion', async (t) => {
  const { world, devices } = await worldWith(t, [ORLEANS]);
  const widget = await content(world, { device: devices[0].external_id });
  assert.deepEqual(validateWidgetContent(widget), []);
  const tiles = widget.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((tile) => tile.device_feature.split(':').pop()),
    ['nitrates', 'hardness', 'chlorine', 'ph'],
  );
  for (const tile of tiles) {
    assert.ok(features(devices).has(tile.device_feature), tile.device_feature);
  }
  assert.deepEqual(widget.components.find((c) => c.type === 'status').items, [
    { label: 'Bactériologie', value: 'Conforme', color: WIDGET_COLORS.SUCCESS },
    { label: 'Physico-chimie', value: 'Conforme', color: WIDGET_COLORS.SUCCESS },
    {
      label: 'Dernier prélèvement',
      value: '20/07/2026',
      color: WIDGET_COLORS.NEUTRAL,
      icon: 'calendar',
    },
  ]);
  assert.match(
    widget.components.find((c) => c.variant === 'body').text,
    /^Eau d'alimentation conforme/,
  );
});

test('the detail of a site, with the link to its page', async (t) => {
  const { world, devices } = await worldWith(t, [LAKE]);
  for (const language of LANGUAGES) {
    const widget = await content(world, { device: devices[0].external_id }, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
  }
  const widget = await content(world, { device: devices[0].external_id });
  assert.deepEqual(
    widget.components.find((c) => c.type === 'status').items.map((item) => item.value),
    ['Bon · 12/08', '12/08/2026', "Ouverte jusqu'au 31/08"],
  );
  assert.deepEqual(widget.components.at(-1).link, {
    url: 'https://baignades.sante.gouv.fr/baignades/consultSite.do?dptddass=045&site=045000101',
  });
});

test('empty, and a device no longer followed', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const empty = await content(world, {}, 'es');
  assert.deepEqual(validateWidgetContent(empty), []);
  assert.match(empty.components[0].text, /^Aún no hay nada que mostrar/);
  const gone = await content(world, { device: 'ext:test-integration:bathing:045000101' }, 'en');
  assert.equal(gone.components[0].text, 'This device is no longer followed.');
});

test('a status value never exceeds 40 characters', () => {
  const tap = {
    read: true,
    empty: false,
    overall: 'derogation',
    parameters: { hardness: { value: 45.25 } },
  };
  const site = { read: true, status: 'unknown', lastSample: null };
  for (const language of LANGUAGES) {
    assert.ok(tapValue(tap, language).length <= 40, language);
    assert.ok(bathingValue(site, language).length <= 40, language);
  }
  assert.equal(tapValue({ ...tap, read: false }, 'fr'), 'En attente');
});
