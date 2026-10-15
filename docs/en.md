# Water quality

This integration shows in Gladys the **quality of the tap water** of your French commune and that
of the **bathing sites** nearby (monitored beaches, lakes and rivers), from the results of the
sanitary control published by the French Ministry of Health. Public data, no account, no key.

> **Information, not a health alert system.** Results are published several days, sometimes
> several weeks late. When the tap water has a problem or bathing is prohibited, the notices of
> your town hall, of your water distributor and of the ARS (regional health agency) prevail.
> Not affiliated with OFB / eaufrance nor with the Ministry of Health.

> **Developed without access to the live services** (the network of the development session
> could not reach them): it was written and tested on recorded answers and rebuilt pages.
> Feedback welcome, especially on bathing.

## Overview

- **One "Tap water · your commune" device**: the conformity of the last sample (bacteriological
  and physico-chemical), its date, the sanitary conclusion written by the ARS and, when measured,
  the **nitrates**, the **hardness** (useful to set a water softener or a dishwasher), the
  **chlorine** and the **pH**.
- **One device per bathing site**: the result of the last sample (good, average, poor) or the
  bathing ban, its date, and the season (open until…, closed).
- **Two scene triggers**: "Tap water non-compliant" and "Bathing not advised or prohibited".
- **A widget** for the dashboard, and a **"Find bathing sites"** action.
- **One reading a day**: the Ministry publishes the tap water results about once a month, the
  bathing results about once a week in season.

## Requirements

- Gladys Assistant **5.2.0** or later.
- Internet access from Gladys to `hubeau.eaufrance.fr`, `baignades.sante.gouv.fr` and
  `geo.api.gouv.fr`.
- To use your house: its **location** set in Gladys (Settings → Houses). The integration asks
  for access to the location of the houses (`location`), shown at install time. Without a
  location, just type the INSEE code of your commune.
- Communes of mainland and overseas France covered by the sanitary control.

