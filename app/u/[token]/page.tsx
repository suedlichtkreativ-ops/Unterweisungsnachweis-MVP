import { AktionsFormular } from "@/components/aktions-formular";
import { Checkbox, Feld } from "@/components/feld";
import { Inhalt } from "@/components/inhalt";
import { supabaseAnon } from "@/lib/supabase/server";
import { datum, zeitpunkt } from "@/lib/format";
import { APP_NAME, DISCLAIMER_KURZ } from "@/lib/texte";
import type { TeilnahmeInfo } from "@/lib/typen";
import { unterschreiben } from "./aktionen";

export const metadata = { title: "Unterweisung bestätigen", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function UnterschriftSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data, error } = await supabaseAnon().rpc("teilnahme_info", { p_token: token });
  const info = (error ? null : data) as TeilnahmeInfo | null;

  return (
    <div className="min-h-dvh">
      <header className="bg-marke-900 px-4 py-3 text-white">
        <p className="mx-auto max-w-2xl text-sm font-semibold">{info?.betrieb ?? APP_NAME}</p>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        {!info ? (
          <div className="karte space-y-2">
            <h1>Link ungültig oder abgelaufen</h1>
            <p className="text-slate-700">
              Bitte wenden Sie sich an die Person, die die Unterweisung durchführt. Sie kann Ihnen einen neuen Link
              geben.
            </p>
          </div>
        ) : (
          <Ansicht info={info} token={token} />
        )}
        <p className="text-xs text-slate-500">{DISCLAIMER_KURZ}</p>
      </main>
    </div>
  );
}

function Ansicht({ info, token }: { info: TeilnahmeInfo; token: string }) {
  return (
    <>
      <div>
        <p className="text-sm text-slate-600">Unterweisung für {info.mitarbeiter}</p>
        <h1 className="mt-1">{info.thema.titel}</h1>
        <p className="mt-1 text-slate-700">
          {datum(info.datum)}
          {info.ort && ` · ${info.ort}`} · durch {info.unterweisender}
        </p>
      </div>

      {info.unterschrieben_am ? (
        <div className="hinweis-ok space-y-1 text-base">
          <p className="font-semibold">✓ Bestätigt am {zeitpunkt(info.unterschrieben_am)}</p>
          <p className="text-sm">„{info.aussage}“</p>
        </div>
      ) : info.status === "geplant" ? (
        <p className="hinweis-info text-base">
          <strong>Vorab-Information.</strong> Sie können die Inhalte schon lesen. Die Bestätigung ist erst nach der
          persönlichen Unterweisung möglich – öffnen Sie dann diesen Link erneut.
        </p>
      ) : null}

      {info.thema.pruefstatus !== "geprueft" && (
        <p className="hinweis-warnung">Hinweis: Der Inhalt dieses Themas ist im System noch nicht als fachlich geprüft markiert.</p>
      )}

      <section className="karte">
        {info.thema.kurzbeschreibung && <p className="mb-3 text-slate-600">{info.thema.kurzbeschreibung}</p>}
        <Inhalt text={info.thema.inhalt} />
        {info.uebung_beschreibung && (
          <p className="mt-4 text-sm">
            <span className="font-medium">Praktische Übung:</span> {info.uebung_beschreibung}
          </p>
        )}
      </section>

      {info.status === "durchgefuehrt" && !info.unterschrieben_am && (
        <section className="karte border-marke-600">
          <h2 className="mb-3">Teilnahme bestätigen</h2>
          <AktionsFormular aktion={unterschreiben.bind(null, token)} knopf="Verbindlich bestätigen" knopfKlasse="btn-primaer w-full">
            <Feld label="Ihr Vor- und Nachname" name="name" required autoComplete="name" />
            <blockquote className="rounded-lg bg-slate-50 p-3 text-sm italic text-slate-800">„{info.aussage}“</blockquote>
            <Checkbox name="bestaetigt" required label="Ich bestätige die obige Aussage." />
            {info.thema.erfordert_uebung && (
              <Checkbox name="uebung" required label="Ich habe an der praktischen Übung teilgenommen." />
            )}
            <p className="text-xs text-slate-500">
              Gespeichert werden: Ihr eingegebener Name, Datum und Uhrzeit, die bestätigte Aussage und die technische
              Kennung Ihres Browsers (User Agent). Keine IP-Adresse. Der Nachweis wird von Ihrem Arbeitgeber aufbewahrt.
            </p>
          </AktionsFormular>
          <p className="mt-3 text-xs text-slate-500">
            Haben Sie etwas nicht verstanden? Bitte nicht bestätigen, sondern direkt bei {info.unterweisender} nachfragen.
          </p>
        </section>
      )}
    </>
  );
}
