// -----------------------------------------------------------------------------
// baignades.sante.gouv.fr, the public site of the Ministry of Health for the
// quality of the bathing waters (sea, lakes, rivers): the results of the
// sanitary control the regional health agencies (ARS) run during the bathing
// season, and the bans. Hub'Eau has no bathing-water API: this site is the
// source, read the way the Ministry's own Recosante service reads it
// (github.com/SocialGouv/recosante, Apache-2.0):
//
//   - `siteList.do?idCarte=…&insee_com=…&code_dept=…&f=json` lists the sites of
//     a commune as JSON: `{ "sites": [{ "isite": "002097", "nom": "…" }] }`;
//   - a site is known by its department on 3 characters ("076", "02A", "974")
//     followed by its `isite`: 076002097;
//   - `consultSite.do?dptddass=…&site=…&annee=…` is the HTML page of a site
//     for one season: the dates of the season ("Début de la saison",
//     "Fin de la saison"), the bans ("Interdiction de baignade du …") and one
//     row per sample, marked by a round arrow image, its date and its result
//     ("Bon", "Moyen", "Mauvais").
//
// The page is HTML, not an API: the parser below looks for those labels in the
// text of the cells, accents and case ignored, and never fails on a page it
// does not understand (the fields stay null). `scripts/probe.mjs` shows what it
// reads on the live site.
// -----------------------------------------------------------------------------

import { HttpError, getJson, getText } from './http.js';

export const BAIGNADES_BASE = 'https://baignades.sante.gouv.fr/baignades';

// The map of the site a department belongs to; departments without a bathing
// control published there (975, 977, 978, 98x) have none.
const OVERSEAS_MAPS = { 971: 'gua', 972: 'mar', 973: 'guy', 974: 'reu', 976: 'may' };
const NO_MAP = new Set(['975', '977', '978', '984', '986', '987', '988', '989']);

/** The `idCarte` of a department, null when the site does not cover it. */
export function mapOf(department) {
  if (NO_MAP.has(department)) {
    return null;
  }
  return OVERSEAS_MAPS[department] ?? 'fra';
}

/** Overseas, bathing is all year round: there is no season. */
export const isOverseas = (department) => OVERSEAS_MAPS[department] !== undefined;

/** The 3-character department of the site codes: "76" → "076", "2A" → "02A". */
export const dptddassOf = (department) => department.padStart(3, '0');

/** The department of a site code: "076002097" → "76", "02A000123" → "2A", "974000001" → "974". */
export function departmentOfSite(code) {
  const prefix = code.slice(0, 3);
  return prefix.startsWith('97') ? prefix : prefix.slice(1);
}

/** The page of a site on baignades.sante.gouv.fr (the link of the widget and the docs). */
export function sitePage(code, year) {
  const params = new URLSearchParams({ dptddass: code.slice(0, 3), site: code });
  if (year) {
    params.set('annee', String(year));
  }
  return `${BAIGNADES_BASE}/consultSite.do?${params}`;
}

/** The sites of one `siteList.do` answer, as `{ code, name }`. */
export function parseSiteList(body, department) {
  const prefix = dptddassOf(department);
  const sites = [];
  for (const raw of Array.isArray(body?.sites) ? body.sites : []) {
    const isite = String(raw?.isite ?? '').trim();
    const name = typeof raw?.nom === 'string' ? raw.nom.trim() : '';
    if (!/^[0-9A-Za-z]+$/.test(isite)) {
      continue;
    }
    // `isite` is the local part (6 digits); a full code is kept as it is.
    const code = (
      isite.length === 9 && isite.startsWith(prefix) ? isite : `${prefix}${isite.padStart(6, '0')}`
    ).toUpperCase();
    sites.push({ code, name: name || code });
  }
  return sites;
}

// --- The page of a site ------------------------------------------------------------

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  acirc: 'â',
  ccedil: 'ç',
  icirc: 'î',
  ocirc: 'ô',
  ucirc: 'û',
  ugrave: 'ù',
  Eacute: 'É',
};

