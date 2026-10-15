// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `water_quality`.
//
// Without setting: one status line per tap water commune (compliant or not,
// and its hardness) and per bathing site (last result and its day), coloured
// (green compliant or good, yellow derogation or average, red non-compliant,
// poor or prohibited, grey without a current result), the hardness of the
// first commune as a live tile, and a heading when the tap water is
// non-compliant or a bathing site unsafe.
//
// With a device chosen in the settings:
//   - a commune: its nitrates, hardness, chlorine and pH as live tiles bound to
//     its features, the two conformities and the day of the sample, and the
//     sanitary conclusion as written by the health agency;
//   - a bathing site: its result, last sample and season, and a link to its
//     page on baignades.sante.gouv.fr.
//
// Both end with the sources and the time of the last reading. Budget: 2 texts,
// 1 status, 4 tiles, 1 button at most.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { sitePage } from './baignades.js';
import { BATHING, NAMES, TAP, idsOf, parseId } from './devices.js';
import {
  BATHING_NAMES,
  BATHING_STATUS,
  CONFORMITY,
  CONFORMITY_NAMES,
  formatDay,
  formatIsoDay,
  formatNumber,
} from './messages.js';
import { WIDGET_KEY } from './monitor.js';

export const MAX_STATUS_ITEMS = 10;
export const TTL_SECONDS = 1800;
const MAX_STATUS_TEXT = 40;
const MAX_BODY = 300;

export const TEXT = {
  empty: {
    en: 'Nothing to show yet: fill in the configuration of the Water quality integration, then create the devices in the Discover tab.',
    fr: "Rien à afficher pour l'instant : remplissez la configuration de l'intégration Qualité de l'eau, puis créez les appareils dans l'onglet Découverte.",
    de: 'Noch nichts anzuzeigen: Fülle die Konfiguration der Integration Wasserqualität aus und lege dann die Geräte im Tab „Entdecken“ an.',
    es: 'Aún no hay nada que mostrar: rellene la configuración de la integración Calidad del agua y, después, cree los dispositivos en la pestaña Descubrir.',
  },
  gone: {
    en: 'This device is no longer followed.',
    fr: "Cet appareil n'est plus suivi.",
    de: 'Dieses Gerät wird nicht mehr verfolgt.',
    es: 'Este dispositivo ya no se sigue.',
  },
  tapAlert: {
    en: 'Tap water non-compliant',
    fr: 'Eau du robinet non conforme',
    de: 'Leitungswasser nicht konform',
    es: 'Agua del grifo no conforme',
  },
  bathingAlert: {
    en: 'Bathing not advised',
    fr: 'Baignade déconseillée',
    de: 'Baden nicht empfohlen',
    es: 'Baño desaconsejado',
  },
  tap: { en: 'Tap water', fr: 'Eau du robinet', de: 'Leitungswasser', es: 'Agua del grifo' },
  bacteriological: {
    en: 'Bacteriology',
    fr: 'Bactériologie',
    de: 'Bakteriologie',
    es: 'Bacteriología',
  },
  physicoChemical: {
    en: 'Physico-chemistry',
    fr: 'Physico-chimie',
    de: 'Physik und Chemie',
    es: 'Fisicoquímica',
  },
  sample: {
    en: 'Last sample',
    fr: 'Dernier prélèvement',
    de: 'Letzte Probe',
    es: 'Última muestra',
  },
  quality: {
    en: 'Water quality',
    fr: "Qualité de l'eau",
    de: 'Wasserqualität',
    es: 'Calidad del agua',
  },
  season: { en: 'Season', fr: 'Saison', de: 'Saison', es: 'Temporada' },
  waiting: { en: 'Waiting', fr: 'En attente', de: 'Wartet', es: 'En espera' },
  none: { en: 'None', fr: 'Aucun', de: 'Keine', es: 'Ninguna' },
  source: {
    en: "Sources: Hub'Eau, Ministry of Health",
    fr: "Sources : Hub'Eau, ministère de la Santé",
    de: "Quellen: Hub'Eau, Gesundheitsministerium",
    es: "Fuentes: Hub'Eau, Ministerio de Sanidad",
  },
  site: { en: 'Site page', fr: 'Fiche du site', de: 'Seite der Stelle', es: 'Ficha de la zona' },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max = MAX_STATUS_TEXT) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const conformityColor = (key) =>
  Object.values(CONFORMITY).find((level) => level.key === key)?.widget ?? WIDGET_COLORS.NEUTRAL;

/** The status value of a commune, e.g. "Conforme · 25 °f". */
export function tapValue(view, language) {
  if (!view.read) {
    return t(TEXT.waiting, language);
  }
  if (view.empty) {
    return clip(t(TEXT.none, language));
  }
  const hardness = view.parameters.hardness;
  const words = CONFORMITY_NAMES[language][view.overall];
  return clip(hardness ? `${words} · ${formatNumber(hardness.value, language, 1)} °f` : words);
}

/** The status value of a bathing site, e.g. "Bon · 12/08". */
export function bathingValue(view, language) {
  if (!view.read) {
    return t(TEXT.waiting, language);
  }
  const words = BATHING_NAMES[language][view.status];
  const dated = ['good', 'average', 'poor'].includes(view.status) && view.lastSample;
  return clip(dated ? `${words} · ${formatIsoDay(view.lastSample.date, language)}` : words);
}

