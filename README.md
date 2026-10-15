# Water quality for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the
**quality of the tap water** of your French commune and that of the **bathing sites** nearby into
Gladys, from the results of the sanitary control published by the French Ministry of Health
([Hub'Eau – Qualité de l'eau potable](https://hubeau.eaufrance.fr/page/api-qualite-eau-potable)
and [baignades.sante.gouv.fr](https://baignades.sante.gouv.fr)). Public open data, no account, no
key.

> **Information, not a health alert system.** Results are published days or weeks late; the
> notices of your town hall, your water distributor and the ARS prevail. Not affiliated with OFB /
> eaufrance, BRGM nor the French Ministry of Health.

> **Developed without access to the live services: feedback welcome.** The development session
> could not reach Hub'Eau, baignades.sante.gouv.fr nor geo.api.gouv.fr. The code was written and
> tested on a recorded Hub'Eau answer and on rebuilt pages (see
> [`test/fixtures/README.md`](test/fixtures/README.md)); `node scripts/probe.mjs <INSEE code>`
> checks it against the live services.

## Features

- **"Tap water · <commune>"**: bacteriological and physico-chemical conformity of the last sample
  (Gladys risk badge: green, yellow under a derogation, red), its day, the sanitary conclusion of
  the ARS, and the nitrates, hardness (°f), chlorine and pH when measured.
- **One device per bathing site**: last result (good, average, poor) or bathing ban, as a risk
  badge and in words, its day, and the season (open until…, closed, all year round overseas).
- **Your commune from your house**: its location in Gladys gives the commune (geo.api.gouv.fr),
  or type up to 5 INSEE codes. Bathing sites: those of your communes, those within 5, 10 or 20 km
  of your house, or the ones you pick with **"Find bathing sites"**.
- **Scene triggers**: _Tap water non-compliant_ (a new sample exceeds a quality limit) and
  _Bathing not advised or prohibited_, with the commune or site, the day and the conclusion as
  variables.
- **Dashboard widget**: tap water (compliant or not, hardness) and bathing sites, or the detail
  of one device.
- One reading a day, by the integration's own timer. Texts in English, French, German and
  Spanish.

## Requirements

- Gladys Assistant **5.2.0** or later (widgets, scene triggers, house selection).
- Internet access from Gladys to `hubeau.eaufrance.fr`, `baignades.sante.gouv.fr` and
  `geo.api.gouv.fr`.
- To use your house: its location in Gladys. The integration declares `location: true`, shown on
  the install screen. Without it, type the INSEE code of your commune.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-qualite-eau` (or install it from the catalog once listed).
2. In **Configuration**, choose the house (or type INSEE codes), how to follow bathing sites, and
   save.
3. Open the **Discover** tab and press **Add to Gladys** on the devices you want.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)).

## How it works

```
Integration container ──HTTPS──▶ hubeau.eaufrance.fr      tap water samples (resultats_dis)
                      ──HTTPS──▶ baignades.sante.gouv.fr  bathing sites (siteList.do, JSON)
                                                           and their pages (consultSite.do, HTML)
                      ──HTTPS──▶ geo.api.gouv.fr          commune of the house, communes around
      │ SDK (WebSocket + host API)
      ▼
Gladys core ── devices, states, scene events, widget
```

- **Hub'Eau has no bathing-water API**: the bathing results come from the Ministry's site
  baignades.sante.gouv.fr, read the way the Ministry's own Recosante service reads it: a JSON
  list of the sites of a commune, then the HTML page of each site (season dates, bans, one row
  per sample). The parser looks for the labels in the text of the cells and never fails on a page
  it does not understand.
- Devices are published with `should_poll: false` (the core does not poll external devices
  reliably, GladysAssistant/Gladys#3198): a timer ticks every hour and reads again a commune or a
  site whose last reading is a day old (an hour after a failure). Only the changes are published,
  plus a heartbeat every 12 hours, so a monthly value never shows as "no recent value".
- Per day and per commune: one Hub'Eau request for the samples of a year, then one small
  request per parameter (nitrates, hardness, free chlorine or else total chlorine, pH, newest of
  two years); one page per bathing site. The commune of the house and the site lists are asked
  once a week. No quota is published by these services.
- Each conformity comes from the newest sample that assessed it (`C`, `D` derogation, `N`; `S`
  "not measured" is skipped): a routine sample often measures only bacteria.
- The house location is sent to geo.api.gouv.fr only, rounded to 3 decimals, and is never stored
  in `/data` nor logged.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
node scripts/probe.mjs 45234 --site 030002007     # needs the network: the live services
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

`CLAUDE.md` holds the project rules and the pitfalls of the Gladys core and of these services.

## Limits

- Commune level: in a city with several networks, the last sample may come from another quarter.
- Results are late (days to weeks); not a real-time alert.
- The bathing pages are HTML without a documented API: a change of the site can break the reading
  until an update. The end-of-season classification is not read.
- 5 communes and 10 bathing sites at most.

## Credits

- [SocialGouv/recosante](https://github.com/SocialGouv/recosante) (Apache-2.0, French Ministry of
  Health): how baignades.sante.gouv.fr is read, and the meaning of the conformity codes.
- [netnic0/ha-q-eau](https://github.com/netnic0/ha-q-eau) (MIT), the Home Assistant integration
  for French drinking water, and [J0hnMatrix/domoticz-hubeau](https://github.com/J0hnMatrix/domoticz-hubeau)
  (MIT): the Hub'Eau parameters worth showing.
- [Hadad-Ahmed-Ali/hubeau-data-pipeline](https://github.com/Hadad-Ahmed-Ali/hubeau-data-pipeline):
  the recorded Hub'Eau answer used in the tests (public data, Licence Ouverte).
- Only their knowledge of the services and the public data they recorded are reused, not their
  code.

## Licence

Apache-2.0, see [`LICENSE`](LICENSE). Data: Hub'Eau and geo.api.gouv.fr under the Licence Ouverte
Etalab 2.0; bathing results © Ministère chargé de la santé / ARS.
