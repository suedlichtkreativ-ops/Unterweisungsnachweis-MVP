import Link from "next/link";
import { DISCLAIMER_LANG, LINK_GUELTIG_TAGE } from "@/lib/texte";

export const metadata = { title: "Hinweise" };

export default function HinweiseSeite() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link href="/" className="text-sm">‹ Zur Anwendung</Link>
      <h1>Hinweise</h1>

      <section className="karte space-y-3">
        <h2>Was diese Anwendung ist – und was nicht</h2>
        {DISCLAIMER_LANG.map((absatz) => (
          <p key={absatz} className="text-sm leading-relaxed">
            {absatz}
          </p>
        ))}
      </section>

      <section className="karte space-y-3 text-sm leading-relaxed">
        <h2>Datenschutz in Kürze</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Hosting und Datenbank ausschließlich in der EU (Region Frankfurt).</li>
          <li>
            Über Mitarbeitende werden nur Vor- und Nachname, Tätigkeit, Eintrittsdatum und die Angabe „jugendlich“
            gespeichert – keine Kontaktdaten.
          </li>
          <li>
            Bei der Bestätigung werden der eingegebene Name, der Zeitpunkt, die bestätigte Aussage und der User Agent
            des Browsers gespeichert. Keine IP-Adresse, keine Standortdaten.
          </li>
          <li>
            Unterschrifts-Links sind {LINK_GUELTIG_TAGE} Tage gültig. In der Datenbank liegt nur eine Prüfsumme des
            Links, nicht der Link selbst.
          </li>
          <li>Keine Analyse- oder Werbe-Tools, keine Cookies außer dem Anmelde-Cookie für Inhaber.</li>
        </ul>
      </section>

      <section className="karte space-y-3 text-sm leading-relaxed">
        <h2>Löschkonzept</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Abgelaufene oder nicht genutzte Links werden automatisch unbrauchbar gemacht.</li>
          <li>
            Nachweise werden nach Ablauf der vom Betrieb festgelegten Aufbewahrungsfrist vollständig gelöscht (PDF,
            Unterschriften, Unterweisung). Ohne festgelegte Frist wird nichts automatisch gelöscht.
          </li>
          <li>
            Ausgeschiedene (deaktivierte) Mitarbeitende werden gelöscht, sobald keine Nachweise mit ihnen mehr
            aufbewahrt werden.
          </li>
          <li>Abgeschlossene Nachweise können vorher nicht geändert oder gelöscht werden (Unveränderbarkeit).</li>
        </ul>
      </section>
    </main>
  );
}
