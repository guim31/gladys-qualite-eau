// -----------------------------------------------------------------------------
// Texts sent from the container (feature values, connection status, action
// messages, widget), in the four languages of the Gladys interface. Entries
// are strings or functions of one parameter object. German says "du",
// Spanish "usted".
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';

/**
 * Conformity of a sample to the quality limits, by Hub'Eau code. `key` is the
 * stable English word the scene triggers carry, `gladys` the value of the risk
 * feature (the front's badge: 0 green "no risk", 1 yellow, 3 red), `widget`
 * the colour of the closed widget palette.
 */
export const CONFORMITY = {
  C: { key: 'compliant', gladys: 0, widget: WIDGET_COLORS.SUCCESS },
  D: { key: 'derogation', gladys: 1, widget: WIDGET_COLORS.WARNING },
  N: { key: 'non_compliant', gladys: 3, widget: WIDGET_COLORS.DANGER },
};
export const NOT_MEASURED = 'not_measured';

export const CONFORMITY_NAMES = {
  en: {
    compliant: 'Compliant',
    derogation: 'Compliant (derogation)',
    non_compliant: 'Non-compliant',
    not_measured: 'Not measured',
  },
  fr: {
    compliant: 'Conforme',
    derogation: 'Conforme (dérogation)',
    non_compliant: 'Non conforme',
    not_measured: 'Non mesurée',
  },
  de: {
    compliant: 'Konform',
    derogation: 'Konform (Ausnahme)',
    non_compliant: 'Nicht konform',
    not_measured: 'Nicht gemessen',
  },
  es: {
    compliant: 'Conforme',
    derogation: 'Conforme (excepción)',
    non_compliant: 'No conforme',
    not_measured: 'No medida',
  },
};

/**
 * Status of a bathing site. `gladys` is the value of its risk feature (null:
 * nothing published, there is no current result), `widget` its colour.
 */
export const BATHING_STATUS = {
  good: { gladys: 0, widget: WIDGET_COLORS.SUCCESS },
  average: { gladys: 1, widget: WIDGET_COLORS.WARNING },
  poor: { gladys: 2, widget: WIDGET_COLORS.DANGER },
  prohibited: { gladys: 3, widget: WIDGET_COLORS.DANGER },
  off_season: { gladys: null, widget: WIDGET_COLORS.NEUTRAL },
  no_sample: { gladys: null, widget: WIDGET_COLORS.NEUTRAL },
  unknown: { gladys: null, widget: WIDGET_COLORS.NEUTRAL },
};
// The statuses that fire "Bathing not advised or prohibited".
export const UNSAFE = ['poor', 'prohibited'];

export const BATHING_NAMES = {
  en: {
    good: 'Good',
    average: 'Average',
    poor: 'Poor',
    prohibited: 'Bathing prohibited',
    off_season: 'Off season',
    no_sample: 'No sample yet',
    unknown: 'Result not published',
  },
  fr: {
    good: 'Bon',
    average: 'Moyen',
    poor: 'Mauvais',
    prohibited: 'Baignade interdite',
    off_season: 'Hors saison',
    no_sample: 'Pas encore de prélèvement',
    unknown: 'Résultat non communiqué',
  },
  de: {
    good: 'Gut',
    average: 'Mittel',
    poor: 'Schlecht',
    prohibited: 'Baden verboten',
    off_season: 'Außerhalb der Saison',
    no_sample: 'Noch keine Probe',
    unknown: 'Ergebnis nicht veröffentlicht',
  },
  es: {
    good: 'Bueno',
    average: 'Medio',
    poor: 'Malo',
    prohibited: 'Baño prohibido',
    off_season: 'Fuera de temporada',
    no_sample: 'Aún sin muestra',
    unknown: 'Resultado no publicado',
  },
};

