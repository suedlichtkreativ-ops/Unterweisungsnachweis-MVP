// Feste Texte an einer Stelle, damit App, PDF und Hinweisseite übereinstimmen.

export const APP_NAME = "Unterweisungsnachweis";

export const DISCLAIMER_KURZ =
  "Dokumentationswerkzeug – ersetzt nicht die persönliche Unterweisung. Keine Rechtsberatung. " +
  "Kein Angebot der BG BAU oder DGUV.";

export const DISCLAIMER_LANG = [
  "Diese Anwendung ist ein Werkzeug zur Planung und Dokumentation von Unterweisungen. " +
    "Sie ersetzt nicht die persönliche Unterweisung durch den Arbeitgeber oder eine beauftragte Person.",
  "Die Inhalte der Unterweisungsthemen liegen in der Verantwortung des Betriebs und müssen auf Grundlage " +
    "der eigenen Gefährdungsbeurteilung durch eine fachkundige Person erstellt und geprüft werden. " +
    "Die mitgelieferten Themen sind Platzhalter ohne fachlichen Inhalt.",
  "Die Anwendung stellt keine Rechtsberatung dar. Ob die Dokumentation im Einzelfall den Anforderungen genügt, " +
    "ist vom Betrieb eigenverantwortlich zu prüfen.",
  "Die Anwendung steht in keiner Verbindung zur BG BAU oder zur DGUV und wird von diesen weder herausgegeben " +
    "noch geprüft oder empfohlen.",
];

export const PDF_FUSSZEILE =
  "Dokumentationswerkzeug – ersetzt nicht die persönliche Unterweisung. Keine Rechtsberatung. " +
  "Kein Dokument der BG BAU oder DGUV.";

export const PRUEFSTATUS_TEXT = {
  geprueft: "fachlich geprüft",
  nicht_geprueft: "noch nicht geprüft",
} as const;

export const STATUS_TEXT = {
  geplant: "Geplant",
  durchgefuehrt: "Durchgeführt – Unterschriften laufen",
  abgeschlossen: "Abgeschlossen",
} as const;

export const LINK_GUELTIG_TAGE = 14;
