// -----------------------------------------------------------------------------
// The two kinds of devices (couples checked against the Gladys front, v5.2.1,
// see test/gladys-rules.test.js).
//
// "Tap water · <commune>", one per followed commune (platform id: the INSEE
// code, stable for the life of the commune):
//   - bacteriological, physico_chemical  risk/integer: the conformity to the
//     quality LIMITS of the newest sample that assessed that group, on the
//     scale of the Gladys risk badge (0 compliant, green; 1 compliant under a
//     derogation, yellow; 3 non-compliant, red);
//   - conclusion   text/text: the sanitary conclusion of the newest sample, as
//     the regional health agency wrote it;
//   - sample_date  text/text: the day of the newest sample;
//   - nitrates, hardness, chlorine  unknown/unknown: Gladys has no unit for
//     mg/L nor for the French degree (°f), so these numbers are published
//     without a unit and their name says it; three features share the type, so
//     the dashboard shows their names;
//   - ph  ph-sensor/decimal, unit pH.
//
// "<bathing site>", one per followed site (platform id: its code on
// baignades.sante.gouv.fr, e.g. 076002097):
//   - quality      risk/integer: 0 good, 1 average, 2 poor, 3 bathing
//     prohibited; only published while there is a current result;
//   - result       text/text: the same in words, or "Off season"…;
//   - sample_date  text/text: the day of the last sample;
//   - season       text/text: open until…, closed, all year round overseas.
//
// Published with should_poll: false: the refresh runs in the container
// (src/monitor.js), once a day.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { VALUES } from './messages.js';

export const TAP = 'tap';
export const BATHING = 'bathing';

export const TAP_FEATURES = [
  'bacteriological',
  'physico_chemical',
  'conclusion',
  'sample_date',
  'nitrates',
  'hardness',
  'chlorine',
  'ph',
];
export const BATHING_FEATURES = ['quality', 'result', 'sample_date', 'season'];

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    bacteriological: 'Bacteriological compliance',
    physico_chemical: 'Physico-chemical compliance',
    conclusion: 'Health conclusion',
    sample_date: 'Last sample',
    nitrates: 'Nitrates (mg/L)',
    hardness: 'Hardness (°f)',
    chlorine: 'Chlorine (mg/L)',
    ph: 'pH',
    quality: 'Water quality',
    result: 'Last result',
    season: 'Bathing season',
  },
  fr: {
    bacteriological: 'Conformité bactériologique',
    physico_chemical: 'Conformité physico-chimique',
    conclusion: 'Conclusion sanitaire',
    sample_date: 'Dernier prélèvement',
    nitrates: 'Nitrates (mg/L)',
    hardness: 'Dureté (°f)',
    chlorine: 'Chlore (mg/L)',
    ph: 'pH',
    quality: "Qualité de l'eau",
    result: 'Dernier résultat',
    season: 'Saison de baignade',
  },
  de: {
    bacteriological: 'Bakteriologische Konformität',
    physico_chemical: 'Physikalisch-chemische Konformität',
    conclusion: 'Gesundheitliches Fazit',
    sample_date: 'Letzte Probe',
    nitrates: 'Nitrat (mg/L)',
    hardness: 'Wasserhärte (°f)',
    chlorine: 'Chlor (mg/L)',
    ph: 'pH-Wert',
    quality: 'Wasserqualität',
    result: 'Letztes Ergebnis',
    season: 'Badesaison',
  },
  es: {
    bacteriological: 'Conformidad bacteriológica',
    physico_chemical: 'Conformidad fisicoquímica',
    conclusion: 'Conclusión sanitaria',
    sample_date: 'Última muestra',
    nitrates: 'Nitratos (mg/L)',
    hardness: 'Dureza (°f)',
    chlorine: 'Cloro (mg/L)',
    ph: 'pH',
    quality: 'Calidad del agua',
    result: 'Último resultado',
    season: 'Temporada de baño',
  },
};

