import type { Betrieb, Mitarbeiter, Teilnahme, Unterweisung } from "./typen";

/**
 * Der Datensatz, der im Nachweis festgeschrieben wird. Über seine kanonische
 * JSON-Darstellung wird inhalt_sha256 gebildet (steht im PDF und in der DB).
 * Formatänderungen nur mit neuer Versionskennung in `format`.
 */
export interface NachweisInhalt {
  format: "unterweisungsnachweis/v1";
  unterweisung_id: string;
  nachtrag_zu: string | null;
  betrieb: { name: string; anschrift: string | null };
  thema: {
    titel: string;
    kurzbeschreibung: string | null;
    inhalt: string;
    erfordert_uebung: boolean;
    pruefstatus: string;
    geprueft_von: string | null;
    geprueft_am: string | null;
    stand: string;
  };
  datum: string;
  ort: string | null;
  unterweisender: string;
  uebung_beschreibung: string | null;
  bemerkung: string | null;
  durchgefuehrt_am: string;
  teilnehmer: {
    mitarbeiter_id: string;
    name: string;
    taetigkeit: string | null;
    unterschrieben: boolean;
    unterschrift_name: string | null;
    unterschrieben_am: string | null;
    aussage: string | null;
    uebung_bestaetigt: boolean | null;
    user_agent: string | null;
  }[];
  abgeschlossen_am: string;
}

export function baueNachweisInhalt(p: {
  betrieb: Betrieb;
  unterweisung: Unterweisung;
  teilnahmen: (Teilnahme & { mitarbeiter: Pick<Mitarbeiter, "vorname" | "nachname" | "taetigkeit"> })[];
  abgeschlossenAm: string;
}): NachweisInhalt {
  const { unterweisung: u } = p;
  const s = u.thema_snapshot;
  if (u.status !== "durchgefuehrt" || !s || !u.durchgefuehrt_am) {
    throw new Error("Nur durchgeführte Unterweisungen können abgeschlossen werden");
  }
  const teilnehmer = p.teilnahmen
    .map((t) => ({
      mitarbeiter_id: t.mitarbeiter_id,
      name: `${t.mitarbeiter.vorname} ${t.mitarbeiter.nachname}`,
      taetigkeit: t.mitarbeiter.taetigkeit,
      unterschrieben: t.unterschrieben_am !== null,
      unterschrift_name: t.unterschrift_name,
      unterschrieben_am: t.unterschrieben_am,
      aussage: t.aussage,
      uebung_bestaetigt: t.uebung_bestaetigt,
      user_agent: t.user_agent,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de") || a.mitarbeiter_id.localeCompare(b.mitarbeiter_id));

  return {
    format: "unterweisungsnachweis/v1",
    unterweisung_id: u.id,
    nachtrag_zu: u.nachtrag_zu,
    betrieb: { name: p.betrieb.name, anschrift: p.betrieb.anschrift },
    thema: {
      titel: s.titel,
      kurzbeschreibung: s.kurzbeschreibung,
      inhalt: s.inhalt,
      erfordert_uebung: s.erfordert_uebung,
      pruefstatus: s.pruefstatus,
      geprueft_von: s.geprueft_von,
      geprueft_am: s.geprueft_am,
      stand: s.stand,
    },
    datum: u.datum,
    ort: u.ort,
    unterweisender: u.unterweisender_name,
    uebung_beschreibung: u.uebung_beschreibung,
    bemerkung: u.bemerkung,
    durchgefuehrt_am: u.durchgefuehrt_am,
    teilnehmer,
    abgeschlossen_am: p.abgeschlossenAm,
  };
}
