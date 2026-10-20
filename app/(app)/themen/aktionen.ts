"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nurInhaber } from "@/lib/kontext";
import type { Thema, Zustand } from "@/lib/typen";

export async function vorlageUebernehmen(vorlageId: string): Promise<void> {
  const { supabase, betrieb } = await nurInhaber();
  const { data, error } = await supabase
    .from("thema")
    .select("*")
    .eq("id", vorlageId)
    .is("betrieb_id", null)
    .single();
  if (error) throw new Error(error.message);
  const v = data as Thema;
  const { data: neu, error: e2 } = await supabase
    .from("thema")
    .insert({
      betrieb_id: betrieb.id,
      vorlage_id: v.id,
      titel: v.titel,
      kurzbeschreibung: v.kurzbeschreibung,
      inhalt: v.inhalt,
      intervall_monate: v.intervall_monate,
      erfordert_uebung: v.erfordert_uebung,
    })
    .select("id")
    .single();
  if (e2) throw new Error(e2.message);
  revalidatePath("/themen");
  redirect(`/themen/${neu.id}`);
}

export async function themaAnlegen(_: Zustand, daten: FormData): Promise<Zustand> {
  const { supabase, betrieb } = await nurInhaber();
  const titel = String(daten.get("titel") ?? "").trim();
  if (titel.length < 2) return { fehler: "Bitte einen Titel eingeben." };
  const { data, error } = await supabase
    .from("thema")
    .insert({ betrieb_id: betrieb.id, titel, inhalt: "" })
    .select("id")
    .single();
  if (error) return { fehler: error.message };
  redirect(`/themen/${data.id}`);
}

const ThemaDaten = z.object({
  titel: z.string().trim().min(2, "Titel fehlt").max(200),
  kurzbeschreibung: z.string().trim().max(500).transform((s) => s || null),
  inhalt: z.string().max(50000),
  intervall_monate: z.coerce.number().int().min(1, "Intervall 1–60 Monate").max(60, "Intervall 1–60 Monate"),
  erfordert_uebung: z.boolean(),
  aktiv: z.boolean(),
});

export async function themaSpeichern(id: string, _: Zustand, daten: FormData): Promise<Zustand> {
  const { supabase } = await nurInhaber();
  const e = ThemaDaten.safeParse({
    titel: daten.get("titel") ?? "",
    kurzbeschreibung: daten.get("kurzbeschreibung") ?? "",
    inhalt: String(daten.get("inhalt") ?? "").replace(/\r\n/g, "\n"),
    intervall_monate: daten.get("intervall_monate"),
    erfordert_uebung: daten.get("erfordert_uebung") === "on",
    aktiv: daten.get("aktiv") === "on",
  });
  if (!e.success) return { fehler: e.error.issues[0]?.message };
  const { data, error } = await supabase.from("thema").update(e.data).eq("id", id).select("pruefstatus").single();
  if (error) return { fehler: error.message };
  revalidatePath(`/themen/${id}`);
  revalidatePath("/themen");
  return {
    ok:
      data.pruefstatus === "geprueft"
        ? "Gespeichert."
        : "Gespeichert. Der Prüfstatus ist „noch nicht geprüft“ – bitte nach fachlicher Prüfung bestätigen.",
  };
}

export async function pruefungBestaetigen(id: string, _: Zustand, daten: FormData): Promise<Zustand> {
  const { supabase } = await nurInhaber();
  const von = String(daten.get("geprueft_von") ?? "").trim();
  const am = String(daten.get("geprueft_am") ?? "").trim();
  if (von.length < 2) return { fehler: "Bitte angeben, wer den Inhalt geprüft hat." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(am)) return { fehler: "Bitte das Prüfdatum angeben." };
  if (daten.get("bestaetigt") !== "on") return { fehler: "Bitte die Prüfung ausdrücklich bestätigen." };
  const { error } = await supabase
    .from("thema")
    .update({ pruefstatus: "geprueft", geprueft_von: von, geprueft_am: am })
    .eq("id", id);
  if (error) return { fehler: error.message };
  revalidatePath(`/themen/${id}`);
  revalidatePath("/themen");
  return { ok: "Prüfung vermerkt." };
}

export async function pruefungZuruecknehmen(id: string): Promise<void> {
  const { supabase } = await nurInhaber();
  const { error } = await supabase.from("thema").update({ pruefstatus: "nicht_geprueft" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/themen/${id}`);
  revalidatePath("/themen");
}
