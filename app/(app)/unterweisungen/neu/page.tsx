import Link from "next/link";
import { notFound } from "next/navigation";
import { AktionsFormular } from "@/components/aktions-formular";
import { AmpelChip, PruefAbzeichen } from "@/components/abzeichen";
import { Feld } from "@/components/feld";
import { holeKontext } from "@/lib/kontext";
import { ladeFaelligkeiten } from "@/lib/faelligkeit-daten";
import { datum, name } from "@/lib/format";
import type { Unterweisung } from "@/lib/typen";
import { unterweisungAnlegen } from "../aktionen";

export const metadata = { title: "Unterweisung planen" };

export default async function NeueUnterweisung({
  searchParams,
}: {
  searchParams: Promise<{ thema?: string; mitarbeiter?: string; nachtrag?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, betrieb, mitglied } = await holeKontext();
  const { heute, mitarbeiter, themen, faelligkeit } = await ladeFaelligkeiten(supabase, betrieb.id);

  // Nachtrag: Thema und Teilnehmende der Original-Unterweisung übernehmen
  type Original = Unterweisung & { teilnahme: { mitarbeiter_id: string }[] };
  let original: Original | null = null;
  if (sp.nachtrag) {
    const { data } = await supabase
      .from("unterweisung")
      .select("*, teilnahme(mitarbeiter_id)")
      .eq("id", sp.nachtrag)
      .eq("status", "abgeschlossen")
      .maybeSingle();
    if (!data) notFound();
    original = data as Original;
  }
  const themaId = original?.thema_id ?? sp.thema;

  // Schritt 1: Thema wählen
  if (!themaId) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/unterweisungen" className="text-sm">‹ Unterweisungen</Link>
          <h1 className="mt-1">Unterweisung planen</h1>
          <p className="text-sm text-slate-600">Schritt 1 von 2: Thema wählen</p>
        </div>
        {themen.length === 0 ? (
          <p className="karte text-sm">
            Noch keine aktiven Themen. <Link href="/themen">Themen übernehmen</Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {themen.map((t) => {
              const faellig = mitarbeiter.filter((m) => faelligkeit(m, t).ampel !== "gruen").length;
              return (
                <li key={t.id}>
                  <Link
                    href={`/unterweisungen/neu?thema=${t.id}`}
                    className="karte flex flex-wrap items-center justify-between gap-2 text-slate-900 no-underline hover:border-marke-600 hover:no-underline"
                  >
                    <span className="font-medium">{t.titel}</span>
                    <span className="flex items-center gap-2">
                      <PruefAbzeichen status={t.pruefstatus} />
                      <AmpelChip ampel={faellig > 0 ? "rot" : "gruen"}>{faellig} fällig</AmpelChip>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // Schritt 2: Details und Teilnehmende
  const thema = themen.find((t) => t.id === themaId);
  if (!thema) notFound();
  const vorauswahl = new Set(
    original
      ? original.teilnahme.map((t) => t.mitarbeiter_id)
      : sp.mitarbeiter
        ? [sp.mitarbeiter]
        : mitarbeiter.filter((m) => faelligkeit(m, thema).ampel !== "gruen").map((m) => m.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/unterweisungen/neu" className="text-sm">‹ anderes Thema</Link>
        <h1 className="mt-1">{original ? "Nachtrag anlegen" : "Unterweisung planen"}</h1>
        <p className="text-sm text-slate-600">{original ? "Nachtrag" : "Schritt 2 von 2"}: {thema.titel}</p>
      </div>

      {thema.pruefstatus !== "geprueft" && (
        <p className="hinweis-warnung">
          Der Inhalt dieses Themas ist noch nicht fachlich geprüft. Das wird im Nachweis vermerkt.{" "}
          <Link href={`/themen/${thema.id}`}>Thema öffnen</Link>
        </p>
      )}
      {original && (
        <p className="hinweis-info">
          Nachtrag zur Unterweisung vom {datum(original.datum)}. Die ursprüngliche Unterweisung bleibt unverändert;
          der Nachtrag wird separat dokumentiert und verweist auf sie.
        </p>
      )}

      <AktionsFormular aktion={unterweisungAnlegen} knopf="Unterweisung anlegen" className="space-y-6">
        <input type="hidden" name="thema_id" value={thema.id} />
        {original && <input type="hidden" name="nachtrag_zu" value={original.id} />}

        <section className="karte space-y-4">
          <h2>Angaben</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feld label="Datum" name="datum" type="date" defaultValue={heute} required />
            <Feld label="Ort (optional)" name="ort" placeholder="z. B. Werkhof, Baustelle …" />
          </div>
          <Feld label="Unterweisende Person" name="unterweisender_name" defaultValue={mitglied.anzeigename} required />
          {thema.erfordert_uebung && (
            <div>
              <label htmlFor="uebung_beschreibung" className="beschriftung">
                Praktische Übung (geplant)
              </label>
              <textarea id="uebung_beschreibung" name="uebung_beschreibung" rows={2} className="eingabe" />
              <p className="mt-1 text-xs text-slate-500">Kann bei der Durchführung noch ergänzt werden.</p>
            </div>
          )}
          <div>
            <label htmlFor="bemerkung" className="beschriftung">
              {original ? "Grund für den Nachtrag (Pflicht)" : "Bemerkung (optional)"}
            </label>
            <textarea id="bemerkung" name="bemerkung" rows={2} className="eingabe" required={!!original} />
          </div>
        </section>

        <section className="karte">
          <h2 className="mb-1">Teilnehmende</h2>
          <p className="mb-3 text-xs text-slate-500">
            {original ? "Aus der ursprünglichen Unterweisung übernommen." : "Vorausgewählt: alle, für die das Thema fällig oder bald fällig ist."}
          </p>
          <ul className="divide-y divide-slate-100">
            {mitarbeiter.map((m) => {
              const f = faelligkeit(m, thema);
              return (
                <li key={m.id}>
                  <label className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="mitarbeiter"
                        value={m.id}
                        defaultChecked={vorauswahl.has(m.id)}
                        className="size-5 accent-marke-700"
                      />
                      <span>{name(m)}</span>
                    </span>
                    <AmpelChip ampel={f.ampel}>
                      {f.letzte ? `zuletzt ${datum(f.letzte)}` : "noch nie"}
                    </AmpelChip>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </AktionsFormular>
    </div>
  );
}
