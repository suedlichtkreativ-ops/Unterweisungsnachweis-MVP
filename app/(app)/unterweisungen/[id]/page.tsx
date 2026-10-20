import Link from "next/link";
import { notFound } from "next/navigation";
import { AktionsFormular } from "@/components/aktions-formular";
import { PruefAbzeichen, StatusAbzeichen } from "@/components/abzeichen";
import { Checkbox, Feld } from "@/components/feld";
import { Inhalt } from "@/components/inhalt";
import { LinkVerwaltung } from "@/components/link-verwaltung";
import { holeKontext } from "@/lib/kontext";
import { heuteBerlin } from "@/lib/faelligkeit";
import { datum, name, zeitpunkt } from "@/lib/format";
import type { Mitarbeiter, Nachweis, Teilnahme, Thema, Unterweisung } from "@/lib/typen";
import {
  abschliessen,
  alsDurchgefuehrtMarkieren,
  angabenSpeichern,
  linksErzeugen,
  teilnehmerEntfernen,
  teilnehmerHinzufuegen,
  unterweisungLoeschen,
} from "../aktionen";

export const metadata = { title: "Unterweisung" };

type TeilnahmeMit = Teilnahme & { mitarbeiter: Pick<Mitarbeiter, "id" | "vorname" | "nachname" | "aktiv"> };