// Values of the text features.
export const VALUES = {
  en: {
    tapDevice: ({ name }) => `Tap water · ${name}`,
    noSample: 'No sample published for a year',
    noConclusion: 'No conclusion published',
    seasonOpen: ({ end }) => `Open until ${end}`,
    seasonClosed: ({ start, end }) => `Closed (season ${start} to ${end})`,
    allYear: 'All year round',
    seasonUnknown: 'Dates not published',
  },
  fr: {
    tapDevice: ({ name }) => `Eau du robinet · ${name}`,
    noSample: 'Aucun prélèvement publié depuis un an',
    noConclusion: 'Aucune conclusion publiée',
    seasonOpen: ({ end }) => `Ouverte jusqu'au ${end}`,
    seasonClosed: ({ start, end }) => `Fermée (saison du ${start} au ${end})`,
    allYear: "Toute l'année",
    seasonUnknown: 'Dates non publiées',
  },
  de: {
    tapDevice: ({ name }) => `Leitungswasser · ${name}`,
    noSample: 'Seit einem Jahr keine Probe veröffentlicht',
    noConclusion: 'Kein Fazit veröffentlicht',
    seasonOpen: ({ end }) => `Geöffnet bis ${end}`,
    seasonClosed: ({ start, end }) => `Geschlossen (Saison ${start} bis ${end})`,
    allYear: 'Ganzjährig',
    seasonUnknown: 'Termine nicht veröffentlicht',
  },
  es: {
    tapDevice: ({ name }) => `Agua del grifo · ${name}`,
    noSample: 'Ninguna muestra publicada desde hace un año',
    noConclusion: 'Ninguna conclusión publicada',
    seasonOpen: ({ end }) => `Abierta hasta el ${end}`,
    seasonClosed: ({ start, end }) => `Cerrada (temporada del ${start} al ${end})`,
    allYear: 'Todo el año',
    seasonUnknown: 'Fechas no publicadas',
  },
};

