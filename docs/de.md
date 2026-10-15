# Wasserqualität

Diese Integration zeigt in Gladys die **Qualität des Leitungswassers** deiner französischen
Gemeinde und die der **Badestellen** in der Nähe (überwachte Strände, Seen und Flüsse), aus den
Ergebnissen der Gesundheitskontrolle, die das französische Gesundheitsministerium veröffentlicht.
Öffentliche Daten, ohne Konto und ohne Schlüssel.

> **Eine Information, kein Gesundheitswarnsystem.** Die Ergebnisse erscheinen mit einigen Tagen,
> manchmal einigen Wochen Verspätung. Bei einem Problem mit dem Leitungswasser oder einem
> Badeverbot gelten die Hinweise deines Rathauses, deines Wasserversorgers und der ARS
> (regionale Gesundheitsbehörde). Nicht mit OFB / eaufrance oder dem Gesundheitsministerium
> verbunden.

> **Ohne Zugang zu den Live-Diensten entwickelt** (das Netzwerk der Entwicklungssitzung erreichte
> sie nicht): geschrieben und getestet mit aufgezeichneten Antworten und nachgebauten Seiten.
> Rückmeldungen sind willkommen, besonders zum Baden.

## Überblick

- **Ein Gerät „Leitungswasser · deine Gemeinde“**: die Konformität der letzten Probe
  (bakteriologisch und physikalisch-chemisch), ihr Datum, das gesundheitliche Fazit der ARS und,
  wenn gemessen, **Nitrat**, **Wasserhärte** (nützlich für Enthärtungsanlage oder
  Geschirrspüler), **Chlor** und **pH-Wert**.
- **Ein Gerät pro Badestelle**: das Ergebnis der letzten Probe (gut, mittel, schlecht) oder das
  Badeverbot, sein Datum und die Saison (geöffnet bis…, geschlossen).
- **Zwei Szenen-Auslöser**: „Leitungswasser nicht konform“ und „Baden nicht empfohlen oder
  verboten“.
- **Ein Widget** für das Dashboard und eine Aktion **„Badestellen suchen“**.
- **Eine Abfrage pro Tag**: Das Ministerium veröffentlicht die Ergebnisse des Leitungswassers
  etwa einmal im Monat, die der Badestellen in der Saison etwa einmal pro Woche.

## Voraussetzungen

- Gladys Assistant **5.2.0** oder neuer.
- Internetzugang von Gladys zu `hubeau.eaufrance.fr`, `baignades.sante.gouv.fr` und
  `geo.api.gouv.fr`.
- Um dein Haus zu verwenden: sein **Standort** in Gladys (Einstellungen → Häuser). Die
  Integration fragt nach dem Zugriff auf den Standort der Häuser (`location`), was bei der
  Installation angezeigt wird. Ohne Standort trägst du einfach den INSEE-Code deiner Gemeinde
  ein.
- Gemeinden in Frankreich und in den Überseegebieten, die von der Gesundheitskontrolle erfasst
  werden.

## Installation und Konfiguration

1. Öffne in Gladys **Integrationen → Von GitHub installieren** und gib
   `https://github.com/guim31/gladys-qualite-eau` ein (oder installiere sie aus dem Katalog,
   sobald sie dort steht).
2. Im Tab **Konfiguration**:
   - **Haus**: das Haus, dessen Standort die Gemeinde ergibt. Leer: das erste Haus in Gladys mit
     einem Standort.
   - **Gemeinden (INSEE-Codes)**: nur um eine andere Gemeinde als die des Hauses zu verfolgen
     (Zweitwohnsitz, Gemeinde deiner Eltern…), bis zu 5. Achtung, der **INSEE-Code ist nicht die
     Postleitzahl**: Orléans hat die Postleitzahl 45000, aber den INSEE-Code 45234. Du findest
     ihn auf der Website des INSEE oder in Wikipedia.
   - **Verfolgte Badestellen**: die deiner Gemeinden (Standard), die im Umkreis von 5, 10 oder
     20 km um dein Haus, oder nur die, die du einträgst.
   - **Badestellen**: Codes aus „Badestellen suchen“ oder die Adressen ihrer Seiten auf
     baignades.sante.gouv.fr.
   - **Sprache der Namen und Texte**: standardmäßig Französisch.
3. Speichere, öffne dann den Tab **Entdecken** und klicke bei den gewünschten Geräten auf **Zu
   Gladys hinzufügen**.

### Badestellen suchen

Die Aktion **„Badestellen suchen“** im Tab Konfiguration listet die Badestellen einer Gemeinde
auf (gib ihren INSEE-Code ein) oder, wenn das Feld leer bleibt, die der Gemeinden rund um dein
Haus (5, 10 oder 20 km), jeweils mit ihrem Code. Kopiere die gewünschten Codes in
**Badestellen** und speichere.

