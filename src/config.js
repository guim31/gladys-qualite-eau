// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers where they are numbers.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Bathing sites followed around the house: '0' = none, 'commune' = those of
// the communes followed for the tap water, or a distance in km.
export const BATHING_AROUND = ['0', 'commune', '5', '10', '20'];

// Upper bounds of what the configuration can follow. Each commune costs two
// Hub'Eau requests a day, each bathing site one request a day.
export const MAX_COMMUNES = 5;
export const MAX_SITES = 10;

export const DEFAULT_CONFIG = {
  // A `source: "houses"` select takes no default (store rule): empty = the
  // first house of Gladys that has a location.
  house: '',
  communes: '',
  bathing_around: 'commune',
  bathing_sites: '',
  language: 'fr',
};

// INSEE code of a commune: 5 digits, or 2A/2B and 3 digits in Corsica.
const COMMUNE_CODE = /^(?:\d{5}|2[AB]\d{3})$/;
// A bathing site of baignades.sante.gouv.fr: the 3 characters of its
// department ("076", "02A", "974") and 6 digits.
const SITE_CODE = /^(?:\d{3}|02[AB])\d{6}$/;
// The page of a site, whose address carries its code: `...consultSite.do?...site=076002097...`.
const SITE_URL = /[?&]site=([0-9A-Za-z]{9})(?:[&#]|$)/;

const tokens = (text) =>
  String(text ?? '')
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);

export const isCommuneCode = (token) => COMMUNE_CODE.test(String(token).toUpperCase());

/** Department of a commune: the first 2 characters, 3 overseas (971 to 976). */
export const departmentOf = (commune) =>
  commune.startsWith('97') ? commune.slice(0, 3) : commune.slice(0, 2);

/** A bathing site code from a code or a page address, upper-cased; null otherwise. */
export function siteCodeOf(token) {
  const fromUrl = SITE_URL.exec(token);
  const code = (fromUrl ? fromUrl[1] : String(token)).toUpperCase();
  return SITE_CODE.test(code) ? code : null;
}

/** INSEE commune codes of a free text; `invalid` lists the other tokens. */
export function parseCommuneCodes(text) {
  const codes = [];
  const invalid = [];
  for (const token of tokens(text)) {
    const code = token.toUpperCase();
    if (!isCommuneCode(code)) {
      invalid.push(token);
    } else if (!codes.includes(code)) {
      codes.push(code);
    }
  }
  return { codes, invalid };
}

/** Bathing site codes of a free text; `invalid` lists the other tokens. */
export function parseSiteCodes(text) {
  const codes = [];
  const invalid = [];
  for (const token of tokens(text)) {
    const code = siteCodeOf(token);
    if (code === null) {
      invalid.push(token);
    } else if (!codes.includes(code)) {
      codes.push(code);
    }
  }
  return { codes, invalid };
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const communes = parseCommuneCodes(source.communes);
  const sites = parseSiteCodes(source.bathing_sites);
  const around = BATHING_AROUND.includes(String(source.bathing_around))
    ? String(source.bathing_around)
    : DEFAULT_CONFIG.bathing_around;
  return {
    // The selector of the chosen house (source: "houses"), null = the first located one.
    houseSelector:
      typeof source.house === 'string' && source.house.trim() !== '' ? source.house.trim() : null,
    communeCodes: communes.codes,
    siteCodes: sites.codes,
    invalid: [...communes.invalid, ...sites.invalid],
    // 'none', 'commune' or a radius in km.
    bathingAround: around === '0' ? 'none' : around === 'commune' ? 'commune' : Number(around),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
