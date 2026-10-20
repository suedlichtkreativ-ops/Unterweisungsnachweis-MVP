"use client";

import { useState, useTransition } from "react";
import QRCode from "qrcode";
import type { ErzeugterLink } from "@/app/(app)/unterweisungen/aktionen";

interface Person {
  teilnahmeId: string;
  name: string;
  unterschrieben: boolean;
  linkGueltigBis: string | null;
}

export function LinkVerwaltung({
  unterweisungId,
  personen,
  erzeugen,
  thema,
}: {
  unterweisungId: string;
  personen: Person[];
  erzeugen: (unterweisungId: string, ids: string[]) => Promise<ErzeugterLink[]>;
  thema: string;
}) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [qr, setQr] = useState<{ name: string; svg: string; url: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const offen = personen.filter((p) => !p.unterschrieben);

  const neu = (ids: string[]) => {
    const mitAltemLink = personen.filter((p) => ids.includes(p.teilnahmeId) && p.linkGueltigBis && !links[p.teilnahmeId]);
    if (
      mitAltemLink.length > 0 &&
      !window.confirm(
        `${mitAltemLink.length === 1 ? "Für diese Person gibt" : "Für einige Personen gibt"} es schon einen Link. ` +
          "Ein neuer Link macht den bisherigen ungültig. Fortfahren?",
      )
    ) {
      return;
    }
    setFehler(null);
    starte(async () => {
      try {
        const ergebnis = await erzeugen(unterweisungId, ids);
        setLinks((alt) => ({ ...alt, ...Object.fromEntries(ergebnis.map((l) => [l.teilnahmeId, l.url])) }));
      } catch (e) {
        setFehler(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const zeigeQr = async (name: string, url: string) => {
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    setQr({ name, svg, url });
  };

  if (offen.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Links werden aus Sicherheitsgründen nur einmal angezeigt und sind 14 Tage gültig.
        </p>
        <button className="btn-primaer" disabled={laeuft} onClick={() => neu(offen.map((p) => p.teilnahmeId))}>
          {laeuft ? "Erzeuge …" : `Links für alle Offenen erzeugen (${offen.length})`}
        </button>
      </div>
      {fehler && <p className="hinweis-fehler">{fehler}</p>}
      <ul className="divide-y divide-slate-100">
        {offen.map((p) => {
          const url = links[p.teilnahmeId];
          return (
            <li key={p.teilnahmeId} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                {!url && (
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {p.linkGueltigBis ? "Link verschickt" : "noch kein Link"}
                    <button className="btn-sekundaer min-h-9 px-3" disabled={laeuft} onClick={() => neu([p.teilnahmeId])}>
                      {p.linkGueltigBis ? "Neuer Link" : "Link erzeugen"}
                    </button>
                  </span>
                )}
              </div>
              {url && (
                <div className="space-y-2 rounded-lg bg-slate-50 p-2">
                  <input readOnly value={url} className="eingabe font-mono text-xs" onFocus={(e) => e.target.select()} />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-sekundaer min-h-9 px-3" onClick={() => navigator.clipboard?.writeText(url)}>
                      Kopieren
                    </button>
                    <a
                      className="btn-sekundaer min-h-9 px-3"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://wa.me/?text=${encodeURIComponent(`Unterweisung „${thema}“ – bitte hier bestätigen: ${url}`)}`}
                    >
                      WhatsApp
                    </a>
                    <button className="btn-sekundaer min-h-9 px-3" onClick={() => zeigeQr(p.name, url)}>
                      QR-Code
                    </button>
                    <a className="btn-sekundaer min-h-9 px-3" target="_blank" rel="noreferrer" href={url}>
                      Auf diesem Gerät öffnen
                    </a>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {qr && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setQr(null)}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 font-semibold">{qr.name}</p>
            <p className="mb-3 text-sm text-slate-600">Mit der Handykamera scannen</p>
            <div className="mx-auto w-64" dangerouslySetInnerHTML={{ __html: qr.svg }} />
            <button className="btn-sekundaer mt-4 w-full" onClick={() => setQr(null)}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
