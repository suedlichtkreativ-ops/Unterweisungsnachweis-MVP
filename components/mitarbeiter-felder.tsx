import { Checkbox, Feld } from "./feld";
import type { Mitarbeiter } from "@/lib/typen";

export function MitarbeiterFelder({ m }: { m?: Mitarbeiter }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Vorname" name="vorname" defaultValue={m?.vorname} required autoComplete="off" />
        <Feld label="Nachname" name="nachname" defaultValue={m?.nachname} required autoComplete="off" />
        <Feld label="Tätigkeit (optional)" name="taetigkeit" defaultValue={m?.taetigkeit ?? ""} placeholder="z. B. Dachdecker/in" />
        <Feld label="Eintritt (optional)" name="eintritt" type="date" defaultValue={m?.eintritt ?? ""} />
      </div>
      <Checkbox
        name="jugendlich"
        defaultChecked={m?.jugendlich}
        label="Jugendliche/r (unter 18)"
        hinweis="Intervall wird auf höchstens 6 Monate verkürzt (§ 29 Abs. 2 JArbSchG). Bitte bei Volljährigkeit abwählen."
      />
      <p className="text-xs text-slate-500">
        Datensparsam: Es werden nur Name, Tätigkeit, Eintritt und diese Angabe gespeichert – keine Kontaktdaten.
      </p>
    </>
  );
}
