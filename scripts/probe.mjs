#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Read-only probe of the live services, for a machine that has the network
// (the development session could reach none of them). It runs the very clients
// of the integration and prints what they would publish, plus what the HTML
// parser relies on, so a change of the services shows at once.
//
//   node scripts/probe.mjs <INSEE code> [--site <code>]... [--near <lat>,<lon>] [--raw <dir>]
//
//   <INSEE code>  a commune, e.g. 45234 (Orléans): its tap water from Hub'Eau,
//                 its bathing sites from baignades.sante.gouv.fr;
//   --site        also read the page of this bathing site (e.g. 030002007);
//   --near        list the communes within 10 km of a point with
//                 geo.api.gouv.fr (give public coordinates, e.g. a town hall);
//   --raw <dir>   also save the raw answers there, to refresh test/fixtures.
//
// Nothing is written anywhere else; no account, no key, nothing sensitive.
// -----------------------------------------------------------------------------

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Baignades, fold, parseSitePage, sitePage, textOf } from '../src/baignades.js';
import { departmentOf, isCommuneCode, siteCodeOf } from '../src/config.js';
import { Geo } from '../src/geo.js';
import { HubEau, dayOf, waterQualityOf } from '../src/hubeau.js';
import { decodePage } from '../src/http.js';

const args = process.argv.slice(2);
const commune = args.find((arg) => isCommuneCode(arg))?.toUpperCase();
const option = (name) =>
  args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]] : []));
const sites = option('--site').map(siteCodeOf).filter(Boolean);
const [near] = option('--near');
const [rawDir] = option('--raw');

if (!commune && sites.length === 0) {
  console.error(
    'Usage: node scripts/probe.mjs <INSEE code> [--site <code>]... [--near <lat>,<lon>] [--raw <dir>]',
  );
  process.exit(2);
}

// Every answer goes through here, so --raw can keep it as received.
let count = 0;
async function recordingFetch(url, init) {
  const response = await fetch(url, init);
  if (!rawDir) {
    return response;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  count += 1;
  const host = new URL(url).host.split('.')[0];
  const path = new URL(url).pathname.split('/').pop().replace(/\W+/g, '-');
  const file = join(rawDir, `${String(count).padStart(2, '0')}-${host}-${path}.raw`);
  await mkdir(rawDir, { recursive: true });
  await writeFile(file, bytes);
  await writeFile(
    `${file}.url`,
    `${url}\n${response.status} ${response.headers.get('content-type')}\n`,
  );
  return new Response(bytes, { status: response.status, headers: response.headers });
}

const section = (title) => console.log(`\n=== ${title} ===`);
const now = Date.now();
let failures = 0;

async function step(title, fn) {
  section(title);
  try {
    await fn();
  } catch (err) {
    failures += 1;
    console.log(`FAILED: ${err.message}`);
  }
}

if (commune) {
  const hubeau = new HubEau({ fetch: recordingFetch });
  await step(`Hub'Eau, tap water of ${commune}`, async () => {
    const samples = await hubeau.samples(commune, now - 365 * 24 * 3600 * 1000);
    console.log(`${samples.length} sample(s) in a year`);
    for (const sample of samples.slice(0, 5)) {
      console.log(
        `  ${dayOf(sample.at)} ${sample.code} bact=${sample.bacteriological} pc=${sample.physicoChemical} refs=${sample.referencesBacteriological}/${sample.referencesPhysicoChemical} networks=${sample.networks.join(' | ')}`,
      );
    }
    const quality = waterQualityOf(samples);
    console.log('Would publish:');
    console.log(
      `  commune: ${quality.latest?.communeName}, distributor: ${quality.latest?.distributor}`,
    );
    console.log(`  bacteriological: ${JSON.stringify(quality.bacteriological)}`);
    console.log(`  physico-chemical: ${JSON.stringify(quality.physicoChemical)}`);
    console.log(`  conclusion: ${quality.latest?.conclusion}`);
    const parameters = await hubeau.parameters(commune, now - 2 * 365 * 24 * 3600 * 1000);
    for (const [key, value] of Object.entries(parameters)) {
      console.log(
        `  ${key}: ${value.value} (${value.code}, "${value.text}" ${value.unit ?? ''}, ${dayOf(value.at)}, limit ${value.limit ?? '-'})`,
      );
    }
    if (Object.keys(parameters).length === 0) {
      console.log('  no nitrates, hardness, chlorine nor pH in two years');
    }
  });

  await step(`geo.api.gouv.fr, commune ${commune}`, async () => {
    console.log(JSON.stringify(await new Geo({ fetch: recordingFetch }).commune(commune)));
  });

  await step(`baignades.sante.gouv.fr, bathing sites of ${commune}`, async () => {
    const found = await new Baignades({ fetch: recordingFetch }).sitesOfCommune(
      commune,
      departmentOf(commune),
    );
    console.log(`${found.length} site(s)`);
    for (const site of found) {
      console.log(`  ${site.code} ${site.name}`);
    }
    sites.push(...found.slice(0, 3).map((site) => site.code));
  });
}

if (near) {
  await step(`geo.api.gouv.fr, communes within 10 km of ${near}`, async () => {
    const [lat, lon] = near.split(',').map(Number);
    const around = await new Geo({ fetch: recordingFetch }).communesAround(lat, lon, 10);
    for (const item of around) {
      console.log(`  ${item.code} ${item.name} ${item.km.toFixed(1)} km`);
    }
  });
}

const year = new Date().getFullYear();
for (const code of [...new Set(sites)]) {
  await step(`baignades.sante.gouv.fr, page of ${code} (${year})`, async () => {
    const response = await recordingFetch(sitePage(code, year), {
      headers: { Accept: 'text/html' },
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    console.log(
      `HTTP ${response.status}, ${bytes.length} bytes, ${response.headers.get('content-type')}`,
    );
    const html = decodePage(bytes, response.headers.get('content-type'));
    // What the parser looks for, as found on the page.
    const text = textOf(html);
    for (const label of [
      'debut de la saison',
      'fin de la saison',
      'interdiction de baignade',
      'classement',
    ]) {
      const index = fold(text).indexOf(label);
      console.log(
        `  "${label}": ${index === -1 ? 'absent' : `"${text.slice(index, index + 70)}"`}`,
      );
    }
    console.log(`  round arrows (sample rows): ${(html.match(/fleche_ronde/gi) ?? []).length}`);
    console.log('Parsed:');
    console.log(JSON.stringify(parseSitePage(html), null, 2));
  });
}

console.log(failures === 0 ? '\nAll steps answered.' : `\n${failures} step(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
