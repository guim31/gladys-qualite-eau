// -----------------------------------------------------------------------------
// Hub'Eau "Qualité de l'eau potable" v1
// (https://hubeau.eaufrance.fr/page/api-qualite-eau-potable): the results of
// the sanitary control of the tap water, commune by commune, keyless, under
// the Licence Ouverte Etalab 2.0. The Ministry of Health publishes them about
// once a month.
//
// What the API does (see test/fixtures/README.md for the recordings):
//   - `resultats_dis` holds one row per measured parameter of a sample
//     (`code_prelevement`); the conclusions of the sample (conformity, the
//     sanitary text) are repeated on each of its rows;
//   - conformity codes: C (compliant), N (non-compliant), D (compliant under a
//     derogation granted by the prefect), S ("sans objet": that group of
//     parameters was not measured in this sample);
//   - `conformite_limites_*` are the quality LIMITS (health), `conformite_
//     references_*` the quality REFERENCES (indicators of the treatment, no
//     health risk by themselves);
//   - a page with a next one answers 206 with a `next` URL; `sort=desc` gives
//     the newest samples first;
//   - `resultat_numerique` holds the number, `resultat_alphanumerique` the
//     text as the laboratory wrote it ("3,50", "<0,05", "SANS OBJET").
// -----------------------------------------------------------------------------

import { HttpError, getJson } from './http.js';

export const HUBEAU_BASE = 'https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable';

const SAMPLE_FIELDS = [
  'code_prelevement',
  'date_prelevement',
  'code_commune',
  'nom_commune',
  'nom_distributeur',
  'conclusion_conformite_prelevement',
  'conformite_limites_bact_prelevement',
  'conformite_limites_pc_prelevement',
  'conformite_references_bact_prelevement',
  'conformite_references_pc_prelevement',
  'reseaux',
].join(',');

const PARAMETER_FIELDS = [
  'code_prelevement',
  'date_prelevement',
  'code_parametre',
  'code_parametre_se',
  'libelle_parametre',
  'resultat_numerique',
  'resultat_alphanumerique',
  'libelle_unite',
  'limite_qualite_parametre',
  'reference_qualite_parametre',
].join(',');

/**
 * The parameters the integration publishes, by key: their SISE-Eaux code
 * (`code_parametre_se`) and Sandre code (`code_parametre`). Free chlorine is
 * preferred; total chlorine stands in when only it is measured.
 */
export const PARAMETERS = {
  nitrates: [{ se: 'NO3', sandre: ['1340'] }],
  // The sources disagree on the Sandre code of the hardness: the SISE code decides.
  hardness: [{ se: 'TH', sandre: ['1345', '7972'] }],
  chlorine: [
    { se: 'CL2LIB', sandre: ['1398'] },
    { se: 'CL2TOT', sandre: ['1399'] },
  ],
  ph: [{ se: 'PH', sandre: ['1302'] }],
};

const CONFORMITY = new Set(['C', 'N', 'D', 'S']);
const MAX_PAGES = 3;

const text = (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const conformity = (value) => {
  const code = text(value)?.toUpperCase();
  return code && CONFORMITY.has(code) ? code : null;
};

/** A number from Hub'Eau: a number, or a string with a comma ("3,50"). */
export function numberOf(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(value)) {
    return Number(value.replace(',', '.'));
  }
  return null;
}

/** `YYYY-MM-DD` of a time (UTC), the date format of the `date_min_prelevement` filter. */
export const dayOf = (time) => new Date(time).toISOString().slice(0, 10);

/**
 * The samples of `resultats_dis` rows, newest first: one entry per
 * `code_prelevement`, with its conclusions.
 */
export function summarizeSamples(rows) {
  const samples = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = text(row?.code_prelevement);
    const at = Date.parse(row?.date_prelevement);
    if (!code || Number.isNaN(at) || samples.has(code)) {
      continue;
    }
    samples.set(code, {
      code,
      at,
      commune: text(row.code_commune),
      communeName: text(row.nom_commune),
      distributor: text(row.nom_distributeur),
      conclusion: text(row.conclusion_conformite_prelevement),
      bacteriological: conformity(row.conformite_limites_bact_prelevement),
      physicoChemical: conformity(row.conformite_limites_pc_prelevement),
      referencesBacteriological: conformity(row.conformite_references_bact_prelevement),
      referencesPhysicoChemical: conformity(row.conformite_references_pc_prelevement),
      networks: (Array.isArray(row.reseaux) ? row.reseaux : [])
        .map((network) => text(network?.nom))
        .filter((name, index, all) => name && all.indexOf(name) === index),
    });
  }
  return [...samples.values()].sort((a, b) => b.at - a.at);
}

