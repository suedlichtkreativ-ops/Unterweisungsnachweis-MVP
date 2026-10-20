"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nurInhaber } from "@/lib/kontext";
import type { Zustand } from "@/lib/typen";

const MitarbeiterDaten = z.object({
  vorname: z.string().trim().min(1, "Vorname fehlt").max(100),
  nachname: z.string().trim().min(1, "Nachname fehlt").max(100),
  taetigkeit: z.string().trim().max(120).transform((s) => s || null),
  eintritt: z
    .string()
    .trim()
    .transform((s) => s || null)
    .pipe(z.iso.date("Ungültiges Datum").nullable()),
  jugendlich: z.boolean(),
});

function lese(daten: FormData) {
  return MitarbeiterDaten.safeParse({
    vorname: daten.get("vorname") ?? "",
    nachname: daten.get("nachname") ?? "",
    taetigkeit: daten.get("taetigkeit") ?? "",
    eintritt: daten.get("eintritt") ?? "",
    jugendlich: daten.get("jugendlich") === "on",
  });
}

export async function mitarbeiterAnlegen(_: Zustand, daten: FormData): Promise<Zustand> {
  const { supabase, betrieb } = await nurInhaber();
  const e = lese(daten);
  if (!e.success) return { fehler: e.error.issues[0]?.message };
  const { error } = await supabase.from("mitarbeiter").insert({ ...e.data, betrieb_id: betrieb.id });
  if (error) return { fehler: error.message };
  revalidatePath("/mitarbeiter");
  return { ok: `${e.data.vorname} ${e.data.nachname} wurde angelegt.` };
}

export async function mitarbeiterSpeichern(id: string, _: Zustand, daten: FormData): Promise<Zustand> {
  const { supabase } = await nurInhaber();
  const e = lese(daten);
  if (!e.success) return { fehler: e.error.issues[0]?.message };
  const { error } = await supabase.from("mitarbeiter").update(e.data).eq("id", id);
  if (error) return { fehler: error.message };
  revalidatePath("/mitarbeiter");
  return { ok: "Gespeichert." };
}

export async function mitarbeiterAktivSetzen(id: string, aktiv: boolean): Promise<void> {
  const { supabase } = await nurInhaber();
  const { error } = await supabase.from("mitarbeiter").update({ aktiv }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/mitarbeiter");
  revalidatePath(`/mitarbeiter/${id}`);
}

export async function mitarbeiterLoeschen(id: string, _: Zustand): Promise<Zustand> {
  const { supabase } = await nurInhaber();
  const { error } = await supabase.from("mitarbeiter").delete().eq("id", id);
  if (error) {
    return {
      fehler:
        error.code === "23503"
          ? "Für diese Person gibt es bereits Unterweisungen. Bitte stattdessen deaktivieren – die Nachweise müssen aufbewahrt werden."
          : error.message,
    };
  }
  revalidatePath("/mitarbeiter");
  redirect("/mitarbeiter");
}
