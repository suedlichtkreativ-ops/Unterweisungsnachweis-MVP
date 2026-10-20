import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kanonischesJson, sha256Hex } from "./hash";
import { baueNachweisInhalt } from "./nachweis-inhalt";
import { erzeugeProtokoll } from "./pdf/protokoll";
import type { Betrieb, Mitarbeiter, Teilnahme, Unterweisung } from "./typen";

export const BUCKET = "nachweise";

/**
 * Schließt eine durchgeführte Unterweisung ab:
 * Datensatz festschreiben → Inhalts-Hash → PDF → PDF-Hash → Upload → DB-Abschluss (atomar per RPC).
 * Die Datenbank prüft u. a. den Inhalts-Hash und dass sich die Unterschriften nicht geändert haben.
 */
export async function schliesseAb(supabase: SupabaseClient, betrieb: Betrieb, unterweisungId: string) {
  const { data: u, error: e1 } = await supabase.from("unterweisung").select("*").eq("id", unterweisungId).single();
  if (e1) throw new Error(e1.message);
  const { data: tn, error: e2 } = await supabase
    .from("teilnahme")
    .select("*, mitarbeiter(vorname, nachname, taetigkeit)")
    .eq("unterweisung_id", unterweisungId);
  if (e2) throw new Error(e2.message);
  const teilnahmen = tn as (Teilnahme & { mitarbeiter: Pick<Mitarbeiter, "vorname" | "nachname" | "taetigkeit"> })[];

  const anzahl = teilnahmen.filter((t) => t.unterschrieben_am).length;
  if (anzahl === 0) throw new Error("Mindestens eine Unterschrift ist erforderlich.");

  const inhalt = baueNachweisInhalt({
    betrieb,
    unterweisung: u as Unterweisung,
    teilnahmen,
    abgeschlossenAm: new Date().toISOString(),
  });
  const kanonisch = kanonischesJson(inhalt);
  const inhaltSha256 = sha256Hex(kanonisch);
  const pdf = await erzeugeProtokoll(inhalt, inhaltSha256);
  const pdfSha256 = sha256Hex(pdf);
  const pfad = `${betrieb.id}/${unterweisungId}/${pdfSha256}.pdf`;

  const { error: e3 } = await supabase.storage
    .from(BUCKET)
    .upload(pfad, pdf, { contentType: "application/pdf", upsert: false });
  if (e3) throw new Error(`PDF konnte nicht gespeichert werden: ${e3.message}`);

  const { error: e4 } = await supabase.rpc("unterweisung_abschliessen", {
    p_unterweisung_id: unterweisungId,
    p_storage_pfad: pfad,
    p_pdf_sha256: pdfSha256,
    p_inhalt_sha256: inhaltSha256,
    p_inhalt_kanonisch: kanonisch,
    p_anzahl_unterschriften: anzahl,
  });
  // Schlägt dies fehl, bleibt eine verwaiste PDF im Storage zurück (ohne Nachweis-Eintrag).
  // Sie ist nirgends verlinkt; siehe docs/offene-punkte.md.
  if (e4) throw new Error(e4.message);
  return { pdfSha256, inhaltSha256 };
}

export function dateiname(titel: string, datum: string): string {
  const sicher = titel
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `Unterweisung_${datum}_${sicher || "Nachweis"}.pdf`;
}
