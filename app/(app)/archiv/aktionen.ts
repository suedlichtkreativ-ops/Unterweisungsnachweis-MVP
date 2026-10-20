"use server";

import { holeKontext } from "@/lib/kontext";
import { datum } from "@/lib/format";

export interface PruefErgebnis {
  treffer: boolean;
  text: string;
  unterweisungId?: string;
}

/** Sucht einen Nachweis anhand der SHA-256-Prüfsumme einer vorliegenden PDF-Datei. */
export async function pruefsummePruefen(sha256: string): Promise<PruefErgebnis> {
  if (!/^[0-9a-f]{64}$/.test(sha256)) return { treffer: false, text: "Ungültige Prüfsumme." };
  const { supabase } = await holeKontext();
  const { data } = await supabase
    .from("nachweis")
    .select("unterweisung_id, erzeugt_am, unterweisung(datum, thema_snapshot)")
    .eq("pdf_sha256", sha256)
    .maybeSingle();
  if (!data) {
    return {
      treffer: false,
      text: "Keine Übereinstimmung. Die Datei stammt nicht aus diesem Archiv oder wurde verändert.",
    };
  }
  const u = data.unterweisung as unknown as { datum: string; thema_snapshot: { titel: string } };
  return {
    treffer: true,
    text: `Unverändert. Die Datei entspricht dem Nachweis „${u.thema_snapshot.titel}“ vom ${datum(u.datum)}.`,
    unterweisungId: data.unterweisung_id,
  };
}
