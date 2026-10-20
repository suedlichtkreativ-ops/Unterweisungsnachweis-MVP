import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Nachweis, ThemaSnapshot, Unterweisung } from "./typen";

export type ArchivEintrag = Nachweis & {
  unterweisung: Pick<Unterweisung, "id" | "datum" | "ort" | "unterweisender_name" | "nachtrag_zu"> & {
    thema_snapshot: ThemaSnapshot;
    teilnahme: {
      unterschrieben_am: string | null;
      mitarbeiter_id: string;
      mitarbeiter: { vorname: string; nachname: string };
    }[];
  };
};

export interface ArchivFilter {
  jahr?: string;
  thema?: string;
  mitarbeiter?: string;
}

export async function ladeArchiv(supabase: SupabaseClient, filter: ArchivFilter): Promise<ArchivEintrag[]> {
  let abfrage = supabase
    .from("nachweis")
    .select(
      "*, unterweisung!inner(id, datum, ort, unterweisender_name, nachtrag_zu, thema_id, thema_snapshot, " +
        "teilnahme(unterschrieben_am, mitarbeiter_id, mitarbeiter(vorname, nachname)))",
    )
    .order("erzeugt_am", { ascending: false });
  if (filter.jahr && /^\d{4}$/.test(filter.jahr)) {
    abfrage = abfrage.gte("unterweisung.datum", `${filter.jahr}-01-01`).lte("unterweisung.datum", `${filter.jahr}-12-31`);
  }
  if (filter.thema) abfrage = abfrage.eq("unterweisung.thema_id", filter.thema);
  const { data, error } = await abfrage;
  if (error) throw new Error(error.message);
  let eintraege = (data ?? []) as unknown as ArchivEintrag[];
  if (filter.mitarbeiter) {
    eintraege = eintraege.filter((e) => e.unterweisung.teilnahme.some((t) => t.mitarbeiter_id === filter.mitarbeiter));
  }
  return eintraege.sort((a, b) => b.unterweisung.datum.localeCompare(a.unterweisung.datum));
}
