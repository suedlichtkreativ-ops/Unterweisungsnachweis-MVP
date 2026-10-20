import Link from "next/link";
import { notFound } from "next/navigation";
import { AktionsFormular } from "@/components/aktions-formular";
import { MitarbeiterFelder } from "@/components/mitarbeiter-felder";
import { StatusAbzeichen } from "@/components/abzeichen";
import { holeKontext } from "@/lib/kontext";
import { datum, name, zeitpunkt } from "@/lib/format";
import type { Mitarbeiter, Thema, Unterweisung } from "@/lib/typen";
import { mitarbeiterAktivSetzen, mitarbeiterLoeschen, mitarbeiterSpeichern } from "../aktionen";

export const metadata = { title: "Mitarbeiter" };

export default async function MitarbeiterDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, mitglied } = await holeKontext();
  const { data } = await supabase.from("mitarbeiter").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as Mitarbeiter;

  const { data: verlauf } = await supabase
    .from("teilnahme")
    .select("id, unterschrieben_am, unterweisung!inner(id, datum, status, thema_snapshot, thema(titel))")
    .eq("mitarbeiter_id", id);
  const eintraege = (verlauf ?? []) as unknown as {
    id: string;
    unterschrieben_am: string | null;
    unterweisung: Pick<Unterweisung, "id" | "datum" | "status" | "thema_snapshot"> & { thema: Pick<Thema, "titel"> };
  }[];
  eintraege.sort((a, b) => b.unterweisung.datum.localeCompare(a.unterweisung.datum));
  const inhaber = mitglied.rolle === "inhaber";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/mitarbeiter" className="text-sm">‹ Mitarbeiter</Link>
        <h1 className="mt-1">
          {name(m)} {!m.aktiv && <span className="text-base font-normal text-slate-500">(inaktiv)</span>}
        </h1>
      </div>

      <section className="karte">
        <h2 className="mb-3">Unterweisungen</h2>
        {eintraege.length === 0 ? (
          <p className="text-sm text-slate-600">Noch keine Unterweisungen.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {eintraege.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/unterweisungen/${e.unterweisung.id}`}>
                  {datum(e.unterweisung.datum)} · {e.unterweisung.thema_snapshot?.titel ?? e.unterweisung.thema.titel}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {e.unterschrieben_am ? `bestätigt ${zeitpunkt(e.unterschrieben_am)}` : "nicht bestätigt"}
                  </span>
                  <StatusAbzeichen status={e.unterweisung.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {inhaber && (
        <>
          <section className="karte">
            <h2 className="mb-3">Stammdaten</h2>
            <AktionsFormular aktion={mitarbeiterSpeichern.bind(null, m.id)} knopf="Speichern">
              <MitarbeiterFelder m={m} />
            </AktionsFormular>
          </section>

          <section className="karte space-y-3">
            <h2>Status</h2>
            <form action={mitarbeiterAktivSetzen.bind(null, m.id, !m.aktiv)}>
              <button className="btn-sekundaer">{m.aktiv ? "Deaktivieren (ausgeschieden)" : "Wieder aktivieren"}</button>
            </form>
            {eintraege.length === 0 && (
              <AktionsFormular
                aktion={mitarbeiterLoeschen.bind(null, m.id)}
                knopf="Endgültig löschen"
                knopfKlasse="btn-gefahr"
                bestaetigung="Diese Person endgültig löschen?"
              >
                <p className="text-sm text-slate-600">
                  Löschen ist nur möglich, solange keine Unterweisungen zugeordnet sind.
                </p>
              </AktionsFormular>
            )}
          </section>
        </>
      )}
    </div>
  );
}
