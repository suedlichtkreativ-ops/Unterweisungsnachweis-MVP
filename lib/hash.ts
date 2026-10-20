import { createHash, randomBytes } from "node:crypto";

export function sha256Hex(daten: string | Uint8Array): string {
  return createHash("sha256").update(daten).digest("hex");
}

/**
 * Deterministische JSON-Serialisierung: Objektschlüssel sortiert, keine Leerzeichen,
 * `undefined` wird weggelassen. Derselbe Datensatz ergibt immer denselben Text und
 * damit denselben Hash. Die Datenbank prüft beim Abschluss sha256(text) == inhalt_sha256.
 */
export function kanonischesJson(wert: unknown): string {
  if (wert === null || typeof wert !== "object") {
    if (typeof wert === "number" && !Number.isFinite(wert)) {
      throw new Error("Nicht-endliche Zahl kann nicht kanonisch serialisiert werden");
    }
    return JSON.stringify(wert);
  }
  if (Array.isArray(wert)) {
    return "[" + wert.map((w) => (w === undefined ? "null" : kanonischesJson(w))).join(",") + "]";
  }
  const eintraege = Object.entries(wert as Record<string, unknown>)
    .filter(([, w]) => w !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return "{" + eintraege.map(([k, w]) => JSON.stringify(k) + ":" + kanonischesJson(w)).join(",") + "}";
}

/** Zufälliger Unterschrifts-Token (256 Bit). In der DB wird nur der Hash gespeichert. */
export function neuerToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256Hex(token) };
}
