"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseAnon } from "@/lib/supabase/server";
import type { Zustand } from "@/lib/typen";

export async function unterschreiben(token: string, _: Zustand, daten: FormData): Promise<Zustand> {
  const name = String(daten.get("name") ?? "").trim();
  if (name.length < 2) return { fehler: "Bitte Vor- und Nachnamen eingeben." };
  if (daten.get("bestaetigt") !== "on") return { fehler: "Bitte die Aussage ausdrücklich bestätigen." };
  const userAgent = (await headers()).get("user-agent") ?? "unbekannt";

  const { error } = await supabaseAnon().rpc("teilnahme_unterschreiben", {
    p_token: token,
    p_name: name,
    p_user_agent: userAgent,
    p_uebung: daten.get("uebung") === "on",
  });
  if (error) return { fehler: error.message };
  revalidatePath(`/u/${token}`);
  return { ok: "Danke! Ihre Bestätigung wurde gespeichert." };
}
