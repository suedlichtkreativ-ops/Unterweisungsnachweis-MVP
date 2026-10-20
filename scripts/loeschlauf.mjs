#!/usr/bin/env node
// Löschlauf nach Aufbewahrungsfrist + Bereinigung abgelaufener Links.
// Ausführen z. B. monatlich (Cron, GitHub Action, Supabase Edge Function):
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/loeschlauf.mjs
// Der Service-Role-Key umgeht RLS – niemals in die App oder ins Frontend!
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const tokens = await sb.rpc("tokens_bereinigen");
if (tokens.error) throw tokens.error;
console.log(`Abgelaufene Links entfernt: ${tokens.data}`);

// 1. Datenbank (eine Transaktion). Liefert die zu löschenden PDF-Pfade.
const { data, error } = await sb.rpc("loeschlauf_ausfuehren");
if (error) throw error;
const pfade = (data ?? []).map((z) => z.storage_pfad);
console.log(`Nachweise zur Löschung: ${pfade.length}`);

// 2. PDFs im Storage löschen. Schlägt das fehl, bleiben Dateien ohne DB-Eintrag zurück –
//    sie sind nicht mehr verlinkt; Pfade werden ausgegeben, um sie manuell zu entfernen.
for (let i = 0; i < pfade.length; i += 100) {
  const teil = pfade.slice(i, i + 100);
  const r = await sb.storage.from("nachweise").remove(teil);
  if (r.error) {
    console.error("Storage-Löschung fehlgeschlagen für:", teil.join("\n"));
    throw r.error;
  }
}
console.log("Löschlauf abgeschlossen.");