## Die Geräte

### Leitungswasser

| Funktion                           | Was sie zeigt                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Bakteriologische Konformität       | Risiko-Plakette: grün (konform), gelb (konform mit Ausnahmegenehmigung), rot (nicht konform)                         |
| Physikalisch-chemische Konformität | Dasselbe für die chemischen Parameter (Nitrat, Pestizide, Metalle…)                                                  |
| Gesundheitliches Fazit             | Der Text der ARS zur letzten Probe, auf Französisch                                                                  |
| Letzte Probe                       | Das Datum der letzten veröffentlichten Probe                                                                         |
| Nitrat (mg/L)                      | Der Qualitätsgrenzwert liegt bei 50 mg/L                                                                             |
| Wasserhärte (°f)                   | In französischen Graden: unter 15 °f weiches Wasser, über 30 °f hartes Wasser                                        |
| Chlor (mg/L)                       | Freies Chlor, oder Gesamtchlor, wenn nur dieses gemessen wird; „<0,10“ (unter der Laborschwelle) wird als 0 gesendet |
| pH-Wert                            | Zwischen 6,5 und 9 bei konformem Wasser                                                                              |

Jede Konformität stammt aus der **letzten Probe, die sie bewertet hat**: Eine Routinekontrolle
sucht oft nur nach Bakterien, ohne chemische Analyse. Die Zahlen sind die neuesten der letzten
zwei Jahre (die Härte wird in kleinen Gemeinden einmal im Jahr oder seltener gemessen). Gladys
hat keine Einheit für mg/L und französische Grade: Diese Werte werden ohne Einheit
veröffentlicht, und der Name der Funktion nennt sie.

Die Parameter des Geräts nennen den Wasserversorger (`DISTRIBUTOR`) und die Versorgungsnetze der
letzten Probe (`NETWORKS`).

### Badestelle

| Funktion         | Was sie zeigt                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Wasserqualität   | Risiko-Plakette: grün (gut), gelb (mittel), orange (schlecht), rot (Baden verboten); nichts außerhalb der Saison        |
| Letztes Ergebnis | In Worten: Gut, Mittel, Schlecht, Baden verboten, Außerhalb der Saison, Noch keine Probe, Ergebnis nicht veröffentlicht |
| Letzte Probe     | Das Datum des letzten veröffentlichten Ergebnisses                                                                      |
| Badesaison       | „Geöffnet bis 31.08.“, „Geschlossen (Saison 15.06. bis 31.08.)“, „Ganzjährig“ in Übersee                                |

Das Ergebnis einer Probe (gut, mittel, schlecht) hängt von den gemessenen Bakterien ab (E. coli,
Enterokokken). Es ist nicht die **Einstufung** am Saisonende (ausgezeichnet, gut, ausreichend,
mangelhaft), die über vier Jahre berechnet wird und die die Integration nicht liest.

## Widget

Das Widget **Wasserqualität** zeigt ohne Einstellung eine Zeile pro Gemeinde (konform oder nicht,
mit Härte) und pro Badestelle (letztes Ergebnis mit Datum) in Farbe, die Härte deiner Gemeinde
als Kachel und eine rote Überschrift, wenn das Leitungswasser nicht konform ist oder vom Baden
abgeraten wird. Wählst du in seinen Einstellungen ein Gerät, zeigt es dessen Details: Nitrat,
Härte, Chlor und pH-Wert live und das gesundheitliche Fazit bei einer Gemeinde; Ergebnis, Datum
und Saison mit einem Link zur offiziellen Seite bei einer Badestelle.

## Szenen-Auslöser

- **Leitungswasser nicht konform**: Eine neue Probe einer verfolgten Gemeinde überschreitet einen
  Qualitätsgrenzwert. Filter: die Gemeinde. Variablen: Name der Gemeinde, Datum der Probe,
  gesundheitliches Fazit, bakteriologische und physikalisch-chemische Konformität (`compliant`,
  `derogation`, `non_compliant`, `not_measured`). Er löst einmal pro Probe aus, nie bei der
  ersten Abfrage und nie für eine Probe, die älter als 90 Tage ist.
- **Baden nicht empfohlen oder verboten**: Eine verfolgte Badestelle erhält ein schlechtes
  Ergebnis oder ein Badeverbot. Filter: die Badestelle, der neue Zustand (`poor`, `prohibited`).
  Variablen: Name der Badestelle, Zustand, Zustand ausgeschrieben, Datum der letzten Probe.

