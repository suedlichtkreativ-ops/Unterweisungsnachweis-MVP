import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { NachweisInhalt } from "../nachweis-inhalt";
import { datum, zeitpunkt } from "../format";
import { APP_NAME, PDF_FUSSZEILE, PRUEFSTATUS_TEXT } from "../texte";

// A4 in Punkt
const BREITE = 595.28;
const HOEHE = 841.89;
const RAND = 50;
const FUSS = 60;
const TEXTBREITE = BREITE - 2 * RAND;
const GRAU = rgb(0.35, 0.35, 0.35);
const SCHWARZ = rgb(0, 0, 0);
const ROT = rgb(0.7, 0.1, 0.1);

interface Stil {
  font?: "normal" | "fett";
  groesse?: number;
  farbe?: ReturnType<typeof rgb>;
  einzug?: number;
  abstandDanach?: number;
}

/**
 * Erzeugt das PDF-Protokoll. Deterministisch: Gleicher Inhalt ergibt byte-gleiche Datei
 * (Erstellungsdatum kommt aus dem Inhalt, keine Zufalls-IDs).
 */
export async function erzeugeProtokoll(inhalt: NachweisInhalt, inhaltSha256: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
  const zeitstempel = new Date(inhalt.abgeschlossen_am);

  pdf.setTitle(`Unterweisungsnachweis – ${inhalt.thema.titel} – ${datum(inhalt.datum)}`);
  pdf.setSubject(`Inhalts-SHA-256: ${inhaltSha256}`);
  pdf.setAuthor(inhalt.betrieb.name);
  pdf.setCreator(APP_NAME);
  pdf.setProducer(APP_NAME);
  pdf.setKeywords([inhalt.unterweisung_id]);
  pdf.setCreationDate(zeitstempel);
  pdf.setModificationDate(zeitstempel);

  let seite!: PDFPage;
  let y = 0;

  const neueSeite = () => {
    seite = pdf.addPage([BREITE, HOEHE]);
    y = HOEHE - RAND;
  };

  const zeilenUmbruch = (text: string, font: PDFFont, groesse: number, breite: number): string[] => {
    const zeilen: string[] = [];
    for (const absatz of text.split("\n")) {
      const woerter = absatz.split(/\s+/).filter(Boolean);
      if (woerter.length === 0) {
        zeilen.push("");
        continue;
      }
      let zeile = "";
      for (const wort of woerter) {
        const versuch = zeile ? `${zeile} ${wort}` : wort;
        if (font.widthOfTextAtSize(versuch, groesse) <= breite) {
          zeile = versuch;
          continue;
        }
        if (zeile) zeilen.push(zeile);
        // Überlange Wörter (z. B. Hashes, User Agents) hart trennen
        let rest = wort;
        while (font.widthOfTextAtSize(rest, groesse) > breite) {
          let n = rest.length;
          while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), groesse) > breite) n--;
          zeilen.push(rest.slice(0, n));
          rest = rest.slice(n);
        }
        zeile = rest;
      }
      zeilen.push(zeile);
    }
    return zeilen;
  };

  const schreibe = (text: string, stil: Stil = {}) => {
    const font = stil.font === "fett" ? fett : normal;
    const groesse = stil.groesse ?? 10;
    const einzug = stil.einzug ?? 0;
    const zeilenhoehe = groesse * 1.35;
    for (const zeile of zeilenUmbruch(bereinige(text, font), font, groesse, TEXTBREITE - einzug)) {
      if (y - zeilenhoehe < FUSS) neueSeite();
      y -= zeilenhoehe;
      seite.drawText(zeile, { x: RAND + einzug, y, size: groesse, font, color: stil.farbe ?? SCHWARZ });
    }
    y -= stil.abstandDanach ?? 0;
  };

  const ueberschrift = (text: string) => {
    if (y - 40 < FUSS) neueSeite();
    y -= 8;
    schreibe(text, { font: "fett", groesse: 12, abstandDanach: 2 });
    seite.drawLine({
      start: { x: RAND, y: y - 2 },
      end: { x: BREITE - RAND, y: y - 2 },
      thickness: 0.5,
      color: GRAU,
    });
    y -= 8;
  };

  const feld = (bezeichnung: string, wert: string) => {
    schreibe(`${bezeichnung}: ${wert}`);
  };

  // ---------------------------------------------------------------- Kopf
  neueSeite();
  schreibe(inhalt.betrieb.name, { font: "fett", groesse: 11 });
  if (inhalt.betrieb.anschrift) schreibe(inhalt.betrieb.anschrift, { farbe: GRAU });
  y -= 14;
  schreibe("Nachweis über eine Unterweisung", { font: "fett", groesse: 18, abstandDanach: 4 });
  schreibe("Dokumentation gemäß § 12 ArbSchG und § 4 DGUV Vorschrift 1", { farbe: GRAU, abstandDanach: 6 });
  if (inhalt.nachtrag_zu) {
    schreibe(`Nachtrag zur Unterweisung ${inhalt.nachtrag_zu}`, { font: "fett", farbe: ROT, abstandDanach: 4 });
  }

  // ---------------------------------------------------------------- Angaben
  ueberschrift("Angaben zur Unterweisung");
  feld("Thema", inhalt.thema.titel);
  feld("Datum", datum(inhalt.datum));
  feld("Ort", inhalt.ort || "–");
  feld("Unterweisende Person", inhalt.unterweisender);
  feld("Als durchgeführt erfasst", zeitpunkt(inhalt.durchgefuehrt_am));
  feld(
    "Prüfstatus des Inhalts",
    inhalt.thema.pruefstatus === "geprueft"
      ? `${PRUEFSTATUS_TEXT.geprueft} von ${inhalt.thema.geprueft_von ?? "–"} am ${datum(inhalt.thema.geprueft_am)}`
      : PRUEFSTATUS_TEXT.nicht_geprueft,
  );
  if (inhalt.thema.pruefstatus !== "geprueft") {
    schreibe("Hinweis: Der Unterweisungsinhalt war zum Zeitpunkt der Unterweisung nicht als fachlich geprüft markiert.", {
      farbe: ROT,
    });
  }
  if (inhalt.thema.erfordert_uebung) {
    feld("Praktische Übung", inhalt.uebung_beschreibung || "durchgeführt (ohne Beschreibung)");
  }
  if (inhalt.bemerkung) feld("Bemerkung", inhalt.bemerkung);

  // ---------------------------------------------------------------- Inhalt
  ueberschrift("Inhalt der Unterweisung");
  if (inhalt.thema.kurzbeschreibung) schreibe(inhalt.thema.kurzbeschreibung, { abstandDanach: 4 });
  for (const zeile of inhalt.thema.inhalt.split("\n")) {
    const z = zeile.trimEnd();
    if (z.startsWith("#")) {
      y -= 3;
      schreibe(z.replace(/^#+\s*/, ""), { font: "fett" });
    } else if (/^\s*[-*]\s+/.test(z)) {
      schreibe("•  " + z.replace(/^\s*[-*]\s+/, ""), { einzug: 8 });
    } else {
      schreibe(z);
    }
  }
  schreibe(`Stand des Inhalts: ${zeitpunkt(inhalt.thema.stand)}`, { farbe: GRAU, groesse: 8 });

  // ---------------------------------------------------------------- Teilnehmer
  ueberschrift("Teilnehmende und Bestätigungen");
  const unterschrieben = inhalt.teilnehmer.filter((t) => t.unterschrieben).length;
  schreibe(`${unterschrieben} von ${inhalt.teilnehmer.length} vorgesehenen Teilnehmenden haben bestätigt.`, {
    abstandDanach: 6,
  });
  inhalt.teilnehmer.forEach((t, i) => {
    if (y - 70 < FUSS) neueSeite();
    schreibe(`${i + 1}. ${t.name}${t.taetigkeit ? ` (${t.taetigkeit})` : ""}`, { font: "fett" });
    if (t.unterschrieben) {
      schreibe(`Eingegebener Name: ${t.unterschrift_name}`, { einzug: 12 });
      schreibe(`Bestätigt am: ${zeitpunkt(t.unterschrieben_am)}`, { einzug: 12 });
      schreibe(`Bestätigte Aussage: „${t.aussage}“`, { einzug: 12 });
      if (t.user_agent) schreibe(`Gerät (User Agent): ${t.user_agent}`, { einzug: 12, groesse: 7, farbe: GRAU });
    } else {
      schreibe("Nicht bestätigt (keine Unterschrift bis zum Abschluss).", { einzug: 12, farbe: ROT });
    }
    y -= 6;
  });

  // ---------------------------------------------------------------- Prüfvermerk
  ueberschrift("Prüfvermerk");
  schreibe(
    "Die Bestätigungen wurden elektronisch über einen persönlichen Link abgegeben (Eingabe des Namens und " +
      "ausdrückliche Bestätigung der obigen Aussage). Der Nachweis wurde beim Abschluss automatisch erzeugt " +
      "und ist danach in der Anwendung nicht mehr änderbar.",
    { abstandDanach: 4 },
  );
  feld("Abgeschlossen am", zeitpunkt(inhalt.abgeschlossen_am));
  feld("Vorgangs-ID", inhalt.unterweisung_id);
  schreibe("SHA-256 des festgeschriebenen Datensatzes:", { abstandDanach: 0 });
  schreibe(inhaltSha256, { font: "fett", groesse: 9 });
  schreibe(
    "Die Prüfsumme der PDF-Datei selbst wird in der Anwendung (Archiv) angezeigt und kann dort mit einer " +
      "vorliegenden Datei abgeglichen werden.",
    { farbe: GRAU, groesse: 8 },
  );

  // ---------------------------------------------------------------- Fußzeilen
  const seiten = pdf.getPages();
  seiten.forEach((s, i) => {
    const fuss = bereinige(PDF_FUSSZEILE, normal);
    s.drawLine({ start: { x: RAND, y: 42 }, end: { x: BREITE - RAND, y: 42 }, thickness: 0.5, color: GRAU });
    zeilenUmbruch(fuss, normal, 7, TEXTBREITE - 60).forEach((zeile, j) => {
      s.drawText(zeile, { x: RAND, y: 32 - j * 9, size: 7, font: normal, color: GRAU });
    });
    const seitenText = `Seite ${i + 1} von ${seiten.length}`;
    s.drawText(seitenText, {
      x: BREITE - RAND - normal.widthOfTextAtSize(seitenText, 7),
      y: 32,
      size: 7,
      font: normal,
      color: GRAU,
    });
  });

  return pdf.save({ useObjectStreams: false });
}

/** Ersetzt Zeichen, die die Standardschrift (WinAnsi) nicht darstellen kann. */
function bereinige(text: string, font: PDFFont): string {
  const erlaubt = new Set(font.getCharacterSet());
  return Array.from(text.replace(/\t/g, "  "))
    .map((z) => (z === "\n" || erlaubt.has(z.codePointAt(0)!) ? z : "?"))
    .join("");
}
