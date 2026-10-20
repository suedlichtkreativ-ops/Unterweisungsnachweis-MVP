import Link from "next/link";
import { DateiPruefen } from "@/components/datei-pruefen";
import { holeKontext } from "@/lib/kontext";
import { ladeArchiv } from "@/lib/archiv";
import { datum, name } from "@/lib/format";
import type { Mitarbeiter, Thema } from "@/lib/typen";
import { pruefsummePruefen } from "./aktionen";

export const metadata = { title: "Archiv" };

export default async function ArchivSeite({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string; thema?: string; mitarbeiter?: string }>;
}) {
  const filter = await searchParams;
  const { supabase, betrieb } = await holeKontext();
  const [eintraege, themenRes, maRes] = await Promise.all([
    ladeArchiv(supabase, filter),
    supabase.from("thema").select("id, titel").eq("betrieb_id", betrieb.id).order("titel"),
    supabase.from("mitarbeiter").select("id, vorname, nachname").order("nachname"),
  ]);
  const themen = (themenRes.data ?? []) as Pick<Thema, "id" | "titel">[];
  const mitarbeiter = (maRes.data ?? []) as Pick<Mitarbeiter, "id" | "vorname" | "nachname">[];
  const aktuellesJahr = new Date().getFullYear();
  const jahre = Array.from({ length: 6 }, (_, i) => String(aktuellesJahr - i));
  const exportParameter = new URLSearchParams(
    Object.entries(filter).filter(([, v]) => typeof v === "string" && v) as [string, string][],
  ).toString();

  return (
    <div className="space-y-6">
      <h1>Archiv</h1>

      <form className="karte grid gap-3 sm:grid-cols-4" method="get">
        <select name="jahr" defaultValue={filter.jahr ?? ""} className="eingabe" aria-label="Jahr">
          <option value="">Alle Jahre</option>
          {jahre.map((j) => (
            <option key={j}>{j}</option>
          ))}
        </select>
        <select name="thema" defaultValue={filter.thema ?? ""} className="eingabe" aria-label="Thema">
          <option value="">Alle Themen</option>
          {themen.map((t) => (
            <option key={t.id} value={t.id}>
              {t.titel}
            </option>
          ))}
        </select>
        <select name="mitarbeiter" defaultValue={filter.mitarbeiter ?? ""} className="eingabe" aria-label="Mitarbeiter">
          <option value="">Alle Mitarbeitenden</option>
          {mitarbeiter.map((m) => (
            <option key={m.id} value={m.id}>
              {name(m)}
            </option>
          ))}
        </select>
        <button className="btn-sekundaer">Filtern</button>
      </form>

      <section className="karte">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2>{eintraege.length} Nachweise</h2>
          {eintraege.length > 0 && (
            <a href={`/archiv/export${exportParameter ? `?${exportParameter}` : ""}`} className="btn-sekundaer">
              Export (ZIP mit PDFs + CSV)
            </a>
          )}
        </div>
        {eintraege.length === 0 ? (
          <p className="text-sm text-slate-600">Keine abgeschlossenen Unterweisungen gefunden.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {eintraege.map((e) => {
              const bestaetigt = e.unterweisung.teilnahme.filter((t) => t.unterschrieben_am).length;
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <Link href={`/unterweisungen/${e.unterweisung.id}`} className="font-medium text-slate-900">
                      {e.unterweisung.thema_snapshot.titel}
                    </Link>
                    {e.unterweisung.nachtrag_zu && <span className="ml-2 text-xs text-slate-500">(Nachtrag)</span>}
                    <p className="text-sm text-slate-600">
                      {datum(e.unterweisung.datum)} · {e.unterweisung.unterweisender_name} · {bestaetigt}/
                      {e.unterweisung.teilnahme.length} bestätigt
                    </p>
                  </div>
                  <a href={`/archiv/${e.id}/pdf`} className="btn-sekundaer min-h-9 px-3">
                    PDF
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="karte space-y-2">
        <h2>PDF auf Unverändertheit prüfen</h2>
        <p className="text-sm text-slate-600">
          Wählen Sie eine Nachweis-PDF aus. Die Prüfsumme wird in Ihrem Browser berechnet und mit dem Archiv verglichen
          – die Datei wird nicht hochgeladen.
        </p>
        <DateiPruefen pruefen={pruefsummePruefen} />
      </section>
    </div>
  );
}
