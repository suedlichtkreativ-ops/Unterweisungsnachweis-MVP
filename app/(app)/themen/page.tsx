import Link from "next/link";
import { AktionsFormular } from "@/components/aktions-formular";
import { PruefAbzeichen } from "@/components/abzeichen";
import { Feld } from "@/components/feld";
import { holeKontext } from "@/lib/kontext";
import type { Thema } from "@/lib/typen";
import { themaAnlegen, vorlageUebernehmen } from "./aktionen";

export const metadata = { title: "Themen" };

export default async function ThemenSeite({ searchParams }: { searchParams: Promise<{ willkommen?: string }> }) {
  const { willkommen } = await searchParams;
  const { supabase, betrieb, mitglied } = await holeKontext();
  const { data, error } = await supabase.from("thema").select("*").order("titel");
  if (error) throw new Error(error.message);
  const alle = (data ?? []) as Thema[];
  const eigene = alle.filter((t) => t.betrieb_id === betrieb.id);
  const uebernommen = new Set(eigene.map((t) => t.vorlage_id));
  const vorlagen = alle.filter((t) => t.betrieb_id === null && !uebernommen.has(t.id));
  const inhaber = mitglied.rolle === "inhaber";

  return (
    <div className="space-y-6">
      <h1>Themen</h1>

      {willkommen && (
        <div className="hinweis-info space-y-1">
          <p className="font-semibold">Willkommen! Erste Schritte:</p>
          <p>1. Themen aus der Bibliothek übernehmen (unten).</p>
          <p>2. Inhalte durch eine fachkundige Person ausfüllen und prüfen lassen.</p>
          <p>
            3. <Link href="/mitarbeiter">Mitarbeitende anlegen</Link>, dann die erste Unterweisung planen.
          </p>
        </div>
      )}

      <p className="hinweis-warnung">
        Die mitgelieferten Themen sind <strong>Platzhalter ohne fachlichen Inhalt</strong>. Inhalte müssen auf Grundlage
        Ihrer Gefährdungsbeurteilung von einer fachkundigen Person (z. B. Fachkraft für Arbeitssicherheit) erstellt und
        geprüft werden.
      </p>

      <section className="karte">
        <h2 className="mb-3">Themen des Betriebs ({eigene.length})</h2>
        {eigene.length === 0 ? (
          <p className="text-sm text-slate-600">Noch keine Themen – bitte aus der Bibliothek übernehmen.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {eigene.map((t) => (
              <li key={t.id} className="py-2">
                <Link href={`/themen/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 text-slate-900">
                  <span className={t.aktiv ? "font-medium" : "font-medium text-slate-400 line-through"}>{t.titel}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    alle {t.intervall_monate} Mon.{t.erfordert_uebung && " · mit Übung"}
                    <PruefAbzeichen status={t.pruefstatus} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {inhaber && vorlagen.length > 0 && (
        <section className="karte">
          <h2 className="mb-1">Bibliothek</h2>
          <p className="mb-3 text-xs text-slate-500">Übernahme erstellt eine bearbeitbare Kopie im Betrieb.</p>
          <ul className="divide-y divide-slate-100">
            {vorlagen.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{v.titel}</span>
                  <span className="ml-2">
                    <PruefAbzeichen status={v.pruefstatus} />
                  </span>
                </span>
                <form action={vorlageUebernehmen.bind(null, v.id)}>
                  <button className="btn-sekundaer">Übernehmen</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inhaber && (
        <section className="karte">
          <h2 className="mb-3">Eigenes Thema anlegen</h2>
          <AktionsFormular aktion={themaAnlegen} knopf="Anlegen">
            <Feld label="Titel" name="titel" required />
          </AktionsFormular>
        </section>
      )}
    </div>
  );
}
