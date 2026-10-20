"use client";

export default function Fehler({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1>Etwas ist schiefgelaufen</h1>
      <p className="mt-2 text-slate-600">{error.message || "Unbekannter Fehler"}</p>
      <button onClick={reset} className="btn-primaer mt-6">
        Erneut versuchen
      </button>
    </main>
  );
}