// Connection status of the Configuration screen.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    hubeauDown: "Hub'Eau does not answer: the tap water results will come back with it.",
    baignadesDown:
      'baignades.sante.gouv.fr does not answer: the bathing results will come back with it.',
    geoDown: 'geo.api.gouv.fr does not answer: the commune of your house cannot be found yet.',
    noHouse: 'Give your house a location in Gladys (Settings, Houses), or type its INSEE code.',
    houseUnlocated: ({ name }) =>
      `The house "${name}" has no location in Gladys (Settings, Houses): type its INSEE code instead.`,
    houseGone: ({ name }) =>
      `The house "${name}" no longer exists in Gladys: choose another one in the configuration.`,
    noCommune: 'No French commune found at the location of your house: type its INSEE code.',
    unknownCommune: ({ codes }) => `No tap water sample published for a year in: ${codes}.`,
    invalid: ({ values }) => `Ignored (neither an INSEE code nor a bathing site): ${values}.`,
    unknownSite: ({ codes }) => `Unknown bathing site: ${codes}.`,
    tooMany: ({ max }) => `Only the first ${max} are followed.`,
    none: 'Nothing to follow yet: choose a house with a location, or type an INSEE code.',
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    hubeauDown: "Hub'Eau ne répond pas : les résultats de l'eau du robinet reviendront avec lui.",
    baignadesDown:
      'baignades.sante.gouv.fr ne répond pas : les résultats de baignade reviendront avec lui.',
    geoDown:
      'geo.api.gouv.fr ne répond pas : la commune de votre maison ne peut pas encore être trouvée.',
    noHouse:
      'Indiquez la position de votre maison dans Gladys (Paramètres, Maisons), ou tapez son code INSEE.',
    houseUnlocated: ({ name }) =>
      `La maison « ${name} » n'a pas de position dans Gladys (Paramètres, Maisons) : tapez plutôt son code INSEE.`,
    houseGone: ({ name }) =>
      `La maison « ${name} » n'existe plus dans Gladys : choisissez-en une autre dans la configuration.`,
    noCommune:
      'Aucune commune française trouvée à la position de votre maison : tapez son code INSEE.',
    unknownCommune: ({ codes }) =>
      `Aucun prélèvement d'eau du robinet publié depuis un an pour : ${codes}.`,
    invalid: ({ values }) => `Ignoré (ni code INSEE ni site de baignade) : ${values}.`,
    unknownSite: ({ codes }) => `Site de baignade inconnu : ${codes}.`,
    tooMany: ({ max }) => `Seuls les ${max} premiers sont suivis.`,
    none: 'Rien à suivre pour l’instant : choisissez une maison qui a une position, ou tapez un code INSEE.',
  },
  de: {
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    hubeauDown:
      "Hub'Eau antwortet nicht: Die Ergebnisse des Leitungswassers kommen mit ihm zurück.",
    baignadesDown:
      'baignades.sante.gouv.fr antwortet nicht: Die Badeergebnisse kommen mit ihm zurück.',
    geoDown:
      'geo.api.gouv.fr antwortet nicht: Die Gemeinde deines Hauses kann noch nicht ermittelt werden.',
    noHouse:
      'Gib deinem Haus in Gladys einen Standort (Einstellungen, Häuser) oder trage seinen INSEE-Code ein.',
    houseUnlocated: ({ name }) =>
      `Das Haus „${name}“ hat in Gladys keinen Standort (Einstellungen, Häuser): Trage stattdessen seinen INSEE-Code ein.`,
    houseGone: ({ name }) =>
      `Das Haus „${name}“ gibt es in Gladys nicht mehr: Wähle in der Konfiguration ein anderes.`,
    noCommune:
      'Am Standort deines Hauses wurde keine französische Gemeinde gefunden: Trage ihren INSEE-Code ein.',
    unknownCommune: ({ codes }) =>
      `Seit einem Jahr keine Leitungswasserprobe veröffentlicht für: ${codes}.`,
    invalid: ({ values }) => `Ignoriert (weder INSEE-Code noch Badestelle): ${values}.`,
    unknownSite: ({ codes }) => `Unbekannte Badestelle: ${codes}.`,
    tooMany: ({ max }) => `Nur die ersten ${max} werden verfolgt.`,
    none: 'Noch nichts zu verfolgen: Wähle ein Haus mit Standort oder trage einen INSEE-Code ein.',
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    hubeauDown: "Hub'Eau no responde: los resultados del agua del grifo volverán con él.",
    baignadesDown: 'baignades.sante.gouv.fr no responde: los resultados de baño volverán con él.',
    geoDown: 'geo.api.gouv.fr no responde: aún no se puede encontrar el municipio de su casa.',
    noHouse:
      'Indique la ubicación de su casa en Gladys (Ajustes, Casas) o escriba su código INSEE.',
    houseUnlocated: ({ name }) =>
      `La casa «${name}» no tiene ubicación en Gladys (Ajustes, Casas): escriba en su lugar su código INSEE.`,
    houseGone: ({ name }) =>
      `La casa «${name}» ya no existe en Gladys: elija otra en la configuración.`,
    noCommune:
      'No se ha encontrado ningún municipio francés en la ubicación de su casa: escriba su código INSEE.',
    unknownCommune: ({ codes }) =>
      `Ninguna muestra de agua del grifo publicada desde hace un año para: ${codes}.`,
    invalid: ({ values }) => `Ignorado (ni código INSEE ni zona de baño): ${values}.`,
    unknownSite: ({ codes }) => `Zona de baño desconocida: ${codes}.`,
    tooMany: ({ max }) => `Solo se siguen los ${max} primeros.`,
    none: 'Aún no hay nada que seguir: elija una casa con ubicación o escriba un código INSEE.',
  },
};

