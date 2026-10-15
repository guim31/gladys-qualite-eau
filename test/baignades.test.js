// -----------------------------------------------------------------------------
// The baignades.sante.gouv.fr reader on the hand-made page (the layout the
// Recosante parser of the Ministry relies on): the season, the bans, the
// samples and their results, entities, the ISO-8859-1 charset, and pages it
// does not understand.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Baignades,
  banOn,
  departmentOfSite,
  dptddassOf,
  mapOf,
  parseSiteList,
  parseSitePage,
  sitePage,
  textOf,
} from '../src/baignades.js';
import { decodePage } from '../src/http.js';
import { createApi, fixture, fixtureText } from './helpers/world.js';

const page = fixtureText('baignades/consultSite-030002007.synthetic.html');

test('the page: name, season, bans, samples oldest first', () => {
  assert.deepEqual(parseSitePage(page), {
    name: 'LE MOULINET - BEAU RIVAGE',
    seasonStart: '2026-06-15',
    seasonEnd: '2026-08-31',
    bans: [{ from: '2026-07-12', to: '2026-07-14' }],
    samples: [
      { date: '2026-06-16', result: 'good' },
      { date: '2026-07-11', result: 'poor' },
      { date: '2026-07-14', result: 'average' },
      { date: '2026-08-04', result: 'good' },
      { date: '2026-08-18', result: null },
    ],
  });
});

test('the same page served in ISO-8859-1 reads the same', () => {
  const latin1 = Buffer.from(
    page.replace('charset=UTF-8', 'charset=ISO-8859-1').replaceAll('&eacute;', 'é'),
    'latin1',
  );
  const decoded = decodePage(new Uint8Array(latin1), 'text/html;charset=ISO-8859-1');
  assert.deepEqual(parseSitePage(decoded), parseSitePage(page));
  // Without a header, the <meta> tells.
  assert.deepEqual(parseSitePage(decodePage(new Uint8Array(latin1), null)), parseSitePage(page));
});

test('a ban without an end, a ban in force, a ban over', () => {
  const bans = [
    { from: '2026-07-12', to: '2026-07-14' },
    { from: '2026-08-20', to: null },
  ];
  assert.equal(banOn(bans, '2026-07-13'), bans[0]);
  assert.equal(banOn(bans, '2026-07-15'), null);
  assert.equal(banOn(bans, '2026-09-01'), bans[1]);
  const parsed = parseSitePage(
    '<table><tr><td>Interdiction de baignade du 20/08/2026</td></tr></table>',
  );
  assert.deepEqual(parsed.bans, [{ from: '2026-08-20', to: null }]);
});

test('labels in another cell, upper case, without accents', () => {
  const parsed = parseSitePage(
    '<table><tr><td>DEBUT DE LA SAISON</td><td>01/07/2026</td></tr><tr><th>Fin de la saison :</th><td>15/09/2026</td></tr></table>',
  );
  assert.equal(parsed.seasonStart, '2026-07-01');
  assert.equal(parsed.seasonEnd, '2026-09-15');
});

test('a page without the round arrows still gives its "date … result" rows', () => {
  const parsed = parseSitePage(
    '<table><tr><td>02/07/2026</td><td>Bon</td></tr><tr><td>Début de la saison : 15/06/2026</td></tr><tr><td>16/07/2026</td><td>Mauvais</td></tr></table>',
  );
  assert.deepEqual(parsed.samples, [
    { date: '2026-07-02', result: 'good' },
    { date: '2026-07-16', result: 'poor' },
  ]);
});

test('a page it does not understand gives nothing, never an error', () => {
  for (const html of ['', '<html><body>Site inconnu</body></html>', 'not html at all <tr']) {
    const parsed = parseSitePage(html);
    assert.deepEqual(parsed, {
      name: null,
      seasonStart: null,
      seasonEnd: null,
      bans: [],
      samples: [],
    });
  }
});

test('entities and scripts', () => {
  assert.equal(
    textOf('<p>Ent&eacute;rocoques&nbsp;&#233;&#xE9;</p><script>var a = "<td>";</script>'),
    'Entérocoques éé',
  );
});

test('the site list: codes on 9 characters, Corsica and overseas', () => {
  const body = fixture('baignades/siteList.synthetic.json');
  assert.deepEqual(parseSiteList(body, '30'), [
    { code: '030002007', name: 'LE MOULINET - BEAU RIVAGE' },
    { code: '030002008', name: 'SYNTHETIC SECOND SITE' },
  ]);
  assert.deepEqual(parseSiteList({ sites: [{ isite: 123, nom: ' X ' }] }, '2A'), [
    { code: '02A000123', name: 'X' },
  ]);
  assert.deepEqual(parseSiteList({ sites: [{ isite: '974000001', nom: '' }] }, '974'), [
    { code: '974000001', name: '974000001' },
  ]);
  assert.deepEqual(parseSiteList({ nothing: true }, '30'), []);
  assert.equal(dptddassOf('2A'), '02A');
  assert.equal(departmentOfSite('02A000123'), '2A');
  assert.equal(departmentOfSite('974000001'), '974');
  assert.equal(departmentOfSite('076002097'), '76');
});

test('the maps of the site, and the departments it does not cover', () => {
  assert.equal(mapOf('76'), 'fra');
  assert.equal(mapOf('974'), 'reu');
  assert.equal(mapOf('987'), null);
});

test('the requests: siteList in JSON, the page of the current season', async () => {
  const api = createApi();
  const baignades = new Baignades({ fetch: api.fetch });
  const sites = await baignades.sitesOfCommune('45232', '45');
  assert.deepEqual(
    sites.map((site) => [site.code, site.commune]),
    [
      ['045000101', '45232'],
      ['045000102', '45232'],
    ],
  );
  assert.deepEqual(Object.fromEntries(api.requests[0].searchParams), {
    idCarte: 'fra',
    insee_com: '45232',
    code_dept: '45',
    f: 'json',
  });
  assert.deepEqual(await baignades.sitesOfCommune('98735', '987'), []);
  await baignades.site('045000101', 2026);
  assert.equal(
    api.requests.at(-1).href,
    'https://baignades.sante.gouv.fr/baignades/consultSite.do?dptddass=045&site=045000101&annee=2026',
  );
  assert.equal(
    sitePage('030002007'),
    'https://baignades.sante.gouv.fr/baignades/consultSite.do?dptddass=030&site=030002007',
  );
});
