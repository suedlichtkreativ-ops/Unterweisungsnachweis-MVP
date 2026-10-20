function pflicht(name: string, wert: string | undefined): string {
  if (!wert) throw new Error(`Umgebungsvariable ${name} fehlt (siehe .env.example)`);
  return wert;
}

export const SUPABASE_URL = () => pflicht("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = () =>
  pflicht("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
