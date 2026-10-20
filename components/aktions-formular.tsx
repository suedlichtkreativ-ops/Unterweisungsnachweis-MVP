"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Zustand } from "@/lib/typen";

type Aktion = (vorher: Zustand, daten: FormData) => Promise<Zustand>;

/** Formular für Server Actions mit Fehler-/Erfolgsmeldung und Lade-Zustand. */
export function AktionsFormular({
  aktion,
  children,
  knopf,
  knopfKlasse = "btn-primaer",
  className = "space-y-4",
  bestaetigung,
}: {
  aktion: Aktion;
  children?: React.ReactNode;
  knopf: string;
  knopfKlasse?: string;
  className?: string;
  bestaetigung?: string;
}) {
  const [zustand, ausfuehren] = useActionState(aktion, {});
  return (
    <form
      action={ausfuehren}
      className={className}
      onSubmit={(e) => {
        if (bestaetigung && !window.confirm(bestaetigung)) e.preventDefault();
      }}
    >
      {children}
      {zustand.fehler && (
        <p role="alert" className="hinweis-fehler">
          {zustand.fehler}
        </p>
      )}
      {zustand.ok && (
        <p role="status" className="hinweis-ok">
          {zustand.ok}
        </p>
      )}
      <AbsendeKnopf klasse={knopfKlasse}>{knopf}</AbsendeKnopf>
    </form>
  );
}

export function AbsendeKnopf({ children, klasse = "btn-primaer" }: { children: React.ReactNode; klasse?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={klasse}>
      {pending ? "Bitte warten …" : children}
    </button>
  );
}
