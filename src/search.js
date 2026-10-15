// -----------------------------------------------------------------------------
// The "Find bathing sites" configuration action: lists the bathing sites of a
// commune, or of the communes around the house, with their code, so the user
// can copy the ones to follow into the configuration.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { isCommuneCode } from './config.js';
import { SEARCH, formatNumber, render } from './messages.js';

const logger = createLogger({ name: 'qualite-eau-search' });

export const SEARCH_RADII = ['5', '10', '20'];
const DEFAULT_RADIUS_KM = 10;
const MAX_COMMUNES = 40;
const MAX_RESULTS = 20;

/** Candidate sites `{ code, name, communeName, km }` of the action fields, or `{ error }`. */
async function candidates(monitor, commune, radiusKm) {
  if (commune) {
    if (!isCommuneCode(commune)) {
      return { error: 'invalid' };
    }
    const code = commune.toUpperCase();
    await monitor.lookupName(code);
    const name = monitor.data.names[code]?.name ?? code;
    const sites = await monitor.sitesOfCommune(code);
    return { sites: sites.map((site) => ({ ...site, communeName: name, km: null })) };
  }
  const { house, problem } = await monitor.findHouse();
  if (!house) {
    return { error: problem.key, params: { name: problem.name } };
  }
  const communes = (
    await monitor.geo.communesAround(house.latitude, house.longitude, radiusKm)
  ).slice(0, MAX_COMMUNES);
  if (communes.length === 0) {
    return { error: 'noCommune' };
  }
  const sites = [];
  for (const [index, item] of communes.entries()) {
    if (index > 0) {
      await monitor.sleep(monitor.timings.requestSpacingMs);
    }
    for (const site of await monitor.sitesOfCommune(item.code)) {
      sites.push({ ...site, communeName: item.name, km: item.km });
    }
  }
  return { sites };
}

/**
 * Handler of the `find_bathing_sites` action.
 * @param {import('./monitor.js').Monitor} monitor
 * @param {{ commune?: string, radius?: string }} fields
 */
export async function findBathingSites(monitor, fields = {}) {
  const commune = typeof fields.commune === 'string' ? fields.commune.trim() : '';
  const radiusKm = SEARCH_RADII.includes(String(fields.radius))
    ? Number(fields.radius)
    : DEFAULT_RADIUS_KM;
  try {
    const found = await candidates(monitor, commune, radiusKm);
    if (found.error) {
      return render(SEARCH, found.error, found.params);
    }
    const listed = [...new Map(found.sites.map((site) => [site.code, site])).values()].slice(
      0,
      MAX_RESULTS,
    );
    logger.info(`Bathing site search: ${listed.length} site(s) found`);
    await monitor.save();
    if (listed.length === 0) {
      return render(SEARCH, 'none');
    }
    return Object.fromEntries(
      Object.keys(SEARCH).map((language) => {
        const lines = listed.map((site) => {
          const where =
            site.km === null
              ? site.communeName
              : `${site.communeName}, ${formatNumber(site.km, language, 1)} km`;
          return `${site.code} — ${site.name} (${where})`;
        });
        return [
          language,
          `${SEARCH[language].found({ count: listed.length })}\n${lines.join('\n')}`,
        ];
      }),
    );
  } catch (err) {
    logger.warn(`Bathing site search failed: ${err.message}`);
    return render(SEARCH, 'unavailable');
  }
}
