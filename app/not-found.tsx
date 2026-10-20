import Link from "next/link";

export default function NichtGefunden() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1>Nicht gefunden</h1>
      <p className="mt-2 text-slate-600">Diese Seite gibt es nicht oder Sie haben keinen Zugriff.</p>
      <Link href="/" className="btn-primaer mt-6">
        Zur Übersicht
      </Link>
    </main>
  );
}
