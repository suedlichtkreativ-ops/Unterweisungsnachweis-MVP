import Link from "next/link";
import { AktionsFormular } from "@/components/aktions-formular";
import { Feld } from "@/components/feld";
import { anmelden } from "../aktionen";

export const metadata = { title: "Anmelden" };

export default function LoginSeite() {
  return (
    <>
      <h1 className="mb-6">Anmelden</h1>
      <AktionsFormular aktion={anmelden} knopf="Anmelden">
        <Feld label="E-Mail" name="email" type="email" autoComplete="email" required />
        <Feld label="Passwort" name="passwort" type="password" autoComplete="current-password" required />
      </AktionsFormular>
      <p className="mt-6 text-sm text-slate-600">
        Noch kein Zugang? <Link href="/registrieren">Betrieb registrieren</Link>
      </p>
    </>
  );
}
