// Fälligkeitsberechnung. Alle Daten als ISO-Datum "YYYY-MM-DD" (ohne Uhrzeit),
// damit Zeitzonen keine Rolle spielen.

export type Ampel = "gruen" | "gelb" | "rot";

export const VORWARNUNG_TAGE = 30;
/** § 29 Abs. 2 JArbSchG: Unterweisung Jugendlicher mindestens halbjährlich. */
export const MAX_INTERVALL_JUGENDLICHE = 6;

export interface Faelligkeit {
  ampel: Ampel;
  letzte: string | null;
  faelligAm: string | null;
  tageBisFaellig: number | null;
}

export function effektivesIntervall(intervallMonate: number, jugendlich: boolean): number {
  return jugendlich ? Math.min(intervallMonate, MAX_INTERVALL_JUGENDLICHE) : intervallMonate;
}

function parse(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`Ungültiges Datum: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Addiert Monate; am Monatsende wird auf den letzten Tag des Zielmonats gekürzt (31.01. + 1 = 28./29.02.). */
export function addiereMonate(datum: string, monate: number): string {
  const d = parse(datum);
  const zielMonat = d.getUTCMonth() + monate;
  const letzterTag = new Date(Date.UTC(d.getUTCFullYear(), zielMonat + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(d.getUTCFullYear(), zielMonat, Math.min(d.getUTCDate(), letzterTag))));
}

export function tageZwischen(von: string, bis: string): number {
  return Math.round((parse(bis).getTime() - parse(von).getTime()) / 86_400_000);
}

export function berechneFaelligkeit(p: {
  letzte: string | null;
  intervallMonate: number;
  jugendlich: boolean;
  heute: string;
  vorwarnTage?: number;
}): Faelligkeit {
  if (!p.letzte) {
    return { ampel: "rot", letzte: null, faelligAm: null, tageBisFaellig: null };
  }
  const faelligAm = addiereMonate(p.letzte, effektivesIntervall(p.intervallMonate, p.jugendlich));
  const tage = tageZwischen(p.heute, faelligAm);
  const ampel: Ampel = tage < 0 ? "rot" : tage <= (p.vorwarnTage ?? VORWARNUNG_TAGE) ? "gelb" : "gruen";
  return { ampel, letzte: p.letzte, faelligAm, tageBisFaellig: tage };
}

/** Heutiges Datum in Deutschland (Europe/Berlin) als ISO-Datum. */
export function heuteBerlin(jetzt: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(jetzt);
}

/** Letzte Unterweisung je (Mitarbeiter, Thema). Schlüssel: `${mitarbeiterId}:${themaId}`. */
export function letzteUnterweisungen(
  eintraege: { mitarbeiter_id: string; thema_id: string; datum: string }[],
): Map<string, string> {
  const ergebnis = new Map<string, string>();
  for (const e of eintraege) {
    const schluessel = `${e.mitarbeiter_id}:${e.thema_id}`;
    const bisher = ergebnis.get(schluessel);
    if (!bisher || e.datum > bisher) ergebnis.set(schluessel, e.datum);
  }
  return ergebnis;
}

const RANG: Record<Ampel, number> = { rot: 0, gelb: 1, gruen: 2 };
export function schlechteste(ampeln: Ampel[]): Ampel {
  return ampeln.reduce<Ampel>((a, b) => (RANG[b] < RANG[a] ? b : a), "gruen");
}