export default async function UnterweisungDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await holeKontext();

  const { data } = await supabase
    .from("unterweisung")
    .select("*, thema(id, titel, inhalt, kurzbeschreibung, erfordert_uebung, pruefstatus)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const u = data as Unterweisung & {
    thema: Pick<Thema, "id" | "titel" | "inhalt" | "kurzbeschreibung" | "erfordert_uebung" | "pruefstatus">;
  };

  const [tnRes, maRes, nwRes, nachtraegeRes] = await Promise.all([
    supabase.from("teilnahme").select("*, mitarbeiter(id, vorname, nachname, aktiv)").eq("unterweisung_id", id),
    supabase.from("mitarbeiter").select("id, vorname, nachname").eq("aktiv", true).order("nachname"),
    supabase.from("nachweis").select("*").eq("unterweisung_id", id).maybeSingle(),
    supabase.from("unterweisung").select("id, datum, status").eq("nachtrag_zu", id),
  ]);
  const teilnahmen = ((tnRes.data ?? []) as TeilnahmeMit[]).sort((a, b) =>
    a.mitarbeiter.nachname.localeCompare(b.mitarbeiter.nachname, "de"),
  );
  const vorhandene = new Set(teilnahmen.map((t) => t.mitarbeiter_id));
  const weitere = ((maRes.data ?? []) as Pick<Mitarbeiter, "id" | "vorname" | "nachname">[]).filter(
    (m) => !vorhandene.has(m.id),
  );
  const nachweis = nwRes.data as Nachweis | null;
  const nachtraege = (nachtraegeRes.data ?? []) as Pick<Unterweisung, "id" | "datum" | "status">[];

  // Ab "durchgeführt" gilt der eingefrorene Stand
  const thema = u.thema_snapshot ?? u.thema;
  const unterschrieben = teilnahmen.filter((t) => t.unterschrieben_am).length;
  const heute = heuteBerlin();
  const jetzt = new Date().toISOString();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/unterweisungen" className="text-sm">‹ Unterweisungen</Link>
        <h1 className="mt-1">{thema.titel}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <StatusAbzeichen status={u.status} />
          <PruefAbzeichen status={thema.pruefstatus} />
          <span>
            {datum(u.datum)}
            {u.ort && ` · ${u.ort}`} · {u.unterweisender_name}
          </span>
        </div>
        {u.nachtrag_zu && (
          <p className="mt-2 text-sm">
            Nachtrag zu <Link href={`/unterweisungen/${u.nachtrag_zu}`}>dieser Unterweisung</Link>
          </p>
        )}
      </div>

      <Ablauf status={u.status} />

      {/* ------------------------------------------------------------ Teilnehmende */}
      <section className="karte space-y-4">
        <div className="flex items-center justify-between">
          <h2>
            Teilnehmende · {unterschrieben}/{teilnahmen.length} bestätigt
          </h2>
          {u.status === "durchgefuehrt" && (
            <Link href={`/unterweisungen/${id}`} className="text-sm">
              ↻ Aktualisieren
            </Link>
          )}
        </div>
        <ul className="divide-y divide-slate-100">
          {teilnahmen.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{name(t.mitarbeiter)}</span>
              <span className="flex items-center gap-2">
                {t.unterschrieben_am ? (
                  <span className="text-emerald-800">✓ bestätigt {zeitpunkt(t.unterschrieben_am)}</span>
                ) : (
                  <span className="text-slate-500">
                    {u.status === "abgeschlossen"
                      ? "nicht bestätigt"
                      : t.token_laeuft_ab && t.token_laeuft_ab > jetzt
                        ? `offen · Link bis ${zeitpunkt(t.token_laeuft_ab)}`
                        : "offen · kein gültiger Link"}
                  </span>
                )}
                {u.status !== "abgeschlossen" && !t.unterschrieben_am && (
                  <form action={teilnehmerEntfernen.bind(null, id, t.id)}>
                    <button className="text-xs text-red-700 hover:underline" title="Entfernen">
                      entfernen
                    </button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>

        {u.status !== "abgeschlossen" && (
          <>
            <hr className="border-slate-100" />
            <h3 className="font-semibold">Unterschrifts-Links</h3>
            {u.status === "geplant" && (
              <p className="text-sm text-slate-600">
                Vor der Unterweisung können Teilnehmende die Inhalte über den Link lesen. Unterschreiben ist erst
                möglich, nachdem Sie die Unterweisung als durchgeführt markiert haben.
              </p>
            )}
            <LinkVerwaltung
              unterweisungId={id}
              thema={thema.titel}
              erzeugen={linksErzeugen}
              personen={teilnahmen.map((t) => ({
                teilnahmeId: t.id,
                name: name(t.mitarbeiter),
                unterschrieben: !!t.unterschrieben_am,
                linkGueltigBis: t.token_laeuft_ab && t.token_laeuft_ab > jetzt ? t.token_laeuft_ab : null,
              }))}
            />
          </>
        )}

        {u.status !== "abgeschlossen" && weitere.length > 0 && (
          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium">Weitere Teilnehmende hinzufügen</summary>
            <AktionsFormular aktion={teilnehmerHinzufuegen.bind(null, id)} knopf="Hinzufügen" knopfKlasse="btn-sekundaer" className="mt-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {weitere.map((m) => (
                  <Checkbox key={m.id} name="mitarbeiter" value={m.id} label={name(m)} />
                ))}
              </div>
            </AktionsFormular>
          </details>
        )}
      </section>

      {/* ------------------------------------------------------------ Status-Aktionen */}
      {u.status === "geplant" && (
        <section className="karte space-y-4">
          <h2>Unterweisung durchgeführt?</h2>
          {u.datum > heute ? (
            <p className="text-sm text-slate-600">
              Geplant für den {datum(u.datum)}. Als durchgeführt markieren ist ab diesem Tag möglich.
            </p>
          ) : (
            <AktionsFormular
              aktion={alsDurchgefuehrtMarkieren.bind(null, id, u.thema.erfordert_uebung)}
              knopf="Als durchgeführt markieren"
              bestaetigung="Danach sind Datum, Ort, unterweisende Person und Inhalt eingefroren. Fortfahren?"
            >
              <Checkbox
                name="persoenlich"
                required
                label={`Die Unterweisung hat am ${datum(u.datum)} persönlich durch ${u.unterweisender_name} stattgefunden.`}
              />
              {u.thema.erfordert_uebung && (
                <>
                  <Checkbox name="uebung" required label="Die praktische Übung wurde durchgeführt." />
                  <div>
                    <label htmlFor="uebung_beschreibung_d" className="beschriftung">
                      Kurzbeschreibung der Übung
                    </label>
                    <textarea
                      id="uebung_beschreibung_d"
                      name="uebung_beschreibung"
                      rows={2}
                      required
                      defaultValue={u.uebung_beschreibung ?? ""}
                      className="eingabe"
                    />
                  </div>
                </>
              )}
              <p className="text-xs text-slate-500">
                Der aktuelle Themeninhalt wird dabei festgeschrieben; spätere Änderungen am Thema wirken sich auf diese
                Unterweisung nicht mehr aus.
              </p>
            </AktionsFormular>
          )}
        </section>
      )}

      {u.status === "durchgefuehrt" && (
        <section className="karte space-y-3">
          <h2>Abschließen und Nachweis erzeugen</h2>
          <p className="text-sm text-slate-600">
            Erzeugt das PDF-Protokoll mit Prüfsumme. Danach ist die Unterweisung unveränderbar.
            {teilnahmen.length - unterschrieben > 0 &&
              ` ${teilnahmen.length - unterschrieben} Person(en) haben noch nicht bestätigt und werden als „nicht bestätigt“ vermerkt.`}
          </p>
          {unterschrieben === 0 ? (
            <p className="hinweis-info">Es ist mindestens eine Bestätigung erforderlich.</p>
          ) : (
            <AktionsFormular
              aktion={abschliessen.bind(null, id)}
              knopf="Abschließen und PDF erzeugen"
              bestaetigung={`Jetzt abschließen? ${unterschrieben} von ${teilnahmen.length} haben bestätigt. Dies kann nicht rückgängig gemacht werden.`}
            />
          )}
        </section>
      )}

      {u.status === "abgeschlossen" && (
        <section className="karte space-y-3">
          <h2>Nachweis</h2>
          {nachweis ? (
            <>
              <a href={`/archiv/${nachweis.id}/pdf`} className="btn-primaer">
                PDF herunterladen
              </a>
              <dl className="grid gap-1 text-xs text-slate-600">
                <dt className="font-medium">Abgeschlossen</dt>
                <dd>{zeitpunkt(u.abgeschlossen_am)}</dd>
                <dt className="font-medium">SHA-256 Datensatz (im PDF)</dt>
                <dd className="break-all font-mono">{nachweis.inhalt_sha256}</dd>
                <dt className="font-medium">SHA-256 PDF-Datei</dt>
                <dd className="break-all font-mono">{nachweis.pdf_sha256}</dd>
              </dl>
            </>
          ) : (
            <p className="text-sm text-slate-600">Kein Nachweis gefunden.</p>
          )}
          {nachtraege.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">Nachträge:</p>
              <ul className="list-disc pl-5">
                {nachtraege.map((n) => (
                  <li key={n.id}>
                    <Link href={`/unterweisungen/${n.id}`}>Nachtrag vom {datum(n.datum)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link href={`/unterweisungen/neu?nachtrag=${id}`} className="btn-sekundaer">
            Nachtrag anlegen
          </Link>
          <p className="text-xs text-slate-500">
            Korrekturen sind nur über einen Nachtrag möglich – der ursprüngliche Nachweis bleibt unverändert.
          </p>
        </section>
      )}

      {/* ------------------------------------------------------------ Angaben / Inhalt */}
      {u.status === "geplant" && (
        <details className="karte">
          <summary className="cursor-pointer font-semibold">Angaben bearbeiten</summary>
          <AktionsFormular aktion={angabenSpeichern.bind(null, id)} knopf="Speichern" className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld label="Datum" name="datum" type="date" defaultValue={u.datum} required />
              <Feld label="Ort" name="ort" defaultValue={u.ort ?? ""} />
            </div>
            <Feld label="Unterweisende Person" name="unterweisender_name" defaultValue={u.unterweisender_name} required />
            <input type="hidden" name="uebung_beschreibung" value={u.uebung_beschreibung ?? ""} />
          </AktionsFormular>
        </details>
      )}

      <details className="karte">
        <summary className="cursor-pointer font-semibold">
          Inhalt der Unterweisung {u.thema_snapshot ? "(festgeschrieben)" : "(aktueller Stand des Themas)"}
        </summary>
        <div className="mt-4">
          {thema.kurzbeschreibung && <p className="mb-2 text-sm text-slate-600">{thema.kurzbeschreibung}</p>}
          <Inhalt text={thema.inhalt} />
          {u.uebung_beschreibung && (
            <p className="mt-4 text-sm">
              <span className="font-medium">Praktische Übung:</span> {u.uebung_beschreibung}
            </p>
          )}
          {u.bemerkung && (
            <p className="mt-2 text-sm">
              <span className="font-medium">Bemerkung:</span> {u.bemerkung}
            </p>
          )}
        </div>
      </details>

      {u.status === "geplant" && (
        <form action={unterweisungLoeschen.bind(null, id)}>
          <button className="btn-gefahr">Geplante Unterweisung löschen</button>
        </form>
      )}
    </div>
  );
}

function Ablauf({ status }: { status: Unterweisung["status"] }) {
  const schritte = [
    { key: "geplant", text: "Geplant · Links verschicken" },
    { key: "durchgefuehrt", text: "Persönlich unterwiesen · Bestätigungen sammeln" },
    { key: "abgeschlossen", text: "Abgeschlossen · Nachweis" },
  ] as const;
  const index = schritte.findIndex((s) => s.key === status);
  return (
    <ol className="grid grid-cols-3 gap-2 text-xs">
      {schritte.map((s, i) => (
        <li
          key={s.key}
          className={`rounded-lg border px-2 py-2 ${
            i < index
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : i === index
                ? "border-marke-600 bg-marke-50 font-semibold text-marke-900"
                : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          {i + 1}. {s.text}
        </li>
      ))}
    </ol>
  );
}
