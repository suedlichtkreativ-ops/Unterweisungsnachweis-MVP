import { redirect } from "next/navigation";
import { AktionsFormular } from "@/components/aktions-formular";
import { Feld } from "@/components/feld";
import { supabaseServer } from "@/lib/supabase/server";
import { betriebEinrichten } from "../aktionen";

export const metadata = { title: "Betrieb einrichten" };

export default async function EinrichtenSeite() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { count } = await supabase
    .from("betrieb_mitglied")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (count) redirect("/");

  return (
    <>
      <h1 className="mb-2">Betrieb einrichten</h1>
      <p className="mb-6 text-sm text-slate-600">Diese Angaben erscheinen im Kopf der Nachweis-PDFs.</p>
      <AktionsFormular aktion={betriebEinrichten} knopf="Weiter">
        <Feld label="Name des Betriebs" name="name" required />
        <Feld label="Anschrift (optional)" name="anschrift" />
        <Feld label="Ihr Name" name="anzeigename" required hinweis="Wird als unterweisende Person vorgeschlagen." />
      </AktionsFormular>
    </>
  );
}
