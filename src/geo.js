// -----------------------------------------------------------------------------
// Where the house is, in communes: the API Découpage administratif of the
// French State (geo.api.gouv.fr, keyless, Licence Ouverte Etalab 2.0, 50
// requests per second and per address at most).
//
//   - `communes?lat=…&lon=…` answers the commune holding a point;
//   - `departements/{code}/communes?fields=code,nom,centre` the communes of a
//     department with their centre (GeoJSON point, longitude first).
//
// The house coordinates sent are rounded to 3 decimals (about 100 m): enough
// to find the commune, and never written to /data or to the logs.
// -----------------------------------------------------------------------------

import { HttpError, getJson } from './http.js';

export const GEO_BASE = 'https://geo.api.gouv.fr';

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = 111.32;
const rad = (degrees) => (degrees * Math.PI) / 180;
const round = (value) => Number(value.toFixed(3));

/** Great-circle distance in km (haversine). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The point `km` away from another, towards a bearing in degrees (flat Earth: a few km). */
export function pointAt(latitude, longitude, km, bearing) {
  const dLat = (km * Math.cos(rad(bearing))) / KM_PER_DEGREE;
  const dLon =
    (km * Math.sin(rad(bearing))) / (KM_PER_DEGREE * Math.max(0.01, Math.cos(rad(latitude))));
  return { latitude: latitude + dLat, longitude: longitude + dLon };
}

const commune = (raw) => {
  if (typeof raw?.code !== 'string' || raw.code === '') {
    return null;
  }
  const [lon, lat] = Array.isArray(raw.centre?.coordinates) ? raw.centre.coordinates : [];
  return {
    code: raw.code,
    name: typeof raw.nom === 'string' ? raw.nom : raw.code,
    department: typeof raw.codeDepartement === 'string' ? raw.codeDepartement : null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
  };
};

export class Geo {
  /**
   * @param {object} [options]
   * @param {Function} [options.fetch]
   */
  constructor({ fetch: fetchImpl } = {}) {
    this.fetch = fetchImpl ?? globalThis.fetch;
  }

  async list(path, params) {
    const body = await getJson(this.fetch, `${GEO_BASE}/${path}?${new URLSearchParams(params)}`);
    if (!Array.isArray(body)) {
      throw new HttpError('geo.api.gouv.fr: unexpected answer (no list)');
    }
    return body.map(commune).filter(Boolean);
  }

  /** The commune holding a point (`{ code, name, department }`), null at sea or abroad. */
  async communeAt(latitude, longitude) {
    const [found] = await this.list('communes', {
      lat: String(round(latitude)),
      lon: String(round(longitude)),
      fields: 'code,nom,codeDepartement',
      format: 'json',
    });
    return found ?? null;
  }

  /** A commune by its INSEE code (`{ code, name, department }`), null when unknown. */
  async commune(code) {
    try {
      const body = await getJson(
        this.fetch,
        `${GEO_BASE}/communes/${encodeURIComponent(code)}?${new URLSearchParams({
          fields: 'code,nom,codeDepartement',
          format: 'json',
        })}`,
      );
      return commune(body);
    } catch (err) {
      if (err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /** The communes of a department with their centre. */
  async communesOfDepartment(department) {
    const communes = await this.list(`departements/${encodeURIComponent(department)}/communes`, {
      fields: 'code,nom,centre,codeDepartement',
      format: 'json',
    });
    return communes.map((item) => ({ ...item, department: item.department ?? department }));
  }

  /**
   * The communes whose centre lies within `km` of a point, nearest first, the
   * commune of the point included: the departments are those of the point and
   * of 8 points on the circle (a border or a coast nearby).
   */
  async communesAround(latitude, longitude, km) {
    const points = [
      { latitude, longitude },
      ...[0, 45, 90, 135, 180, 225, 270, 315].map((bearing) =>
        pointAt(latitude, longitude, km, bearing),
      ),
    ];
    const departments = new Set();
    let home = null;
    for (const [index, point] of points.entries()) {
      const found = await this.communeAt(point.latitude, point.longitude);
      if (found?.department) {
        departments.add(found.department);
      }
      if (index === 0) {
        home = found;
      }
    }
    const around = new Map();
    for (const department of departments) {
      for (const item of await this.communesOfDepartment(department)) {
        if (item.latitude === null) {
          continue;
        }
        const distance = distanceKm(latitude, longitude, item.latitude, item.longitude);
        if (distance <= km || item.code === home?.code) {
          around.set(item.code, { ...item, km: distance });
        }
      }
    }
    return [...around.values()].sort((a, b) => a.km - b.km);
  }
}
