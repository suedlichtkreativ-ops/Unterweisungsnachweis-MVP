import "server-only";
import { headers } from "next/headers";

/** Basis-URL für Unterschrifts-Links. NEXT_PUBLIC_APP_URL hat Vorrang vor dem Host-Header. */
export async function appUrl(): Promise<string> {
  const konfig = process.env.NEXT_PUBLIC_APP_URL;
  if (konfig) return konfig.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
