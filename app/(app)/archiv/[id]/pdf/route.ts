import { NextResponse, type NextRequest } from "next/server";
import { holeKontext } from "@/lib/kontext";
import { BUCKET, dateiname } from "@/lib/abschluss";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await holeKontext();
  const { data } = await supabase
    .from("nachweis")
    .select("storage_pfad, unterweisung(datum, thema_snapshot)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new NextResponse("Nicht gefunden", { status: 404 });
  const u = data.unterweisung as unknown as { datum: string; thema_snapshot: { titel: string } };
  const { data: signiert, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.storage_pfad, 60, { download: dateiname(u.thema_snapshot.titel, u.datum) });
  if (error || !signiert) return new NextResponse("Datei nicht verfügbar", { status: 404 });
  return NextResponse.redirect(signiert.signedUrl);
}
