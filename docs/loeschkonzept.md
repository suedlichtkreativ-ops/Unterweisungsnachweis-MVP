# Löschkonzept

Stand: MVP. **Die konkreten Fristen sind fachlich/rechtlich durch den Betrieb festzulegen** (siehe offene Punkte).

## Datenkategorien

| Daten | Zweck | Gespeichert in | Löschung |
|---|---|---|---|
| Inhaber-Konto (E-Mail, Passwort-Hash) | Anmeldung | Supabase Auth | auf Wunsch / bei Kündigung (manuell, siehe unten) |
| Betrieb (Name, Anschrift) | Kopf der Nachweise | `betrieb` | bei Kündigung (manuell) |
| Mitarbeitende (Vorname, Nachname, Tätigkeit, Eintritt, jugendlich) | Planung, Fälligkeit, Nachweis | `mitarbeiter` | automatisch, sobald **inaktiv** und keine Teilnahme mehr aufbewahrt wird |
| Unterschrifts-Token | Zugang zur Unterschriftsseite | `teilnahme.token_hash` (nur SHA-256) | automatisch nach Ablauf (14 Tage) bzw. bei Abschluss |
| Bestätigung (eingegebener Name, Zeitstempel, Aussage, User Agent, Übung) | Nachweis | `teilnahme` | mit der Unterweisung nach Ablauf der Aufbewahrungsfrist |
| Nachweis-PDF + Prüfsummen | Nachweis | Storage `nachweise`, `nachweis` | nach Ablauf der Aufbewahrungsfrist |
| Audit-Log (Aktion, Tabelle, geänderte Spaltennamen – keine Werte) | Nachvollziehbarkeit | `audit_log` | mit dem Betrieb; Aufbewahrung offen |

Nicht erhoben werden: IP-Adressen, Kontaktdaten der Mitarbeitenden, Geburtsdaten, Standortdaten, Tracking/Analytics.

## Automatische Löschung

1. **Abgelaufene Links** – `tokens_bereinigen()` entfernt die Token-Hashes. Empfohlen täglich, z. B. per `pg_cron`:
   ```sql
   select cron.schedule('tokens', '15 3 * * *', 'select public.tokens_bereinigen()');
   ```
2. **Nachweise nach Aufbewahrungsfrist** – `loeschlauf_ausfuehren()` löscht abgeschlossene Unterweisungen, deren
   Datum länger als `betrieb.aufbewahrung_jahre` zurückliegt (inkl. Teilnahmen und Nachweis-Eintrag), sowie danach
   inaktive Mitarbeitende ohne verbleibende Teilnahmen. Die PDF-Dateien werden anschließend über die Storage-API
   gelöscht: `node scripts/loeschlauf.mjs` (Service-Role-Key, z. B. monatlich).
   - Ist `aufbewahrung_jahre` **nicht gesetzt (Standard)**, wird **nichts** gelöscht.
   - Nachträge werden mit dem Original gelöscht, sofern sie selbst ebenfalls älter als die Frist sind.
   - Der Löschlauf wird im Audit-Log mit Anzahl (ohne Personenbezug) vermerkt.

## Unveränderbarkeit vs. Löschung

Vor Ablauf der Frist können unterschriebene Teilnahmen, abgeschlossene Unterweisungen, Nachweise und Audit-Log
weder von Nutzern noch vom Datenbank-Owner geändert/gelöscht werden (Trigger). Einzige Ausnahme ist der Löschlauf,
der innerhalb der Funktion `loeschlauf_ausfuehren()` ein transaktionslokales Flag setzt, das für die Rollen
`anon`/`authenticated` wirkungslos ist (getestet in `supabase/tests/10_regeln.sql`).

## Manuelle Vorgänge (im MVP ohne Oberfläche)

- **Kündigung eines Betriebs:** Export erstellen und übergeben, dann per SQL als Owner mit gesetztem Flag
  (`set local app.loeschlauf = 'on'`) den Betrieb löschen (Cascade) und den Storage-Ordner `<betrieb_id>/` entfernen.
- **Auskunft (Art. 15 DSGVO):** Archiv nach Mitarbeiter filtern und exportieren.
- **Löschverlangen (Art. 17) vor Fristablauf:** Abwägung mit der Aufbewahrungspflicht durch den Betrieb; technisch
  nur über den manuellen Weg oben.
