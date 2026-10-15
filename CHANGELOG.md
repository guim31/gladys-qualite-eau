# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- A "Tap water" device per commune, from Hub'Eau: bacteriological and physico-chemical
  conformity of the last sample (Gladys risk badge), its day, the sanitary conclusion of the
  ARS, and the nitrates, hardness, chlorine and pH when measured.
- A device per bathing site, from baignades.sante.gouv.fr: last result (good, average, poor) or
  bathing ban, its day, and the bathing season.
- The commune from the location of a house of Gladys, or up to 5 INSEE codes; bathing sites of
  those communes, within 5, 10 or 20 km of the house, or picked with the "Find bathing sites"
  action.
- Scene triggers "Tap water non-compliant" and "Bathing not advised or prohibited".
- A "Water quality" dashboard widget: tap water and bathing sites, or the detail of one device.
- One reading a day by the integration's own timer, a heartbeat every 12 hours, quiet logs.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-qualite-eau/commits/main
