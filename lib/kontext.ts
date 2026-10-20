import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import type { Betrieb, Mitglied } from "./typen";

/** Angemeldeter Nutzer + Betrieb. Leitet auf /login bzw. /einrichten um, wenn etwas fehlt. */
export const holeKontext = cache(async () => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("betrieb_mitglied")
    .select("betrieb_id, user_id, rolle, anzeigename, betrieb(id, name, anschrift, aufbewahrung_jahre)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) redirect("/einrichten");

  const { betrieb, ...mitglied } = data as unknown as Mitglied & { betrieb: Betrieb };
  return { supabase, user, mitglied, betrieb };
});

export async function nurInhaber() {
  const k = await holeKontext();
  if (k.mitglied.rolle !== "inhaber") throw new Error("Nur für Inhaber");
  return k;
}
