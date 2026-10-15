// -----------------------------------------------------------------------------
// The Hub'Eau client on the recorded answer of Orléans and on rows in its
// shape: samples, conformities, parameters, numbers written with a comma and
// results under the limit of quantification.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HubEau,
  latestParameters,
  numberOf,
  summarizeSamples,
  waterQualityOf,
} from '../src/hubeau.js';
import {
  RECORDED_SAMPLE,
  ROUTINE_SAMPLE,
  createApi,
  fixture,
  sampleRows,
} from './helpers/world.js';

const recorded = fixture('hubeau/resultats_dis-45234-1340.json');

test('the recorded row: one compliant sample, its networks without duplicates', () => {
  const [sample] = summarizeSamples(recorded.data);
  assert.deepEqual(sample, {
    code: '04500170259',
    at: Date.parse('2026-05-11T13:59:00Z'),
    commune: '45234',
    communeName: 'ORLEANS',
    distributor: 'SUEZ AQUALIGE',
    conclusion:
      "Eau d'alimentation conforme aux exigences de qualité en vigueur pour l'ensemble des paramètres mesurés.",
    bacteriological: 'C',
    physicoChemical: 'C',
    referencesBacteriological: 'C',
    referencesPhysicoChemical: 'C',
    networks: ['ORLEANS', 'SAINT JEAN DE LA RUELLE', 'ORLEANS-ST JEAN LE BLANC-ST PRYVÉ'],
  });
  assert.deepEqual(latestParameters(recorded.data).nitrates, {
    code: 'NO3',
    at: Date.parse('2026-05-11T13:59:00Z'),
    value: 3.5,
    text: '3,50',
    below: false,
    unit: 'mg/L',
    limit: '<=50 mg/L',
    reference: null,
  });
});

test('the conformity of each group comes from the newest sample that assessed it', () => {
  const samples = summarizeSamples([...sampleRows(RECORDED_SAMPLE), ...sampleRows(ROUTINE_SAMPLE)]);
  assert.deepEqual(
    samples.map((sample) => sample.code),
    [ROUTINE_SAMPLE.code, RECORDED_SAMPLE.code],
  );
  const quality = waterQualityOf(samples);
  assert.equal(quality.latest.code, ROUTINE_SAMPLE.code);
  assert.deepEqual(quality.bacteriological, {
    value: 'C',
    at: ROUTINE_SAMPLE.at,
    sample: ROUTINE_SAMPLE.code,
  });
  assert.deepEqual(quality.physicoChemical, {
    value: 'C',
    at: RECORDED_SAMPLE.at,
    sample: RECORDED_SAMPLE.code,
  });
  assert.deepEqual(waterQualityOf([]), {
    latest: null,
    bacteriological: null,
    physicoChemical: null,
  });
});

test('parameters: the newest of each, "<" as zero, total chlorine only without free chlorine', () => {
  const found = latestParameters([
    ...sampleRows(RECORDED_SAMPLE),
    ...sampleRows({ code: 'X', at: Date.parse('2026-08-01T08:00:00Z'), params: { CL2TOT: 0.3 } }),
  ]);
  assert.equal(found.chlorine.value, 0);
  assert.equal(found.chlorine.text, '<0,10');
  assert.equal(found.chlorine.below, true);
  assert.equal(found.chlorine.code, 'CL2LIB');
  const total = latestParameters(
    sampleRows({ code: 'Y', at: Date.parse('2026-08-01T08:00:00Z'), params: { CL2TOT: 0.3 } }),
  );
  assert.equal(total.chlorine.code, 'CL2TOT');
  assert.equal(total.chlorine.value, 0.3);
});

test('numbers: plain, with a comma, or not a number', () => {
  assert.equal(numberOf(3.5), 3.5);
  assert.equal(numberOf('3,50'), 3.5);
  assert.equal(numberOf(' 12 '), 12);
  assert.equal(numberOf('SANS OBJET'), null);
  assert.equal(numberOf(Number.NaN), null);
  assert.equal(numberOf(null), null);
});

test('the requests: the commune, the window, the fields, newest first', async () => {
  const api = createApi();
  const hubeau = new HubEau({ fetch: api.fetch });
  await hubeau.samples('45234', Date.parse('2025-08-20T08:00:00Z'));
  await hubeau.parameters('45234', Date.parse('2024-08-20T08:00:00Z'));
  const [samples, ...parameters] = api.requests.map((url) => Object.fromEntries(url.searchParams));
  assert.equal(api.requests[0].pathname, '/api/v1/qualite_eau_potable/resultats_dis');
  assert.equal(samples.code_commune, '45234');
  assert.equal(samples.date_min_prelevement, '2025-08-20');
  assert.equal(samples.sort, 'desc');
  assert.match(samples.fields, /conformite_limites_bact_prelevement/);
  // One request per parameter; total chlorine is not asked: free chlorine is measured.
  assert.deepEqual(
    parameters.map((params) => params.code_parametre_se),
    ['NO3', 'TH', 'CL2LIB', 'PH'],
  );
  assert.equal(parameters[0].date_min_prelevement, '2024-08-20');
});

test('an answer without a data list is an error, not an empty commune', async () => {
  const hubeau = new HubEau({
    fetch: async () => ({ status: 200, text: async () => '{"message":"maintenance"}' }),
  });
  await assert.rejects(hubeau.samples('45234', 0), /unexpected answer/);
  const broken = new HubEau({ fetch: async () => ({ status: 200, text: async () => '<html>' }) });
  await assert.rejects(broken.samples('45234', 0), /not JSON/);
});