/** The text of an HTML fragment: tags removed, entities decoded, spaces collapsed. */
export function textOf(html) {
  return String(html)
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === '#') {
        const code =
          entity[1] === 'x' || entity[1] === 'X'
            ? parseInt(entity.slice(2), 16)
            : Number(entity.slice(1));
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lower case without accents, to look for a label whatever its spelling. */
export const fold = (value) => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const DATE = /(\d{2})\/(\d{2})\/(\d{4})/g;

/** Every dd/mm/yyyy of a text, as `YYYY-MM-DD`. */
export function datesIn(value) {
  return [...String(value).matchAll(DATE)].map(([, day, month, year]) => `${year}-${month}-${day}`);
}

/** The rows of a page, each with its cells: `{ html, text, cells: [text] }`. */
function rowsOf(html) {
  return String(html)
    .split(/<tr\b/i)
    .slice(1)
    .map((chunk) => {
      const rowHtml = chunk.split(/<\/tr>/i)[0];
      const cells = rowHtml
        .split(/<t[dh]\b/i)
        .slice(1)
        .map((cell) => textOf(`<x${cell}`));
      return { html: rowHtml, text: textOf(`<x${rowHtml}`), cells };
    });
}

/** The first date found in the cell holding a label, or in the cell after it. */
function dateAfterLabel(rows, label) {
  for (const row of [...rows].reverse()) {
    const index = row.cells.findIndex((cell) => fold(cell).includes(label));
    if (index === -1) {
      continue;
    }
    const [date] = [...datesIn(row.cells[index]), ...datesIn(row.cells[index + 1] ?? '')];
    if (date) {
      return date;
    }
  }
  return null;
}

const RESULTS = { bon: 'good', moyen: 'average', mauvais: 'poor' };

/** The result word ending a sample row: "… 12/08/2026 … Bon" → 'good'. */
function resultOf(text) {
  const last = fold(text).match(/([a-z]+)\W*$/);
  return last ? (RESULTS[last[1]] ?? null) : null;
}

/**
 * What a `consultSite.do` page says:
 *   - `seasonStart`, `seasonEnd`: `YYYY-MM-DD` or null;
 *   - `bans`: the bans listed, `{ from, to }` (`to` null when open-ended);
 *   - `samples`: `{ date, result }` oldest first, `result` 'good', 'average',
 *     'poor', or null when the row gives none ("Non renseigné").
 */
export function parseSitePage(html) {
  const rows = rowsOf(html);
  const bans = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      if (fold(cell).includes('interdiction de baignade du')) {
        const [from, to = null] = datesIn(cell);
        if (from && !bans.some((ban) => ban.from === from && ban.to === to)) {
          bans.push({ from, to });
        }
      }
    }
  }
  // The sample rows carry the round arrow that opens their detail; a page
  // without it still has rows "date … result".
  const marked = rows.filter((row) => /fleche_ronde/i.test(row.html));
  const candidates = marked.length > 0 ? marked : rows;
  const samples = [];
  for (const row of candidates) {
    const [date] = datesIn(row.text);
    if (!date) {
      continue;
    }
    const result = resultOf(row.text);
    if (result === null && marked.length === 0) {
      continue;
    }
    samples.push({ date, result });
  }
  samples.sort((a, b) => a.date.localeCompare(b.date));
  // "Qualité des eaux de baignade > LE MOULINET - BEAU RIVAGE": the name of the site.
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html));
  const titleParts = title ? textOf(title[1]).split('>') : [];
  return {
    name: titleParts.length > 1 ? titleParts.at(-1).trim() || null : null,
    seasonStart: dateAfterLabel(rows, 'debut de la saison'),
    seasonEnd: dateAfterLabel(rows, 'fin de la saison'),
    bans,
    samples,
  };
}

/** The ban in force on a day (`YYYY-MM-DD`), or null. */
export const banOn = (bans, day) =>
  bans.find((ban) => ban.from <= day && (ban.to === null || ban.to >= day)) ?? null;

export class Baignades {
  /**
   * @param {object} [options]
   * @param {Function} [options.fetch]
   */
  constructor({ fetch: fetchImpl } = {}) {
    this.fetch = fetchImpl ?? globalThis.fetch;
  }

  /** The bathing sites of a commune (`[]` when it has none or is not covered). */
  async sitesOfCommune(commune, department) {
    const map = mapOf(department);
    if (!map) {
      return [];
    }
    const params = new URLSearchParams({
      idCarte: map,
      insee_com: commune,
      code_dept: department,
      f: 'json',
    });
    const body = await getJson(this.fetch, `${BAIGNADES_BASE}/siteList.do?${params}`);
    if (!body || typeof body !== 'object') {
      throw new HttpError('baignades.sante.gouv.fr: unexpected answer (no site list)');
    }
    return parseSiteList(body, department).map((site) => ({ ...site, commune }));
  }

  /** The page of a site for a season, parsed (see parseSitePage). */
  async site(code, year) {
    const html = await getText(this.fetch, sitePage(code, year));
    return parseSitePage(html);
  }
}
