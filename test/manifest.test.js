// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BATHING_AROUND, DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { UNSAFE } from '../src/messages.js';
import { TRIGGERS, WIDGET_KEY } from '../src/monitor.js';
import { SEARCH_RADII } from '../src/search.js';
import { WIDGETS } from '../src/widgets.js';
import { DAY, LAKE, ORLEANS, create, createWorld, tick } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The handlers the integration actually registers on the SDK.
const { gladys: registered, app } = await createWorld({ connect: false });
await app.stop();
const handlerKeys = (prefix) =>
  Object.keys(registered.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const optionValues = (field) => field.options.map((option) => option.value);
const field = (list, key) => list.find((entry) => entry.key === key);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

test('identity: name, image, cover, cloud transport, environment category', () => {
  assert.equal(manifest.name, "Qualité de l'eau");
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-qualite-eau:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-qualite-eau/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['environment']);
});

test('the commune and the sites around the house read its location: the manifest declares it', () => {
  assert.equal(manifest.location, true);
});

test('Gladys 5.2.0 at least: widgets, scene triggers and the houses source', () => {
  // `source: "houses"` is only accepted from 5.2.0 (store schema, enforced by the indexer).
  const [major, minor] = minGladysVersion();
  assert.ok(major > 5 || (major === 5 && minor >= 2), manifest.gladys_version);
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), handlerKeys('action:').sort());
});

test('no scene action: the states and the triggers cover the use', () => {
  assert.equal(manifest.scene_actions, undefined);
  assert.deepEqual(handlerKeys('sceneAction:'), []);
});

test('the scene triggers the monitor fires are declared, with their filters and variables', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_triggers), [TRIGGERS.TAP, TRIGGERS.BATHING]);
  const world = await createWorld({ config: { bathing_around: '10' } });
  t.after(() => world.app.stop());
  const tap = await create(world, ORLEANS);
  const lake = await create(world, LAKE);
  world.api.addSample({
    code: '04500179999',
    at: world.clock.now() - DAY,
    bact: 'N',
    params: { ECOLI: 3 },
  });
  world.api.pages[LAKE].samples.push({ date: '2026-08-20', result: 'poor' });
  await tick(world, DAY);
  assert.deepEqual(
    world.fake.sceneEvents.map((event) => event.key),
    [TRIGGERS.TAP, TRIGGERS.BATHING],
  );
  for (const event of world.fake.sceneEvents) {
    const trigger = field(manifest.scene_triggers, event.key);
    assert.deepEqual(
      Object.keys(event.data).sort(),
      [...new Set([...keysOf(trigger.fields), ...keysOf(trigger.variables)])].sort(),
      `${event.key}: the declared keys, no other`,
    );
  }
  const [tapEvent, bathingEvent] = world.fake.sceneEvents;
  assert.equal(tapEvent.data.commune, tap.external_id, 'the commune filter is the device');
  assert.equal(bathingEvent.data.site, lake.external_id, 'the site filter is the device');
  const statuses = optionValues(
    field(field(manifest.scene_triggers, TRIGGERS.BATHING).fields, 'status'),
  );
  assert.deepEqual(statuses, UNSAFE);
  assert.ok(statuses.includes(bathingEvent.data.status));
});

test('every widget has its handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
});

test('config_schema defaults and options are the ones of the code', () => {
  for (const entry of manifest.config_schema) {
    if (entry.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[entry.key], entry.default, entry.key);
    }
  }
  assert.deepEqual(
    Object.keys(DEFAULT_CONFIG).sort(),
    manifest.config_schema
      .filter((entry) => entry.type !== 'section')
      .map((entry) => entry.key)
      .sort(),
  );
  assert.deepEqual(optionValues(field(manifest.config_schema, 'language')), LANGUAGES);
  assert.deepEqual(optionValues(field(manifest.config_schema, 'bathing_around')), BATHING_AROUND);
  const searchFields = field(manifest.actions, 'find_bathing_sites').fields;
  assert.deepEqual(optionValues(field(searchFields, 'radius')), SEARCH_RADII);
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((entry) => entry.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('dynamic selects declare their source, no static options and no default', () => {
  const dynamic = allFields.filter((entry) => entry.source !== undefined);
  assert.deepEqual(
    dynamic.map((entry) => entry.source),
    ['houses', 'devices', 'devices', 'devices'],
  );
  for (const entry of dynamic) {
    assert.equal(entry.options, undefined, entry.key);
    assert.equal(entry.default, undefined, entry.key);
  }
});

test('the house is an optional select of the houses of Gladys, before the communes', () => {
  const keys = keysOf(manifest.config_schema);
  const house = field(manifest.config_schema, 'house');
  assert.equal(house.type, 'select');
  assert.equal(house.source, 'houses');
  assert.notEqual(house.required, true);
  assert.equal(keys.indexOf('house') + 1, keys.indexOf('communes'));
});

test('number fields have integer bounds (the form has no step)', () => {
  for (const entry of allFields.filter((f) => f.type === 'number')) {
    for (const key of ['min', 'max', 'default']) {
      if (entry[key] !== undefined) {
        assert.ok(Number.isInteger(entry[key]), `${entry.key}.${key}`);
      }
    }
  }
});

test('actions: no secret field, no default, no required field (the core applies no default)', () => {
  // GladysAssistant/Gladys#3154 and #3155.
  for (const action of manifest.actions) {
    for (const entry of action.fields ?? []) {
      assert.notEqual(entry.type, 'secret', `${action.key}.${entry.key}`);
      assert.equal(entry.default, undefined, `${action.key}.${entry.key}`);
      assert.notEqual(entry.required, true, `${action.key}.${entry.key}`);
    }
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('the documentation the configuration links to exists', async () => {
  for (const section of manifest.config_schema.filter((entry) => entry.type === 'section')) {
    for (const { url } of section.links ?? []) {
      const local = /github\.com\/guim31\/gladys-qualite-eau\/blob\/main\/(.+)$/.exec(url);
      if (local) {
        await readFile(new URL(`../${local[1]}`, import.meta.url), 'utf8');
      }
    }
  }
});