## Installation and configuration

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-qualite-eau` (or install it from the catalog once listed).
2. In the **Configuration** tab:
   - **House**: the house whose location gives the commune. Empty: the first house of Gladys
     that has a location.
   - **Communes (INSEE codes)**: only to follow another commune than that of the house (a
     second home, your parents' town…), up to 5. Beware, the **INSEE code is not the postcode**:
     Orléans has the postcode 45000 but the INSEE code 45234. The INSEE website and Wikipedia
     give it.
   - **Bathing sites followed**: those of your communes (the default), those within 5, 10 or
     20 km of your house, or only those you type.
   - **Bathing sites**: codes given by "Find bathing sites", or the addresses of their pages on
     baignades.sante.gouv.fr.
   - **Language of the names and texts**: French by default.
3. Save, then open the **Discover** tab and press **Add to Gladys** on the devices you want.

### Find bathing sites

The **"Find bathing sites"** action, in the Configuration tab, lists the sites of a commune (type
its INSEE code) or, when empty, those of the communes around your house (5, 10 or 20 km), with
their code. Copy the codes you want into **Bathing sites**, then save.

## Devices

### Tap water

| Feature                     | What it shows                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Bacteriological compliance  | Risk badge: green (compliant), yellow (compliant under a derogation), red (non-compliant)                          |
| Physico-chemical compliance | The same, for the chemical parameters (nitrates, pesticides, metals…)                                              |
| Health conclusion           | The text of the ARS for the last sample, in French                                                                 |
| Last sample                 | The day of the last published sample                                                                               |
| Nitrates (mg/L)             | The quality limit is 50 mg/L                                                                                       |
| Hardness (°f)               | In French degrees: under 15 °f, soft water; over 30 °f, hard water                                                 |
| Chlorine (mg/L)             | Free chlorine, or total chlorine when only it is measured; "<0,10" (under the laboratory's threshold) is sent as 0 |
| pH                          | Between 6.5 and 9 for a compliant water                                                                            |

Each conformity comes from the **last sample that assessed it**: a routine control often looks
for bacteria only, without chemical analysis. The numbers are the newest of the last two years
(the hardness is measured once a year or less in small communes). Gladys has no unit for mg/L
nor for French degrees: these values are published without a unit, and the feature name gives
it.

The parameters of the device give the distributor (`DISTRIBUTOR`) and the distribution networks
of the last sample (`NETWORKS`).

### Bathing site

| Feature        | What it shows                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Water quality  | Risk badge: green (good), yellow (average), orange (poor), red (bathing prohibited); nothing out of season |
| Last result    | In words: Good, Average, Poor, Bathing prohibited, Off season, No sample yet, Result not published         |
| Last sample    | The day of the last published result                                                                       |
| Bathing season | "Open until 31/08", "Closed (season 15/06 to 31/08)", "All year round" overseas                            |

The result of a sample (good, average, poor) depends on the bacteria measured (E. coli,
enterococci). It is not the end-of-season **classification** (excellent, good, sufficient,
poor), computed over four years, which the integration does not read.

## Widget

The **Water quality** widget shows, without setting, one line per commune (compliant or not, and
its hardness) and per bathing site (last result and its day), in colour, the hardness of your
commune as a tile, and a red heading when the tap water is non-compliant or a bathing site
unsafe. With a device chosen in its settings, it shows its detail: the live nitrates, hardness,
chlorine and pH and the sanitary conclusion for a commune; the result, day and season, with a
link to the official page, for a site.

## Scene triggers

- **Tap water non-compliant**: a new sample of a followed commune exceeds a quality limit.
  Filter: the commune. Variables: commune name, day of the sample, sanitary conclusion,
  bacteriological and physico-chemical conformity (`compliant`, `derogation`, `non_compliant`,
  `not_measured`). It fires once per sample, never at the first reading, nor for a sample older
  than 90 days.
- **Bathing not advised or prohibited**: a followed site gets a poor result or a bathing ban.
  Filters: the site, the new status (`poor`, `prohibited`). Variables: site name, status, status
  in words, day of the last sample.

To react to the return to normal, use the native Gladys trigger "a device state changes" on the
badge of the device.

## Scene examples

- **Tap water alert**: trigger "Tap water non-compliant", action "Send a message" using the
  variables of the trigger: "Tap water non-compliant in _commune name_ (sample of _day_):
  _health conclusion_".
- **Before going to the beach**: every Saturday at 9 am, if the "Water quality" badge of the lake
  is below 2, send "Bathing possible at the lake this morning".
- **Bathing prohibited**: trigger "Bathing not advised or prohibited", status "prohibited",
  action "Send a message" to the whole family.
- **Water softener**: a chart of the hardness over a year, to set the softener or the dishwasher.

## Troubleshooting

- **No device in the Discover tab**: the configuration screen says why (house without location,
  unknown INSEE code…). Give your house a location or type an INSEE code.
- **"No tap water sample published for a year"**: check that you typed the INSEE code and not
  the postcode. For Paris, Lyon and Marseille, try the code of the whole city (75056, 69123,
  13055), then that of the district.
- **The last sample is several weeks old**: normal, results are published about once a month.
- **A bathing site stays "Off season" or "No sample yet"**: the season has not started, or its
  first sample is not published yet.
- **"Hub'Eau does not answer" or "baignades.sante.gouv.fr does not answer"**: the service is
  down; the integration tries again every hour and keeps the last values.
- For more details, set `LOG_LEVEL=debug`: every reading is then written to the logs of the
  integration (never the location of your house).

## Limits

- **At the scale of the commune**: in a large city served by several networks, the last sample
  may come from another quarter than yours (the `NETWORKS` parameter says which).
- Results arrive late: a few days to a few weeks for the tap water. This is not a real-time
  alert.
- Bathing is read from the pages of baignades.sante.gouv.fr, which has no documented public API:
  a change of those pages can break the reading until the integration is updated. The
  end-of-season classification is not read.
- "Around my house" keeps the communes whose **centre** lies within the distance, according to
  geo.api.gouv.fr.
- 5 communes and 10 bathing sites at most.
- Pace and quotas: neither Hub'Eau nor baignades.sante.gouv.fr publish a quota; the integration
  makes five or six small Hub'Eau requests per commune and per day, one request per bathing site and per day,
  and asks again for the list of sites and the commune of the house once a week.
  geo.api.gouv.fr allows 50 requests per second.

## Sources and licence

- Tap water: [Hub'Eau – Drinking water quality](https://hubeau.eaufrance.fr/page/api-qualite-eau-potable),
  results of the sanitary control of the Ministry of Health, Licence Ouverte Etalab 2.0.
- Bathing: [baignades.sante.gouv.fr](https://baignades.sante.gouv.fr), Ministry of Health and
  ARS.
- Communes: [API Découpage administratif](https://geo.api.gouv.fr), Licence Ouverte Etalab 2.0.
- The location of your house is only sent to geo.api.gouv.fr, rounded to about 100 m, and is
  neither stored nor written to the logs.
- Not affiliated with OFB / eaufrance, BRGM nor the Ministry of Health. Code under the Apache 2.0
  licence.
