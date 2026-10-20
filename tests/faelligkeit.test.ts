import { describe, expect, it } from "vitest";
import {
  addiereMonate,
  berechneFaelligkeit,
  effektivesIntervall,
  heuteBerlin,
  letzteUnterweisungen,
  schlechteste,
} from "@/lib/faelligkeit";

describe("addiereMonate", () => {
  it("addiert normal", () => expect(addiereMonate("2026-03-15", 12)).toBe("2027-03-15"));
  it("kürzt auf Monatsende", () => {
    expect(addiereMonate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addiereMonate("2027-08-31", 6)).toBe("2028-02-29");
  });
});

describe("berechneFaelligkeit", () => {
  const basis = { intervallMonate: 12, jugendlich: false };
  it("nie unterwiesen = rot", () => {
    expect(berechneFaelligkeit({ ...basis, letzte: null, heute: "2026-10-20" }).ampel).toBe("rot");
  });
  it("grün bei mehr als 30 Tagen", () => {
    const f = berechneFaelligkeit({ ...basis, letzte: "2026-01-10", heute: "2026-10-20" });
    expect(f).toMatchObject({ ampel: "gruen", faelligAm: "2027-01-10", tageBisFaellig: 82 });
  });
  it("gelb ab 30 Tagen vorher, auch am Fälligkeitstag", () => {
    expect(berechneFaelligkeit({ ...basis, letzte: "2025-11-19", heute: "2026-10-20" }).ampel).toBe("gelb");
    expect(berechneFaelligkeit({ ...basis, letzte: "2025-10-20", heute: "2026-10-20" }).ampel).toBe("gelb");
    expect(berechneFaelligkeit({ ...basis, letzte: "2025-11-20", heute: "2026-10-20" }).ampel).toBe("gruen");
  });
  it("rot nach Fälligkeit", () => {
    expect(berechneFaelligkeit({ ...basis, letzte: "2025-10-19", heute: "2026-10-20" }).ampel).toBe("rot");
  });
  it("Jugendliche höchstens 6 Monate", () => {
    expect(effektivesIntervall(12, true)).toBe(6);
    expect(effektivesIntervall(3, true)).toBe(3);
    const f = berechneFaelligkeit({ intervallMonate: 12, jugendlich: true, letzte: "2026-03-01", heute: "2026-10-20" });
    expect(f).toMatchObject({ ampel: "rot", faelligAm: "2026-09-01" });
  });
});

describe("Hilfsfunktionen", () => {
  it("letzteUnterweisungen nimmt das jüngste Datum", () => {
    const m = letzteUnterweisungen([
      { mitarbeiter_id: "a", thema_id: "t", datum: "2025-01-01" },
      { mitarbeiter_id: "a", thema_id: "t", datum: "2026-01-01" },
      { mitarbeiter_id: "a", thema_id: "u", datum: "2024-01-01" },
    ]);
    expect(m.get("a:t")).toBe("2026-01-01");
    expect(m.get("a:u")).toBe("2024-01-01");
  });
  it("schlechteste Ampel", () => {
    expect(schlechteste(["gruen", "gelb"])).toBe("gelb");
    expect(schlechteste(["gelb", "rot", "gruen"])).toBe("rot");
    expect(schlechteste([])).toBe("gruen");
  });
  it("heuteBerlin berücksichtigt die Zeitzone", () => {
    expect(heuteBerlin(new Date("2026-10-20T22:30:00Z"))).toBe("2026-10-21");
  });
});
