"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { appUrl } from "@/lib/app-url";
import type { Zustand } from "@/lib/typen";

const Zugang = z.object({
  email: z.email("Bitte eine gültige E-Mail-Adresse eingeben"),
  passwort: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen haben"),
});

export async function anmelden(_: Zustand, daten: FormData): Promise<Zustand> {
  const eingabe = Zugang.safeParse({ email: daten.get("email"), passwort: daten.get("passwort") });
  if (!eingabe.success) return { fehler: eingabe.error.issues[0]?.message };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: eingabe.data.email,
    password: eingabe.data.passwort,
  });
  if (error) return { fehler: "Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen." };
  redirect("/");
}

export async function registrieren(_: Zustand, daten: FormData): Promise<Zustand> {
  const eingabe = Zugang.safeParse({ email: daten.get("email"), passwort: daten.get("passwort") });
  if (!eingabe.success) return { fehler: eingabe.error.issues[0]?.message };
  if (daten.get("hinweise") !== "on") return { fehler: "Bitte die Hinweise zur Kenntnis nehmen." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: eingabe.data.email,
    password: eingabe.data.passwort,
    options: { emailRedirectTo: `${await appUrl()}/auth/callback` },
  });
  if (error) return { fehler: `Registrierung fehlgeschlagen: ${error.message}` };
  if (data.session) redirect("/einrichten");
  return { ok: "Fast geschafft: Bitte bestätigen Sie die E-Mail, die wir Ihnen gerade geschickt haben." };
}

const Einrichtung = z.object({
  name: z.string().trim().min(2, "Bitte den Namen des Betriebs eingeben").max(200),
  anschrift: z.string().trim().max(500),
  anzeigename: z.string().trim().min(2, "Bitte Ihren Namen eingeben").max(120),
});

export async function betriebEinrichten(_: Zustand, daten: FormData): Promise<Zustand> {
  const eingabe = Einrichtung.safeParse(Object.fromEntries(daten));
  if (!eingabe.success) return { fehler: eingabe.error.issues[0]?.message };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("betrieb_anlegen", {
    p_name: eingabe.data.name,
    p_anschrift: eingabe.data.anschrift,
    p_anzeigename: eingabe.data.anzeigename,
  });
  if (error) return { fehler: error.message };
  redirect("/themen?willkommen=1");
}