Um auf die Rückkehr zur Normalität zu reagieren, nutzt du den nativen Gladys-Auslöser „Der
Zustand eines Geräts ändert sich“ auf der Plakette des Geräts.

## Beispiel-Szenen

- **Warnung zum Leitungswasser**: Auslöser „Leitungswasser nicht konform“, Aktion „Nachricht
  senden“ mit den Variablen des Auslösers: „Leitungswasser in _Name der Gemeinde_ nicht konform
  (Probe vom _Datum_): _gesundheitliches Fazit_“.
- **Vor dem Strandbesuch**: jeden Samstag um 9 Uhr, wenn die Plakette „Wasserqualität“ des Sees
  unter 2 liegt, „Baden im See heute Morgen möglich“ senden.
- **Baden verboten**: Auslöser „Baden nicht empfohlen oder verboten“, Zustand „verboten“, Aktion
  „Nachricht senden“ an die ganze Familie.
- **Enthärtungsanlage**: ein Diagramm der Härte über ein Jahr, um die Enthärtungsanlage oder den
  Geschirrspüler einzustellen.

## Fehlerbehebung

- **Kein Gerät im Tab Entdecken**: Der Konfigurationsbildschirm sagt warum (Haus ohne Standort,
  unbekannter INSEE-Code…). Gib deinem Haus einen Standort oder trage einen INSEE-Code ein.
- **„Seit einem Jahr keine Leitungswasserprobe veröffentlicht“**: Prüfe, ob du den INSEE-Code und
  nicht die Postleitzahl eingetragen hast. Für Paris, Lyon und Marseille probiere den Code der
  ganzen Stadt (75056, 69123, 13055) und dann den des Arrondissements.
- **Die letzte Probe ist mehrere Wochen alt**: normal, die Ergebnisse erscheinen etwa einmal im
  Monat.
- **Eine Badestelle bleibt „Außerhalb der Saison“ oder „Noch keine Probe“**: Die Saison hat noch
  nicht begonnen, oder die erste Probe ist noch nicht veröffentlicht.
- **„Hub'Eau antwortet nicht“ oder „baignades.sante.gouv.fr antwortet nicht“**: Der Dienst ist
  nicht erreichbar; die Integration versucht es jede Stunde erneut und behält die letzten Werte.
- Für mehr Details setze `LOG_LEVEL=debug`: Jede Abfrage wird dann in die Protokolle der
  Integration geschrieben (nie der Standort deines Hauses).

## Grenzen

- **Auf Ebene der Gemeinde**: In einer großen Stadt mit mehreren Versorgungsnetzen kann die
  letzte Probe aus einem anderen Viertel stammen (der Parameter `NETWORKS` nennt es).
- Die Ergebnisse kommen verspätet: einige Tage bis einige Wochen beim Leitungswasser. Das ist
  keine Echtzeitwarnung.
- Die Badestellen werden von den Seiten von baignades.sante.gouv.fr gelesen, das keine
  dokumentierte öffentliche API hat: Eine Änderung dieser Seiten kann das Lesen bis zu einem
  Update der Integration unterbrechen. Die Einstufung am Saisonende wird nicht gelesen.
- „Rund um mein Haus“ berücksichtigt die Gemeinden, deren **Zentrum** im Umkreis liegt, laut
  geo.api.gouv.fr.
- Höchstens 5 Gemeinden und 10 Badestellen.
- Takt und Kontingente: Weder Hub'Eau noch baignades.sante.gouv.fr veröffentlichen ein
  Kontingent; die Integration stellt fünf oder sechs kleine Hub'Eau-Anfragen pro Gemeinde und Tag, eine Anfrage pro
  Badestelle und Tag und fragt die Liste der Badestellen und die Gemeinde des Hauses einmal pro
  Woche neu ab. geo.api.gouv.fr erlaubt 50 Anfragen pro Sekunde.

## Quellen und Lizenz

- Leitungswasser: [Hub'Eau – Trinkwasserqualität](https://hubeau.eaufrance.fr/page/api-qualite-eau-potable),
  Ergebnisse der Gesundheitskontrolle des Gesundheitsministeriums, Licence Ouverte Etalab 2.0.
- Baden: [baignades.sante.gouv.fr](https://baignades.sante.gouv.fr), Gesundheitsministerium und
  ARS.
- Gemeinden: [API Découpage administratif](https://geo.api.gouv.fr), Licence Ouverte Etalab 2.0.
- Der Standort deines Hauses wird nur an geo.api.gouv.fr gesendet, auf etwa 100 m gerundet, und
  weder gespeichert noch in die Protokolle geschrieben.
- Nicht mit OFB / eaufrance, BRGM oder dem Gesundheitsministerium verbunden. Code unter der
  Lizenz Apache 2.0.
