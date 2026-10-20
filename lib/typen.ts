// Zeilentypen der Datenbank (von Hand gepflegt, siehe supabase/migrations).

export type Rolle = "inhaber" | "unterweisender";
export type Pruefstatus = "nicht_geprueft" | "geprueft";
export type UnterweisungStatus = "geplant" | "durchgefuehrt" | "abgeschlossen";

export interface Betrieb {
  id: string;
  name: string;
  anschrift: string | null;
  aufbewahrung_jahre: number | null;
}

export interface Mitglied {
  betrieb_id: string;
  user_id: string;
  rolle: Rolle;
  anzeigename: string;
}

export interface Mitarbeiter {
  id: string;
  betrieb_id: string;
  vorname: string;
  nachname: string;
  taetigkeit: string | null;
  eintritt: string | null;
  jugendlich: boolean;
  aktiv: boolean;
}

export interface Thema {
  id: string;
  betrieb_id: string | null;
  vorlage_id: string | null;
  titel: string;
  kurzbeschreibung: string | null;
  inhalt: string;
  intervall_monate: number;
  erfordert_uebung: boolean;
  pruefstatus: Pruefstatus;
  geprueft_von: string | null;
  geprueft_am: string | null;
  aktiv: boolean;
  geaendert_am: string;
}

export interface ThemaSnapshot {
  id: string;
  titel: string;
  kurzbeschreibung: string | null;
  inhalt: string;
  erfordert_uebung: boolean;
  pruefstatus: Pruefstatus;
  geprueft_von: string | null;
  geprueft_am: string | null;
  stand: string;
}

export interface Unterweisung {
  id: string;
  betrieb_id: string;
  thema_id: string;
  datum: string;
  ort: string | null;
  unterweisender_name: string;
  bemerkung: string | null;
  uebung_beschreibung: string | null;
  status: UnterweisungStatus;
  thema_snapshot: ThemaSnapshot | null;
  durchgefuehrt_am: string | null;
  abgeschlossen_am: string | null;
  nachtrag_zu: string | null;
  erstellt_am: string;
}

export interface Teilnahme {
  id: string;
  unterweisung_id: string;
  mitarbeiter_id: string;
  token_hash: string | null;
  token_laeuft_ab: string | null;
  unterschrift_name: string | null;
  aussage: string | null;
  unterschrieben_am: string | null;
  user_agent: string | null;
  uebung_bestaetigt: boolean | null;
}

export interface Nachweis {
  id: string;
  unterweisung_id: string;
  storage_pfad: string;
  pdf_sha256: string;
  inhalt_sha256: string;
  erzeugt_am: string;
}

/** Ergebnis von teilnahme_info() */
export interface TeilnahmeInfo {
  betrieb: string;
  status: UnterweisungStatus;
  datum: string;
  ort: string | null;
  unterweisender: string;
  uebung_beschreibung: string | null;
  thema: {
    titel: string;
    kurzbeschreibung: string | null;
    inhalt: string;
    erfordert_uebung: boolean;
    pruefstatus: Pruefstatus;
  };
  mitarbeiter: string;
  unterschrieben_am: string | null;
  aussage: string;
}

/** Rückgabe von Server Actions für Formulare */
export interface Zustand {
  fehler?: string;
  ok?: string;
}
