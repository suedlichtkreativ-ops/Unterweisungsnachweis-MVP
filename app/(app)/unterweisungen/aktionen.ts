"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { holeKontext } from "@/lib/kontext";
import { neuerToken } from "@/lib/hash";
import { appUrl } from "@/lib/app-url";
import { schliesseAb } from "@/lib/abschluss";
import { LINK_GUELTIG_TAGE } from "@/lib/texte";
import type { Zustand } from "@/lib/typen";

const Angaben = z.object({
  datum: z.iso.date("Bitte ein Datum angeben"),
  ort: z.string().trim().max(200).transform((s) => s || null),
  unterweisender_name: z.string().trim().min(2, "Bitte die unterweisende Person angeben").max(200),
  uebung_beschreibung: z.string().trim().max(2000).transform((s) => s || null),
});

function leseAngaben(daten: FormData) {
  return Angaben.safeParse({
    datum: daten.get("datum") ?? "",
    ort: daten.get("ort") ?? "",
    unterweisender_name: daten.get("unterweisender_name") ?? "",
    uebung_beschreibung: daten.get("uebung_beschreibung") ?? "",
  });
}

function pfadeNeuLaden(id?: string) {
  revalidatePath("/unterweisungen");
  revalidatePath("/");
  if (id) revalidatePath(`/unterweisungen/${id}`);
}

export async function unterweisungAnlegen(_: Zustand, daten: FormData): Promise<Zustand> {
  const { supabase, betrieb, user } = await holeKontext();
  const e = leseAngaben(daten);
  if (!e.success) return { fehler: e.error.issues[0]?.message };
  const themaId = String(daten.get("thema_id") ?? "");
  const nachtragZu = String(daten.get("nachtrag_zu") ?? "") || null;
  const bemerkung = String(daten.get("bemerkung") ?? "").trim() || null;
  const mitarbeiter = daten.getAll("mitarbeiter").map(String);
  if (!themaId) return { fehler: "Bitte ein Thema wählen." };
  if (mitarbeiter.length === 0) return { fehler: "Bitte mindestens eine teilnehmende Person auswählen." };
  if (nachtragZu && !bemerkung) return { fehler: "Bitte den Grund für den Nachtrag angeben." };

  const { data: u, error } = await supabase
    .from("unterweisung")
    .insert({
      ...e.data,
      betrieb_id: betrieb.id,
      thema_id: themaId,
      bemerkung,
      nachtrag_zu: nachtragZu,
      unterweisender_user_id: user.id,
    })
    .select("id")
    .single();
  if (error) return { fehler: error.message };

  const { error: e2 } = await supabase
    .from("teilnahme")
    .insert(mitarbeiter.map((m) => ({ betrieb_id: betrieb.id, unterweisung_id: u.id, mitarbeiter_id: m })));
  if (e2) {
    await supabase.from("unterweisung").delete().eq("id", u.id);
    return { fehler: e2.message };
  }
  pfadeNeuLaden();
  redirect(`/unterweisungen/${u.id}`);
}

export async function angabenSpeichern(id: string, _: Zustand, daten: FormData): Promise<Zustand> {
  const { supabase } = await holeKontext();
  const e = leseAngaben(daten);
  if (!e.success) return { fehler: e.error.issues[0]?.message };
  const { error } = await supabase.from("unterweisung").update(e.data).eq("id", id);
  if (error) return { fehler: error.message };
  pfadeNeuLaden(id);
  return { ok: "Gespeichert." };
}

export async function teilnehmerHinzufuegen(id: string, _: Zustand, daten: FormData): Promise<Zustand> {
  const { supabase, betrieb } = await holeKontext();
  const mitarbeiter = daten.getAll("mitarbeiter").map(String);
  if (mitarbeiter.length === 0) return { fehler: "Bitte mindestens eine Person auswählen." };
  const { error } = await supabase
    .from("teilnahme")
    .insert(mitarbeiter.map((m) => ({ betrieb_id: betrieb.id, unterweisung_id: id, mitarbeiter_id: m })));
  if (error) return { fehler: error.message };
  pfadeNeuLaden(id);
  return { ok: "Hinzugefügt." };
}

export async function teilnehmerEntfernen(unterweisungId: string, teilnahmeId: string): Promise<void> {
  const { supabase } = await holeKontext();
  const { error } = await supabase.from("teilnahme").delete().eq("id", teilnahmeId);
  if (error) throw new Error(error.message);
  pfadeNeuLaden(unterweisungId);
}

export async function unterweisungLoeschen(id: string): Promise<void> {
  const { supabase } = await holeKontext();
  const { error } = await supabase.from("unterweisung").delete().eq("id", id);
  if (error) throw new Error(error.message);
  pfadeNeuLaden();
  redirect("/unterweisungen");
}

export async function alsDurchgefuehrtMarkieren(
  id: string,
  erfordertUebung: boolean,
  _: Zustand,
  daten: FormData,
): Promise<Zustand> {
  const { supabase } = await holeKontext();
  if (daten.get("persoenlich") !== "on") {
    return { fehler: "Bitte bestätigen, dass die Unterweisung persönlich stattgefunden hat." };
  }
  const aenderung: Record<string, unknown> = { status: "durchgefuehrt" };
  if (erfordertUebung) {
    const beschreibung = String(daten.get("uebung_beschreibung") ?? "").trim();
    if (daten.get("uebung") !== "on" || beschreibung.length < 3) {
      return { fehler: "Bitte die praktische Übung bestätigen und kurz beschreiben." };
    }
    aenderung.uebung_beschreibung = beschreibung;
  }
  const { error } = await supabase.from("unterweisung").update(aenderung).eq("id", id);
  if (error) return { fehler: error.message };
  pfadeNeuLaden(id);
  return { ok: "Als durchgeführt markiert. Die Teilnehmenden können jetzt unterschreiben." };
}

export interface ErzeugterLink {
  teilnahmeId: string;
  url: string;
}

/**
 * Erzeugt neue Unterschrifts-Links. Der Token wird nur jetzt angezeigt; in der DB liegt
 * nur sein Hash. Ein neuer Link macht den vorherigen derselben Person ungültig.
 */
export async function linksErzeugen(unterweisungId: string, teilnahmeIds: string[]): Promise<ErzeugterLink[]> {
  const { supabase } = await holeKontext();
  const basis = await appUrl();
  const ablauf = new Date(Date.now() + LINK_GUELTIG_TAGE * 86_400_000).toISOString();
  const ergebnis: ErzeugterLink[] = [];
  for (const teilnahmeId of teilnahmeIds) {
    const { token, hash } = neuerToken();
    const { data, error } = await supabase
      .from("teilnahme")
      .update({ token_hash: hash, token_laeuft_ab: ablauf })
      .eq("id", teilnahmeId)
      .eq("unterweisung_id", unterweisungId)
      .is("unterschrieben_am", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (data.length === 1) ergebnis.push({ teilnahmeId, url: `${basis}/u/${token}` });
  }
  pfadeNeuLaden(unterweisungId);
  return ergebnis;
}

export async function abschliessen(id: string, _: Zustand): Promise<Zustand> {
  const { supabase, betrieb } = await holeKontext();
  try {
    await schliesseAb(supabase, betrieb, id);
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : String(e) };
  }
  pfadeNeuLaden(id);
  revalidatePath("/archiv");
  return { ok: "Abgeschlossen. Der Nachweis wurde erzeugt." };
}
