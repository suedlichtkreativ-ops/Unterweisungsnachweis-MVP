import Link from "next/link";
import { AktionsFormular } from "@/components/aktions-formular";
import { Checkbox, Feld } from "@/components/feld";
import { registrieren } from "../aktionen";

export const metadata = { title: "Registrieren" };

export default function RegistrierenSeite() {
  return (
    <>
      <h1 className="mb-2">Betrieb registrieren</h1>
      <p className="mb-6 text-sm text-slate-600">Für Inhaberinnen und Inhaber. Mitarbeitende brauchen keinen Zugang.</p>
      <AktionsFormular aktion={registrieren} knopf="Registrieren">
        <Feld label="E-Mail" name="email" type="email" autoComplete="email" required />
        <Feld
          label="Passwort"
          name="passwort"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hinweis="Mindestens 8 Zeichen"
        />
        <Checkbox
          name="hinweise"
          required
          label={
            <>
              Ich habe die <Link href="/hinweise" target="_blank">Hinweise</Link> gelesen: Die Anwendung dokumentiert
              Unterweisungen, ersetzt sie aber nicht und ist keine Rechtsberatung.
            </>
          }
        />
      </AktionsFormular>
      <p className="mt-6 text-sm text-slate-600">
        Schon registriert? <Link href="/login">Anmelden</Link>
      </p>
    </>
  );
}
