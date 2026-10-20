import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Faelligkeit, berechneFaelligkeit, heuteBerlin, letzteUnterweisungen } from "./faelligkeit";
import type { Mitarbeiter, Thema } from "./typen";

export type ThemaKurz = Pick<Thema, "id" | "titel" | "intervall_monate" | "pruefstatus" | "erfordert_uebung">;

/** Lädt aktive Mitarbeitende und Themen und liefert die Fälligkeit je Kombination. */
export async function ladeFaelligkeiten(supabase: SupabaseClient, betriebId: string) {
  const heute = heuteBerlin();
  const [mitarbeiterRes, themenRes, teilnahmenRes] = await Promise.all([
    supabase.from("mitarbeiter").select("*").eq("aktiv", true).order("nachname").order("vorname"),
    supabase
      .from("thema")
      .select("id, titel, intervall_monate, pruefstatus, erfordert_uebung")
      .eq("betrieb_id", betriebId)
      .eq("aktiv", true)
      .order("titel"),
    // Gezählt wird nur: unterschrieben UND Unterweisung abgeschlossen (Nachweis existiert)
    supabase
      .from("teilnahme")
      .select("mitarbeiter_id, unterweisung!inner(thema_id, datum, status)")
      .not("unterschrieben_am", "is", null)
      .eq("unterweisung.status", "abgeschlossen"),
  ]);
  for (const r of [mitarbeiterRes, themenRes, teilnahmenRes]) if (r.error) throw new Error(r.error.message);

  const mitarbeiter = (mitarbeiterRes.data ?? []) as Mitarbeiter[];
  const themen = (themenRes.data ?? []) as ThemaKurz[];
  const letzte = letzteUnterweisungen(
    ((teilnahmenRes.data ?? []) as unknown as { mitarbeiter_id: string; unterweisung: { thema_id: string; datum: string } }[]).map(
      (t) => ({ mitarbeiter_id: t.mitarbeiter_id, thema_id: t.unterweisung.thema_id, datum: t.unterweisung.datum }),
    ),
  );

  const faelligkeit = (m: Mitarbeiter, t: ThemaKurz): Faelligkeit =>
    berechneFaelligkeit({
      letzte: letzte.get(`${m.id}:${t.id}`) ?? null,
      intervallMonate: t.intervall_monate,
      jugendlich: m.jugendlich,
      heute,
    });

  return { heute, mitarbeiter, themen, faelligkeit };
}
