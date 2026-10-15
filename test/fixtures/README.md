# Test fixtures

## `gladys-feature-table.json`

The category/type couples, units and poll frequencies the Gladys core (5.2.x) knows, extracted
from its code. Used by `test/gladys-rules.test.js`.

## Why so little is recorded

The development session reached none of the three services (its network policy refused
`hubeau.eaufrance.fr`, `baignades.sante.gouv.fr`, `geo.api.gouv.fr`, `data.gouv.fr` and the
Wayback Machine). What is below is the real answer that could be found published, and pages
rebuilt from what the code of others proves about the services. Replace them by recordings with
`node scripts/probe.mjs <INSEE code> --site <code> --raw <dir>` from a machine that has the
network. JSON and HTML files are left alone by Prettier (`.prettierignore`).

## `hubeau/resultats_dis-45234-1340.json`: partly recorded

`api/v1/qualite_eau_potable/resultats_dis?code_commune=45234&code_parametre=1340&page=1&size=10`
(Orléans, nitrates), recorded by
[Hadad-Ahmed-Ali/hubeau-data-pipeline](https://github.com/Hadad-Ahmed-Ali/hubeau-data-pipeline)
(`notebooks/01_exploration_hubeau.ipynb`, sample of 11/05/2026). Verbatim: the first row (its 32
fields, the `reseaux` list included), the keys of the envelope and its `next` link. The `count`
and the other links are reconstructed; the notebook printed the first row only. Public data,
Licence Ouverte Etalab 2.0.

In `test/helpers/world.js`, `sampleRows` builds other rows **in the shape of this one** (same
fields, other parameter, value or conformity): the pH, hardness and chlorine of the same sample,
a routine sample of 20/07/2026 (bacteria only, physico-chemistry `S`), and the non-compliant
samples of the tests. The conformity codes `C`, `D`, `N`, `S` and the SISE-Eaux codes of the
parameters (`NO3`, `TH`, `PH`, `CL2LIB`, `CL2TOT`) are those listed by
[SocialGouv/recosante](https://github.com/SocialGouv/recosante) (`api-node/src/types/api/drinking_water.ts`).

## `baignades/`: hand-made

- `consultSite-030002007.synthetic.html`: a page of a bathing site, written by hand in the layout
  the Recosante parser of the Ministry relies on (`api-node/src/utils/bathing_water/scrapping.ts`):
  cells holding "Début de la saison" / "Fin de la saison" and a dd/mm/yyyy date, a cell
  "Interdiction de baignade du …", one row per sample marked by the image
  `images/fr/boutons/fleche_ronde.gif` and ending with "Bon", "Moyen" or "Mauvais" ("Non
  renseigné" when the result is not out yet). The page title "Qualité des eaux de baignade > LE
  MOULINET - BEAU RIVAGE" and the site code are those of a real page seen in a search engine;
  every value of the page is invented.
- `siteList.synthetic.json`: the answer of `siteList.do?…&f=json`, `{ "sites": [{ "isite", "nom" }] }`,
  the two fields Recosante reads; the second site is invented.

In `test/helpers/world.js`, `sitePageHtml` builds the pages of two invented sites around Orléans
(`045000101`, `045000102`) in the same layout, and the fake geo.api.gouv.fr answers four real
communes (Orléans, Olivet, Saint-Jean-de-Braye, Blois) with approximate centres, in the shape
documented by the API (`code`, `nom`, `codeDepartement`, `centre` as a GeoJSON point).