/**
 * What the tap water device shows, from the samples newest first:
 *   - `latest`: the newest sample (its date and sanitary conclusion);
 *   - `bacteriological` / `physicoChemical`: the newest sample that assessed
 *     that group (not S), with its code: a routine sample often measures only
 *     a few physico-chemical parameters and no bacteria.
 */
export function waterQualityOf(samples) {
  const assessed = (key) => {
    const sample = samples.find((item) => item[key] !== null && item[key] !== 'S');
    return sample ? { value: sample[key], at: sample.at, sample: sample.code } : null;
  };
  return {
    latest: samples[0] ?? null,
    bacteriological: assessed('bacteriological'),
    physicoChemical: assessed('physicoChemical'),
  };
}

/** The latest measure of each published parameter (see PARAMETERS), from `resultats_dis` rows. */
export function latestParameters(rows) {
  const found = {};
  for (const [key, codes] of Object.entries(PARAMETERS)) {
    for (const { se, sandre } of codes) {
      let best = null;
      for (const row of Array.isArray(rows) ? rows : []) {
        if (
          text(row?.code_parametre_se) !== se &&
          text(String(row?.code_parametre ?? '')) !== sandre
        ) {
          continue;
        }
        const at = Date.parse(row.date_prelevement);
        const raw = text(row.resultat_alphanumerique);
        // "<0,05": under the limit of quantification of the laboratory.
        const below = raw?.startsWith('<') ?? false;
        const value = below ? 0 : numberOf(row.resultat_numerique);
        if (Number.isNaN(at) || value === null || (best && best.at >= at)) {
          continue;
        }
        best = {
          code: se,
          at,
          value,
          text: raw ?? String(value),
          below,
          unit: text(row.libelle_unite),
          limit: text(row.limite_qualite_parametre),
          reference: text(row.reference_qualite_parametre),
        };
      }
      if (best) {
        found[key] = best;
        break;
      }
    }
  }
  return found;
}

export class HubEau {
  /**
   * @param {object} [options]
   * @param {Function} [options.fetch]
   */
  constructor({ fetch: fetchImpl } = {}) {
    this.fetch = fetchImpl ?? globalThis.fetch;
  }

  /** Rows of a paginated query (206 + `next`), a few pages at most. */
  async rows(path, params, maxPages = MAX_PAGES) {
    let url = `${HUBEAU_BASE}/${path}?${new URLSearchParams(params)}`;
    const rows = [];
    for (let page = 0; page < maxPages && url; page += 1) {
      const body = await getJson(this.fetch, url);
      if (!body || typeof body !== 'object' || !Array.isArray(body.data)) {
        throw new HttpError("Hub'Eau: unexpected answer (no data list)");
      }
      rows.push(...body.data);
      url = typeof body.next === 'string' && body.next.startsWith(HUBEAU_BASE) ? body.next : null;
    }
    return rows;
  }

  /**
   * The samples of a commune since a time, newest first (see summarizeSamples).
   * One page of 1000 rows: the newest samples, a few months at least.
   */
  async samples(commune, since) {
    const rows = await this.rows(
      'resultats_dis',
      {
        code_commune: commune,
        date_min_prelevement: dayOf(since),
        fields: SAMPLE_FIELDS,
        sort: 'desc',
        size: '1000',
      },
      1,
    );
    return summarizeSamples(rows);
  }

  /**
   * The latest nitrates, hardness, chlorine and pH of a commune since a time:
   * one small request per parameter (filtered by its SISE code, newest first),
   * total chlorine only when free chlorine is not measured.
   */
  async parameters(commune, since) {
    const found = {};
    for (const [key, codes] of Object.entries(PARAMETERS)) {
      for (const { se } of codes) {
        const rows = await this.rows(
          'resultats_dis',
          {
            code_commune: commune,
            code_parametre_se: se,
            date_min_prelevement: dayOf(since),
            fields: PARAMETER_FIELDS,
            sort: 'desc',
            size: '5',
          },
          1,
        );
        const latest = latestParameters(rows)[key];
        if (latest) {
          found[key] = latest;
          break;
        }
      }
    }
    return found;
  }
}
