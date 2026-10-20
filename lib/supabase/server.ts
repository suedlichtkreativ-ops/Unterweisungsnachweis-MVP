import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../env";

/** Client mit der Sitzung des angemeldeten Nutzers (RLS greift). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (zuSetzen) => {
        try {
          zuSetzen.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // In Server Components nicht möglich – die Middleware aktualisiert die Sitzung.
        }
      },
    },
  });
}

/** Anonymer Client ohne Sitzung – für die öffentliche Unterschriftsseite. */
export function supabaseAnon() {
  return createPlainClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
