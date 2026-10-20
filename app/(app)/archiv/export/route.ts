import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { holeKontext } from "@/lib/kontext";
import { ladeArchiv } from "@/lib/archiv";
import { BUCKET, dateiname } from "@/lib/abschluss";
import { sha256Hex } from "@/lib/hash";

export const maxDuration = 60;

function csvFeld(wert: string | number | null | undefined): string {
  const s = String(wert ?? "");
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const { supabase, betrieb } = await holeKontext();
  const sp = request.nextUrl.searchParams;
  const eintraege = await ladeArchiv(supabase, {
    jahr: sp.get("jahr") ?? undefined,
    thema: sp.get("thema") ?? undefined,
    mitarbeiter: sp.get("mitarbeiter") ?? undefined,
  });

  const zip = new JSZip();
  const zeilen = [
    ["Datum", "Thema", "Unterweisende Person", "Ort", "Teilnehmer", "Bestätigt am", "Nachtrag zu", "Datei", "SHA-256 PDF", "SHA-256 Datensatz", "Vorgangs-ID"],
  ];
  const pruefsummen: string[] = [];
  const belegt = new Set<string>();

  for (const e of eintraege) {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(e.storage_pfad);
    if (error || !blob) throw new Error(`PDF fehlt: ${e.storage_pfad}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (sha256Hex(bytes) !== e.pdf_sha256) throw new Error(`Prüfsumme stimmt nicht: ${e.storage_pfad}`);

    let datei = dateiname(e.unterweisung.thema_snapshot.titel, e.unterweisung.datum);
    for (let i = 2; belegt.has(datei); i++) datei = datei.replace(/(_\d+)?\.pdf$/, `_${i}.pdf`);
    belegt.add(datei);
    zip.file(`pdf/${datei}`, bytes);
    pruefsummen.push(`${e.pdf_sha256}  pdf/${datei}`);

    for (const t of e.unterweisung.teilnahme) {
      zeilen.push([
        e.unterweisung.datum,
        e.unterweisung.thema_snapshot.titel,
        e.unterweisung.unterweisender_name,
        e.unterweisung.ort ?? "",
        `${t.mitarbeiter.vorname} ${t.mitarbeiter.nachname}`,
        t.unterschrieben_am ?? "nicht bestätigt",
        e.unterweisung.nachtrag_zu ?? "",
        `pdf/${datei}`,
        e.pdf_sha256,
        e.inhalt_sha256,
        e.unterweisung.id,
      ]);
    }
  }

  // BOM + Semikolon: öffnet direkt korrekt in Excel (deutsch)
  zip.file("uebersicht.csv", "﻿" + zeilen.map((z) => z.map(csvFeld).join(";")).join("\r\n") + "\r\n");
  zip.file("SHA256SUMS.txt", pruefsummen.join("\n") + "\n");
  zip.file(
    "LIESMICH.txt",
    `Export ${betrieb.name} – ${new Date().toISOString()}\n\n` +
      "pdf/            Nachweis-PDFs\n" +
      "uebersicht.csv  eine Zeile je Teilnehmer und Unterweisung\n" +
      "SHA256SUMS.txt  Prüfsummen der PDFs (prüfen z. B. mit: sha256sum -c SHA256SUMS.txt)\n",
  );

  const inhalt = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const stempel = new Date().toISOString().slice(0, 10);
  return new NextResponse(Buffer.from(inhalt), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Unterweisungsnachweise_${stempel}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
