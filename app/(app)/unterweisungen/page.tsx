import Link from "next/link";
import { StatusAbzeichen } from "@/components/abzeichen";
import { holeKontext } from "@/lib/kontext";
import { datum } from "@/lib/format";
import type { Thema, Unterweisung, UnterweisungStatus } from "@/lib/typen";

export const metadata = { title: "Unterweisungen" };

type Zeile = Pick<Unterweisung, "id" | "datum" | "ort" | "status" | "nachtrag_zu" | "thema_snapshot"> & {
  thema: Pick<Thema, "titel">;
  teilnahme: { unterschrieben_am: string | null }[];
};

export default async function UnterweisungenSeite() {
  const { supabase } = await holeKontext();
  const { data, error } = await supabase
    .from("unterweisung")
    .select("id, datum, ort, status, nachtrag_zu, thema_snapshot, thema(titel), teilnahme(unterschrieben_am)")
    .order("datum", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const zeilen = (data ?? []) as unknown as Zeile[];

  const gruppen: { status: UnterweisungStatus; titel: string }[] = [
    { status: "durchgefuehrt", titel: "Unterschriften laufen" },
    { status: "geplant", titel: "Geplant" },
    { status: "abgeschlossen", titel: "Zuletzt abgeschlossen" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Unterweisungen</h1>
        <Link href="/unterweisungen/neu" className="btn-primaer">
          + Planen
        </Link>
      </div>
      {zeilen.length === 0 && <p className="karte text-sm text-slate-600">Noch keine Unterweisungen geplant.</p>}
      {gruppen.map((g) => {
        const liste = zeilen.filter((z) => z.status === g.status).slice(0, g.status === "abgeschlossen" ? 20 : undefined);
        if (liste.length === 0) return null;
        return (
          <section key={g.status} className="karte">
            <h2 className="mb-2">{g.titel}</h2>
            <ul className="divide-y divide-slate-100">
              {liste.map((z) => {
                const unterschrieben = z.teilnahme.filter((t) => t.unterschrieben_am).length;
                return (
                  <li key={z.id} className="py-2">
                    <Link href={`/unterweisungen/${z.id}`} className="block text-slate-900 no-underline hover:no-underline">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {z.thema_snapshot?.titel ?? z.thema.titel}
                          {z.nachtrag_zu && <span className="ml-2 text-xs text-slate-500">(Nachtrag)</span>}
                        </span>
                        <StatusAbzeichen status={z.status} />
                      </span>
                      <span className="text-sm text-slate-600">
                        {datum(z.datum)}
                        {z.ort && ` · ${z.ort}`} · {unterschrieben}/{z.teilnahme.length} bestätigt
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-sm">
        Ältere abgeschlossene Unterweisungen finden Sie im <Link href="/archiv">Archiv</Link>.
      </p>
    </div>
  );
}