function caption(monitor, communes, sites, language) {
  const updated = monitor.updatedAt(communes, sites);
  const source = t(TEXT.source, language);
  return {
    type: 'text',
    variant: 'caption',
    text: updated === null ? source : `${source} · ${formatDay(updated, language)}`,
  };
}

function overview(monitor, communes, sites, language) {
  const taps = communes.map((code) => monitor.tapView(code));
  const baths = sites.map((code) => monitor.bathingView(code));
  const components = [];
  if (taps.some((view) => view.overall === 'non_compliant')) {
    components.push({ type: 'text', variant: 'heading', text: t(TEXT.tapAlert, language) });
  } else if (baths.some((view) => ['poor', 'prohibited'].includes(view.status))) {
    components.push({ type: 'text', variant: 'heading', text: t(TEXT.bathingAlert, language) });
  }
  const first = taps.find((view) => view.parameters.hardness);
  if (first) {
    components.push({
      type: 'value',
      label: NAMES[language].hardness,
      device_feature: idsOf(monitor.gladys, TAP, first.code).hardness,
    });
  }
  const items = [
    ...taps.map((view) => ({
      label: clip(`${t(TEXT.tap, language)} · ${view.name}`),
      value: tapValue(view, language),
      color: view.read && !view.empty ? conformityColor(view.overall) : WIDGET_COLORS.NEUTRAL,
      icon: 'droplet',
    })),
    ...baths.map((view) => ({
      label: clip(view.name),
      value: bathingValue(view, language),
      color: BATHING_STATUS[view.status].widget,
      icon: view.status === 'prohibited' ? 'x-circle' : 'sun',
    })),
  ].slice(0, MAX_STATUS_ITEMS);
  components.push({ type: 'status', items });
  components.push(caption(monitor, communes, sites, language));
  return components;
}

function tapDetail(monitor, code, language) {
  const view = monitor.tapView(code);
  const ids = idsOf(monitor.gladys, TAP, code);
  const components = ['nitrates', 'hardness', 'chlorine', 'ph'].map((key) => ({
    type: 'value',
    label: NAMES[language][key],
    device_feature: ids[key],
  }));
  const conformity = (key) => ({
    value: CONFORMITY_NAMES[language][view[key]],
    color: conformityColor(view[key]),
  });
  components.push({
    type: 'status',
    items: [
      { label: t(TEXT.bacteriological, language), ...conformity('bacteriological') },
      { label: t(TEXT.physicoChemical, language), ...conformity('physicoChemical') },
      {
        label: t(TEXT.sample, language),
        value:
          view.sampleAt === null ? t(TEXT.waiting, language) : formatDay(view.sampleAt, language),
        color: WIDGET_COLORS.NEUTRAL,
        icon: 'calendar',
      },
    ],
  });
  if (view.conclusion) {
    components.push({ type: 'text', variant: 'body', text: clip(view.conclusion, MAX_BODY) });
  }
  components.push(caption(monitor, [code], [], language));
  return components;
}

function bathingDetail(monitor, code, language) {
  const view = monitor.bathingView(code);
  return [
    {
      type: 'status',
      items: [
        {
          label: t(TEXT.quality, language),
          value: bathingValue(view, language),
          color: BATHING_STATUS[view.status].widget,
        },
        {
          label: t(TEXT.sample, language),
          value: view.lastSample
            ? formatIsoDay(view.lastSample.date, language, { year: true })
            : t(TEXT.none, language),
          color: WIDGET_COLORS.NEUTRAL,
          icon: 'calendar',
        },
        {
          label: t(TEXT.season, language),
          value: clip(view.season ?? t(TEXT.waiting, language)),
          color: WIDGET_COLORS.NEUTRAL,
          icon: 'sun',
        },
      ],
    },
    caption(monitor, [], [code], language),
    {
      type: 'button',
      label: t(TEXT.site, language),
      icon: 'external-link',
      link: { url: sitePage(code) },
    },
  ];
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { settings, language = 'en' }) {
      const lang = CONFORMITY_NAMES[language] ? language : 'en';
      const communes = monitor.created(TAP);
      const sites = monitor.created(BATHING);
      const chosen = typeof settings?.device === 'string' ? settings.device : null;
      if (chosen) {
        const parsed = parseId(monitor.gladys, chosen);
        let components;
        if (parsed?.kind === TAP && communes.includes(parsed.code)) {
          components = tapDetail(monitor, parsed.code, lang);
        } else if (parsed?.kind === BATHING && sites.includes(parsed.code)) {
          components = bathingDetail(monitor, parsed.code, lang);
        } else {
          components = [{ type: 'text', variant: 'body', text: t(TEXT.gone, lang) }];
        }
        return { ttl_seconds: TTL_SECONDS, components };
      }
      if (communes.length === 0 && sites.length === 0) {
        return {
          ttl_seconds: TTL_SECONDS,
          components: [{ type: 'text', variant: 'body', text: t(TEXT.empty, lang) }],
        };
      }
      return { ttl_seconds: TTL_SECONDS, components: overview(monitor, communes, sites, lang) };
    },
  },
};
