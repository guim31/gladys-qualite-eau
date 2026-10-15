import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  departmentOf,
  normalizeConfig,
  parseCommuneCodes,
  parseSiteCodes,
  siteCodeOf,
} from '../src/config.js';

test('the defaults: the commune of the house and its bathing sites, French names', () => {
  assert.deepEqual(normalizeConfig(), {
    houseSelector: null,
    communeCodes: [],
    siteCodes: [],
    invalid: [],
    bathingAround: 'commune',
    language: 'fr',
  });
  assert.deepEqual(normalizeConfig(null), normalizeConfig(DEFAULT_CONFIG));
});

test('commune codes: INSEE, Corsica, overseas, duplicates and mistakes', () => {
  assert.deepEqual(parseCommuneCodes('45234 2a004, 97411;45234 Paris 4523'), {
    codes: ['45234', '2A004', '97411'],
    invalid: ['Paris', '4523'],
  });
  assert.equal(departmentOf('45234'), '45');
  assert.equal(departmentOf('2A004'), '2A');
  assert.equal(departmentOf('97411'), '974');
});

test('site codes: plain, Corsica, from the address of their page', () => {
  assert.deepEqual(
    parseSiteCodes(
      '030002007, 02a000123 https://baignades.sante.gouv.fr/baignades/consultSite.do?dptddass=072&site=072000916&annee=2025 plage',
    ),
    { codes: ['030002007', '02A000123', '072000916'], invalid: ['plage'] },
  );
  assert.equal(siteCodeOf('consultSite.do?annee=2026&site=017000619'), '017000619');
  assert.equal(siteCodeOf('45234'), null);
});

test('selects outside their options fall back to the defaults', () => {
  const config = normalizeConfig({ bathing_around: '7', language: 'it' });
  assert.equal(config.bathingAround, 'commune');
  assert.equal(config.language, 'fr');
  assert.equal(normalizeConfig({ bathing_around: '0' }).bathingAround, 'none');
  assert.equal(normalizeConfig({ bathing_around: '20' }).bathingAround, 20);
});

test('the house: its selector, empty or missing means the first located house', () => {
  assert.equal(normalizeConfig({ house: ' maison-2 ' }).houseSelector, 'maison-2');
  assert.equal(normalizeConfig({ house: '' }).houseSelector, null);
  assert.equal(normalizeConfig({ house: null }).houseSelector, null);
});
