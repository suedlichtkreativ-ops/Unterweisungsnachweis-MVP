import Link from "next/link";
import { AktionsFormular } from "@/components/aktions-formular";
import { MitarbeiterFelder } from "@/components/mitarbeiter-felder";
import { holeKontext } from "@/lib/kontext";
import { name } from "@/lib/format";
import type { Mitarbeiter } from "@/lib/typen";
import { mitarbeiterAnlegen } from "./aktionen";

export const metadata = { title: "Mitarbeiter" };

export default async function MitarbeiterSeite() {
  const { supabase, mitglied } = await holeKontext();
  const { data, error } = await supabase.from("mitarbeiter").select("*").order("nachname").order("vorname");
  if (error) throw new Error(error.message);
  const alle = (data ?? []) as Mitarbeiter[];
  const aktive = alle.filter((m) => m.aktiv);
  const inaktive = alle.filter((m) => !m.aktiv);

  return (
    <div className="space-y-6">
      <h1>Mitarbeiter</h1>

      <section className="karte">
        <h2 className="mb-3">Aktiv ({aktive.length})</h2>
        {aktive.length === 0 ? (
          <p className="text-sm text-slate-600">Noch keine Mitarbeitenden angelegt.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {aktive.map((m) => (
              <Zeile key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>

      {mitglied.rolle === "inhaber" && (
        <section className="karte">
          <h2 className="mb-3">Neu anlegen</h2>
          <AktionsFormular aktion={mitarbeiterAnlegen} knopf="Anlegen">
            <MitarbeiterFelder />
          </AktionsFormular>
        </section>
      )}

      {inaktive.length > 0 && (
        <section className="karte">
          <h2 className="mb-1">Inaktiv ({inaktive.length})</h2>
          <p className="mb-3 text-xs text-slate-500">
            Ausgeschiedene Personen bleiben gespeichert, solange ihre Nachweise aufbewahrt werden müssen.
          </p>
          <ul className="divide-y divide-slate-100">
            {inaktive.map((m) => (
              <Zeile key={m.id} m={m} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Zeile({ m }: { m: Mitarbeiter }) {
  return (
    <li className="py-2">
      <Link href={`/mitarbeiter/${m.id}`} className="flex items-center justify-between gap-2 text-slate-900">
        <span>
          <span className="font-medium">{name(m)}</span>
          {m.taetigkeit && <span className="text-sm text-slate-500"> · {m.taetigkeit}</span>}
          {m.jugendlich && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-600">jugendlich</span>}
        </span>
        <span aria-hidden className="text-slate-400">›</span>
      </Link>
    </li>
  );
}
