import { describe, expect, it } from "vitest";
import { kanonischesJson, neuerToken, sha256Hex } from "@/lib/hash";

describe("kanonischesJson", () => {
  it("sortiert Schlüssel rekursiv und lässt undefined weg", () => {
    expect(kanonischesJson({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: undefined }, e: null })).toBe(
      '{"a":{"d":[3,{"x":2,"y":1}]},"b":1,"e":null}',
    );
  });
  it("ist unabhängig von der Einfügereihenfolge", () => {
    expect(kanonischesJson({ x: 1, y: "ä" })).toBe(kanonischesJson({ y: "ä", x: 1 }));
  });
  it("lehnt NaN ab", () => {
    expect(() => kanonischesJson({ a: NaN })).toThrow();
  });
});

describe("sha256Hex", () => {
  it("entspricht dem bekannten Testvektor", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("hasht UTF-8 (wie hash_hex() in Postgres)", () => {
    expect(sha256Hex("Gerüst")).toBe(sha256Hex(Buffer.from("Gerüst", "utf8")));
  });
});

describe("neuerToken", () => {
  it("liefert 43 Zeichen base64url und passenden Hash", () => {
    const { token, hash } = neuerToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(sha256Hex(token));
    expect(neuerToken().token).not.toBe(token);
  });
});