// Messages of the "Find bathing sites" action.
export const SEARCH = {
  en: {
    noHouse: 'Your house has no location in Gladys: type the INSEE code of a commune (e.g. 29019).',
    houseUnlocated: ({ name }) =>
      `The house "${name}" has no location in Gladys: type the INSEE code of a commune (e.g. 29019).`,
    houseGone: ({ name }) =>
      `The house "${name}" of the configuration no longer exists in Gladys: choose another one, or type an INSEE code.`,
    noCommune: 'No French commune at the location of your house: type an INSEE code.',
    invalid: 'Type the INSEE code of a commune (5 characters, e.g. 29019), not its postcode.',
    none: 'No bathing site found.',
    found: ({ count }) =>
      `${count} bathing site(s). Copy the codes into "Bathing sites", then save:`,
    unavailable: 'The service does not answer, try again in a few minutes.',
  },
  fr: {
    noHouse:
      "Votre maison n'a pas de position dans Gladys : tapez le code INSEE d'une commune (ex. 29019).",
    houseUnlocated: ({ name }) =>
      `La maison « ${name} » n'a pas de position dans Gladys : tapez le code INSEE d'une commune (ex. 29019).`,
    houseGone: ({ name }) =>
      `La maison « ${name} » de la configuration n'existe plus dans Gladys : choisissez-en une autre, ou tapez un code INSEE.`,
    noCommune: 'Aucune commune française à la position de votre maison : tapez un code INSEE.',
    invalid: "Tapez le code INSEE d'une commune (5 caractères, ex. 29019), pas son code postal.",
    none: 'Aucun site de baignade trouvé.',
    found: ({ count }) =>
      `${count} site(s) de baignade. Copiez les codes dans « Sites de baignade », puis enregistrez :`,
    unavailable: 'Le service ne répond pas, réessayez dans quelques minutes.',
  },
  de: {
    noHouse:
      'Dein Haus hat in Gladys keinen Standort: Gib den INSEE-Code einer Gemeinde ein (z. B. 29019).',
    houseUnlocated: ({ name }) =>
      `Das Haus „${name}“ hat in Gladys keinen Standort: Gib den INSEE-Code einer Gemeinde ein (z. B. 29019).`,
    houseGone: ({ name }) =>
      `Das Haus „${name}“ der Konfiguration gibt es in Gladys nicht mehr: Wähle ein anderes oder gib einen INSEE-Code ein.`,
    noCommune:
      'Am Standort deines Hauses liegt keine französische Gemeinde: Gib einen INSEE-Code ein.',
    invalid:
      'Gib den INSEE-Code einer Gemeinde ein (5 Zeichen, z. B. 29019), nicht ihre Postleitzahl.',
    none: 'Keine Badestelle gefunden.',
    found: ({ count }) =>
      `${count} Badestelle(n). Kopiere die Codes in „Badestellen“ und speichere:`,
    unavailable: 'Der Dienst antwortet nicht, versuche es in ein paar Minuten erneut.',
  },
  es: {
    noHouse:
      'Su casa no tiene ubicación en Gladys: escriba el código INSEE de un municipio (p. ej. 29019).',
    houseUnlocated: ({ name }) =>
      `La casa «${name}» no tiene ubicación en Gladys: escriba el código INSEE de un municipio (p. ej. 29019).`,
    houseGone: ({ name }) =>
      `La casa «${name}» de la configuración ya no existe en Gladys: elija otra o escriba un código INSEE.`,
    noCommune:
      'No hay ningún municipio francés en la ubicación de su casa: escriba un código INSEE.',
    invalid:
      'Escriba el código INSEE de un municipio (5 caracteres, p. ej. 29019), no su código postal.',
    none: 'No se ha encontrado ninguna zona de baño.',
    found: ({ count }) =>
      `${count} zona(s) de baño. Copie los códigos en «Zonas de baño» y guarde:`,
    unavailable: 'El servicio no responde, inténtelo de nuevo en unos minutos.',
  },
};

/** One entry of a message table, in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Several multi-language texts joined, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages
        .filter(Boolean)
        .map((message) => message[language])
        .join(' '),
    ]),
  );
}

const locale = (language) => (language === 'en' ? 'en-GB' : language);

/** A day in the user's time zone (TZ, set by the Gladys supervisor), e.g. "11/05/2026". */
export function formatDay(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(time));
}

/** A `YYYY-MM-DD` day as "11/05" (`year`: "11/05/2026"), without time zone shift. */
export function formatIsoDay(day, language, { year = false } = {}) {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    ...(year ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(Date.UTC(y, m - 1, d));
}

/** A number in the user's language, e.g. "3,5" in French. */
export function formatNumber(value, language, digits = 2) {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits: digits }).format(value);
}
