import Link from "next/link";
import { AmpelChip, AmpelPunkt, AMPEL_TEXT } from "@/components/abzeichen";
import { holeKontext } from "@/lib/kontext";
import { type Ampel, type Faelligkeit, schlechteste } from "@/lib/faelligkeit";
import { ladeFaelligkeiten } from "@/lib/faelligkeit-daten";
import { datum, name } from "@/lib/format";

export const metadata = { title: "Übersicht" };

export default async function Uebersicht() {
  const { supabase, betrieb } = await holeKontext();

  const [{ heute, mitarbeiter, themen, faelligkeit }, offenRes] = await Promise.all([
    ladeFaelligkeiten(supabase, betrieb.id),
    supabase.from("unterweisung").select("id", { count: "exact", head: true }).eq("status", "durchgefuehrt"),
  ]);

  const zeilen = mitarbeiter
    .map((m) => {
      const zellen = themen.map((t) => ({
        thema: t,
        f: faelligkeit(m, t),
      }));
      return { m, zellen, gesamt: schlechteste(zellen.map((z) => z.f.ampel)) };
    })
    .sort((a, b) => rang(a.gesamt) - rang(b.gesamt) || a.m.nachname.localeCompare(b.m.nachname, "de"));

  const zaehler: Record<Ampel, number> = { rot: 0, gelb: 0, gruen: 0 };
  zeilen.forEach((z) => z.zellen.forEach((c) => zaehler[c.f.ampel]++));
  const ungeprueft = themen.filter((t) => t.pruefstatus !== "geprueft").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Fälligkeiten</h1>
          <p className="text-sm text-slate-600">Stand {datum(heute)} · gezählt werden abgeschlossene Unterweisungen</p>
        </div>
        <Link href="/unterweisungen/neu" className="btn-primaer">
          + Unterweisung planen
        </Link>
      </div>

      {ungeprueft > 0 && (
        <p className="hinweis-warnung">
          {ungeprueft} {ungeprueft === 1 ? "Thema ist" : "Themen sind"} noch nicht fachlich geprüft.{" "}
          <Link href="/themen">Themen ansehen</Link>
        </p>
      )}
      {(offenRes.count ?? 0) > 0 && (
        <p className="hinweis-info">
          {offenRes.count} durchgeführte {offenRes.count === 1 ? "Unterweisung wartet" : "Unterweisungen warten"} auf
          Unterschriften bzw. Abschluss. <Link href="/unterweisungen">Zu den Unterweisungen</Link>
        </p>
      )}

      {themen.length === 0 || mitarbeiter.length === 0 ? (
        <div className="karte space-y-2">
          <p className="font-medium">Noch nichts zu zeigen.</p>
          {themen.length === 0 && (
            <p className="text-sm">
              1. <Link href="/themen">Themen aus der Bibliothek übernehmen</Link>
            </p>
          )}
          {mitarbeiter.length === 0 && (
            <p className="text-sm">
              2. <Link href="/mitarbeiter">Mitarbeitende anlegen</Link>
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(["rot", "gelb", "gruen"] as const).map((a) => (
              <div key={a} className="karte flex items-center gap-3 p-3">
                <AmpelPunkt ampel={a} />
                <div>
                  <p className="text-2xl font-bold leading-none">{zaehler[a]}</p>
                  <p className="text-xs text-slate-600">{AMPEL_TEXT[a]}</p>
                </div>
              </div>
            ))}
          </div>

          <ul className="space-y-3">
            {zeilen.map(({ m, zellen, gesamt }) => (
              <li key={m.id} className="karte">
                <div className="mb-3 flex items-center gap-2">
                  <AmpelPunkt ampel={gesamt} />
                  <Link href={`/mitarbeiter/${m.id}`} className="font-semibold text-slate-900">
                    {name(m)}
                  </Link>
                  {m.taetigkeit && <span className="text-sm text-slate-500">· {m.taetigkeit}</span>}
                  {m.jugendlich && (
                    <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600" title="Intervall höchstens 6 Monate">
                      jugendlich
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {zellen.map(({ thema, f }) => (
                    <Link
                      key={thema.id}
                      href={`/unterweisungen/neu?thema=${thema.id}&mitarbeiter=${m.id}`}
                      className="no-underline hover:no-underline"
                      title={f.ampel === "gruen" ? "" : "Unterweisung planen"}
                    >
                      <AmpelChip ampel={f.ampel}>
                        {thema.titel}: {beschreibe(f)}
                      </AmpelChip>
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function rang(a: Ampel) {
  return a === "rot" ? 0 : a === "gelb" ? 1 : 2;
}

function beschreibe(f: Faelligkeit): string {
  if (!f.letzte) return "noch nie";
  if (f.ampel === "rot") return `seit ${datum(f.faelligAm)}`;
  return `bis ${datum(f.faelligAm)}`;
}
