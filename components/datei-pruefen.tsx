"use client";

import { useState } from "react";
import type { PruefErgebnis } from "@/app/(app)/archiv/aktionen";

/** Berechnet die SHA-256 einer PDF lokal im Browser (die Datei wird nicht hochgeladen). */
export function DateiPruefen({ pruefen }: { pruefen: (sha256: string) => Promise<PruefErgebnis> }) {
  const [ergebnis, setErgebnis] = useState<(PruefErgebnis & { hash: string }) | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function gewaehlt(datei: File | undefined) {
    if (!datei) return;
    setLaeuft(true);
    setErgebnis(null);
    try {
      const digest = await crypto.subtle.digest("SHA-256", await datei.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      setErgebnis({ ...(await pruefen(hash)), hash });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => gewaehlt(e.target.files?.[0])}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-marke-50 file:px-3 file:py-2 file:font-semibold file:text-marke-900"
      />
      {laeuft && <p className="text-sm text-slate-600">Prüfe …</p>}
      {ergebnis && (
        <div className={ergebnis.treffer ? "hinweis-ok" : "hinweis-fehler"}>
          <p>{ergebnis.text}</p>
          {ergebnis.unterweisungId && <a href={`/unterweisungen/${ergebnis.unterweisungId}`}>Zur Unterweisung</a>}
          <p className="mt-1 break-all font-mono text-xs opacity-75">SHA-256: {ergebnis.hash}</p>
        </div>
      )}
    </div>
  );
}