// Display bounds (Gladys never applies them to a value): enough for the
// waters of France, the limit for nitrates being 50 mg/L.
const BOUNDS = {
  nitrates: [0, 100],
  hardness: [0, 80],
  chlorine: [0, 5],
  ph: [0, 14],
  risk: [0, 3],
};

/** External ids of a device and of its features. */
export function idsOf(gladys, kind, code) {
  const ids = gladys.externalIds(kind, code);
  const features = kind === TAP ? TAP_FEATURES : BATHING_FEATURES;
  return {
    device: ids.device,
    ...Object.fromEntries(features.map((key) => [key, ids.feature(key)])),
  };
}

/** `{ kind, code }` of a device or feature external id of this integration, or null. */
export function parseId(gladys, externalId) {
  if (typeof externalId !== 'string') {
    return null;
  }
  for (const kind of [TAP, BATHING]) {
    const prefix = gladys.externalIds(kind, '').device;
    if (externalId.startsWith(prefix)) {
      const code = externalId.slice(prefix.length).split(':')[0];
      return code ? { kind, code } : null;
    }
  }
  return null;
}

const sensor = (name, externalId, category, type, [min, max], extra = {}) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  min,
  max,
  ...extra,
});

const text = (name, externalId) =>
  sensor(name, externalId, CATEGORIES.TEXT, TYPES.TEXT.TEXT, [0, 0], { keep_history: false });

/**
 * The discovery payload of a commune's tap water.
 * @param {object} gladys
 * @param {{ code: string, name: string, distributor?: string|null, networks?: string[] }} commune
 * @param {string} language language of the names
 */
export function buildTapDevice(gladys, commune, language = 'fr') {
  const ids = idsOf(gladys, TAP, commune.code);
  const names = NAMES[language] ?? NAMES.fr;
  const risk = (key) =>
    sensor(names[key], ids[key], CATEGORIES.RISK, TYPES.RISK.INTEGER, BOUNDS.risk, {
      keep_history: true,
    });
  const number = (key) =>
    sensor(names[key], ids[key], CATEGORIES.UNKNOWN, TYPES.UNKNOWN.UNKNOWN, BOUNDS[key], {
      keep_history: true,
    });
  const params = [{ name: 'INSEE_CODE', value: commune.code }];
  if (commune.distributor) {
    params.push({ name: 'DISTRIBUTOR', value: commune.distributor });
  }
  if (commune.networks?.length > 0) {
    params.push({ name: 'NETWORKS', value: commune.networks.join(', ') });
  }
  return {
    name: (VALUES[language] ?? VALUES.fr).tapDevice({ name: commune.name }),
    external_id: ids.device,
    model: "Hub'Eau",
    should_poll: false,
    params,
    features: [
      risk('bacteriological'),
      risk('physico_chemical'),
      text(names.conclusion, ids.conclusion),
      text(names.sample_date, ids.sample_date),
      number('nitrates'),
      number('hardness'),
      number('chlorine'),
      sensor(names.ph, ids.ph, CATEGORIES.PH_SENSOR, TYPES.SENSOR.DECIMAL, BOUNDS.ph, {
        unit: UNITS.PH,
        keep_history: true,
      }),
    ],
  };
}

/**
 * The discovery payload of a bathing site.
 * @param {object} gladys
 * @param {{ code: string, name: string, commune?: string|null }} site
 * @param {string} language language of the names
 */
export function buildBathingDevice(gladys, site, language = 'fr') {
  const ids = idsOf(gladys, BATHING, site.code);
  const names = NAMES[language] ?? NAMES.fr;
  const params = [{ name: 'SITE_CODE', value: site.code }];
  if (site.commune) {
    params.push({ name: 'INSEE_CODE', value: site.commune });
  }
  return {
    name: site.name,
    external_id: ids.device,
    model: 'baignades.sante.gouv.fr',
    should_poll: false,
    params,
    features: [
      sensor(names.quality, ids.quality, CATEGORIES.RISK, TYPES.RISK.INTEGER, BOUNDS.risk, {
        keep_history: true,
      }),
      text(names.result, ids.result),
      text(names.sample_date, ids.sample_date),
      text(names.season, ids.season),
    ],
  };
}
