# Offene Punkte

## Fachlich / rechtlich (vom Betrieb bzw. Fachleuten zu klären)

1. **Themeninhalte:** Alle 6 Bibliotheksthemen sind Platzhalter. Inhalte müssen von einer fachkundigen Person
   (z. B. Fachkraft für Arbeitssicherheit) auf Basis der Gefährdungsbeurteilung erstellt und in der App als geprüft
   vermerkt werden.
2. **Aufbewahrungsfrist:** Ist bewusst nicht vorbelegt (`aufbewahrung_jahre = NULL` → keine automatische Löschung).
   Frist festlegen und im Betrieb eintragen (aktuell nur per SQL/Dashboard, keine Oberfläche).
3. **Form der Bestätigung:** Umgesetzt ist eine einfache elektronische Bestätigung (Name eingeben + Aussage
   bestätigen, Zeitstempel, User Agent). Ob das im Einzelfall genügt oder eine handschriftliche/qualifizierte
   Signatur nötig ist, wurde nicht geprüft – keine Rechtsberatung.
4. **Intervalle:** Standard 12 Monate je Thema, Jugendliche max. 6 Monate. Themenspezifische Intervalle und
   anlassbezogene Unterweisungen (neue Tätigkeit, Unfall, neue Arbeitsmittel) sind vom Betrieb festzulegen;
   anlassbezogene Pflichten bildet die Ampel nicht ab.
5. **Auftragsverarbeitung:** AV-Verträge mit Supabase und dem Hoster (z. B. Vercel) abschließen; Region
   `eu-central-1` bzw. Funktionen in `fra1` konfigurieren. Datenschutzerklärung/Impressum für den Betreiber fehlen.
6. **Verständlichkeit / Sprache:** Mehrsprachigkeit ist nicht im MVP. Bei Mitarbeitenden mit geringen
   Deutschkenntnissen muss die Unterweisung anderweitig verständlich erfolgen.

## Technisch

1. **Rolle „Unterweisende/r“:** Im Datenmodell und in RLS vorhanden, aber es gibt noch keine Einladung neuer
   Nutzer in einen Betrieb (nur der Registrierende wird Inhaber).
2. **Verwaiste PDFs:** Schlägt der DB-Abschluss nach dem Upload fehl (z. B. weil gleichzeitig jemand unterschrieben
   hat), bleibt eine nicht verlinkte PDF im Storage. Ein Aufräumjob fehlt.
3. **Aufbewahrungsfrist & Betriebsdaten bearbeiten:** Keine Einstellungsseite.
4. **Zuordnung Thema ↔ Tätigkeit:** Alle aktiven Themen gelten für alle aktiven Mitarbeitenden. Eine Zuordnung
   nach Tätigkeit (z. B. Asbest nur für bestimmte Gruppen) fehlt.
5. **Rate-Limiting** der öffentlichen Unterschrifts-RPCs (Token hat 256 Bit, Brute Force ist praktisch
   ausgeschlossen; Schutz gegen Last fehlt dennoch).
6. **Test-Feld** `teilnahme.test_ergebnis` ist angelegt, aber ohne Oberfläche.
7. **Zeitstempel:** Der Zeitstempel stammt vom Datenbankserver; es gibt keinen qualifizierten Zeitstempel (RFC 3161).
8. **Supabase CLI** (`supabase start`) wurde in der Entwicklungsumgebung nicht ausgeführt (kein Docker). Getestet
   wurde mit Postgres 16, dem echten GoTrue (Supabase Auth) und PostgREST sowie einem Storage-Nachbau
   (siehe `e2e/`). Vor Produktivbetrieb einmal gegen ein echtes Supabase-Projekt testen.
9. **E-Mail-Bestätigung / Passwort vergessen:** Registrierung mit Bestätigungsmail ist angebunden
   (`/auth/callback`), eine „Passwort vergessen“-Seite fehlt.
