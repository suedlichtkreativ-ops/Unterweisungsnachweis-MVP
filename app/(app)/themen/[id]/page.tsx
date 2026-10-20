import Link from "next/link";
import { notFound } from "next/navigation";
import { AktionsFormular } from "@/components/aktions-formular";
import { PruefAbzeichen } from "@/components/abzeichen";
import { Checkbox, Feld } from "@/components/feld";
import { Inhalt } from "@/components/inhalt";
import { holeKontext } from "@/lib/kontext";
import { heuteBerlin } from "@/lib/faelligkeit";
import { datum } from "@/lib/format";
import type { Thema } from "@/lib/typen";
import { pruefungBestaetigen, pruefungZuruecknehmen, themaSpeichern } from "../aktionen";

export const metadata = { title: "Thema" };

export default async function ThemaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, betrieb, mitglied } = await holeKontext();
  const { data } = await supabase.from("thema").select("*").eq("id", id).eq("betrieb_id", betrieb.id).maybeSingle();
  if (!data) notFound();
  const t = data as Thema;
  const inhaber = mitglied.rolle === "inhaber";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/themen" className="text-sm">‹ Themen</Link>
        <h1 className="mt-1">{t.titel}</h1>
        <div className="mt-2">
          <PruefAbzeichen status={t.pruefstatus} />
          {t.pruefstatus === "geprueft" && (
            <span className="ml-2 text-sm text-slate-600">
              von {t.geprueft_von} am {datum(t.geprueft_am)}
            </span>
          )}
        </div>
      </div>

      {!inhaber ? (
        <section className="karte">
          <Inhalt text={t.inhalt} />
        </section>
      ) : (
        <>
          <section className="karte">
            <h2 className="mb-3">Inhalt bearbeiten</h2>
            {t.pruefstatus === "geprueft" && (
              <p className="hinweis-warnung mb-4">
                Änderungen an Titel, Inhalt oder Übungspflicht setzen den Prüfstatus auf „noch nicht geprüft“ zurück.
              </p>
            )}
            <AktionsFormular aktion={themaSpeichern.bind(null, t.id)} knopf="Speichern">
              <Feld label="Titel" name="titel" defaultValue={t.titel} required />
              <Feld label="Kurzbeschreibung" name="kurzbeschreibung" defaultValue={t.kurzbeschreibung ?? ""} />
              <div>
                <label htmlFor="inhalt" className="beschriftung">
                  Inhalt
                </label>
                <textarea id="inhalt" name="inhalt" rows={16} defaultValue={t.inhalt} className="eingabe font-mono text-sm" />
                <p className="mt-1 text-xs text-slate-500">
                  Formatierung: „## Überschrift“, „- Aufzählung“, Leerzeile für neuen Absatz.
                </p>
              </div>
              <Feld
                label="Wiederholung alle … Monate"
                name="intervall_monate"
                type="number"
                min={1}
                max={60}
                defaultValue={t.intervall_monate}
                required
                hinweis="Für Jugendliche wird automatisch höchstens 6 Monate angesetzt."
              />
              <Checkbox
                name="erfordert_uebung"
                defaultChecked={t.erfordert_uebung}
                label="Praktische Übung erforderlich"
                hinweis="Z. B. bei PSA gegen tödliche Gefahren (§ 31 DGUV Vorschrift 1). Teilnehmende bestätigen die Übung bei der Unterschrift."
              />
              <Checkbox name="aktiv" defaultChecked={t.aktiv} label="Aktiv (in Übersicht und Planung anzeigen)" />
            </AktionsFormular>
          </section>

          <section className="karte">
            <h2 className="mb-3">Fachliche Prüfung</h2>
            {t.pruefstatus === "geprueft" ? (
              <form action={pruefungZuruecknehmen.bind(null, t.id)}>
                <button className="btn-sekundaer">Prüfvermerk zurücknehmen</button>
              </form>
            ) : (
              <AktionsFormular aktion={pruefungBestaetigen.bind(null, t.id)} knopf="Prüfung vermerken">
                <Feld label="Geprüft von (Name, Funktion)" name="geprueft_von" required placeholder="z. B. M. Muster, Fachkraft für Arbeitssicherheit" />
                <Feld label="Geprüft am" name="geprueft_am" type="date" defaultValue={heuteBerlin()} required />
                <Checkbox
                  name="bestaetigt"
                  required
                  label="Der aktuelle Inhalt wurde von der genannten fachkundigen Person geprüft und passt zur Gefährdungsbeurteilung des Betriebs."
                />
              </AktionsFormular>
            )}
          </section>

          <section className="karte">
            <h2 className="mb-3">Vorschau (so sehen es Mitarbeitende)</h2>
            <Inhalt text={t.inhalt} />
          </section>
        </>
      )}
    </div>
  );
}
