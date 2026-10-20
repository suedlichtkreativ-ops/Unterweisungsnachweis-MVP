import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { erzeugeProtokoll } from "@/lib/pdf/protokoll";
import { baueNachweisInhalt } from "@/lib/nachweis-inhalt";
import { kanonischesJson, sha256Hex } from "@/lib/hash";
import type { Unterweisung } from "@/lib/typen";

const unterweisung: Unterweisung = {
  id: "55555555-5555-4555-8555-000000000001",
  betrieb_id: "b",
  thema_id: "t",
  datum: "2026-10-19",
  ort: "Werkhof",
  unterweisender_name: "Max Mustermann",
  bemerkung: null,
  uebung_beschreibung: "Übung am Übungsdach",
  status: "durchgefuehrt",
  thema_snapshot: {
    id: "t",
    titel: "Absturzsicherung / PSA gegen Absturz",
    kurzbeschreibung: "Platzhalter",
    inhalt: "## Hinweis\nPlatzhalter – „Zitat“ ✓ 🙂\n- Punkt eins\n\n" + "Langer Text. ".repeat(400),
    erfordert_uebung: true,
    pruefstatus: "nicht_geprueft",
    geprueft_von: null,
    geprueft_am: null,
    stand: "2026-10-01T08:00:00Z",
  },
  durchgefuehrt_am: "2026-10-19T09:00:00Z",
  abgeschlossen_am: null,
  nachtrag_zu: null,
  erstellt_am: "2026-10-18T09:00:00Z",
};

const inhalt = baueNachweisInhalt({
  betrieb: { id: "b", name: "Demo Bedachungen GmbH", anschrift: "Musterstraße 1", aufbewahrung_jahre: null },
  unterweisung,
  abgeschlossenAm: "2026-10-20T10:00:00Z",
  teilnahmen: [
    {
      id: "1", unterweisung_id: unterweisung.id, mitarbeiter_id: "m2", token_hash: null, token_laeuft_ab: null,
      unterschrift_name: null, aussage: null, unterschrieben_am: null, user_agent: null, uebung_bestaetigt: null,
      mitarbeiter: { vorname: "Ben", nachname: "Schulz", taetigkeit: null },
    },
    {
      id: "2", unterweisung_id: unterweisung.id, mitarbeiter_id: "m1", token_hash: null, token_laeuft_ab: null,
      unterschrift_name: "Anna Becker", aussage: "Ich bestätige …", unterschrieben_am: "2026-10-19T10:00:00Z",
      user_agent: "Mozilla/5.0 (Linux; Android 14) " + "X".repeat(200), uebung_bestaetigt: true,
      mitarbeiter: { vorname: "Anna", nachname: "Becker", taetigkeit: "Dachdeckerin" },
    },
  ],
});

describe("Nachweis-PDF", () => {
  it("sortiert Teilnehmer nach Name", () => {
    expect(inhalt.teilnehmer.map((t) => t.name)).toEqual(["Anna Becker", "Ben Schulz"]);
  });

  it("ist deterministisch und lesbar, auch mit mehreren Seiten und Sonderzeichen", async () => {
    const hash = sha256Hex(kanonischesJson(inhalt));
    const a = await erzeugeProtokoll(inhalt, hash);
    const b = await erzeugeProtokoll(inhalt, hash);
    expect(sha256Hex(a)).toBe(sha256Hex(b));
    const doc = await PDFDocument.load(a);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getSubject()).toContain(hash);
  });

  it("lehnt geplante Unterweisungen ab", () => {
    expect(() =>
      baueNachweisInhalt({
        betrieb: { id: "b", name: "x", anschrift: null, aufbewahrung_jahre: null },
        unterweisung: { ...unterweisung, status: "geplant" },
        teilnahmen: [],
        abgeschlossenAm: "2026-10-20T10:00:00Z",
      }),
    ).toThrow();
  });
});
