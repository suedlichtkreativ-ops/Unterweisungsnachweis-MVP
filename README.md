# Unterweisungsnachweis

MVP einer Web-App zur **Planung und Dokumentation von Sicherheitsunterweisungen** in Dachdeckerbetrieben.

> **Wichtig:** Die App ist ein Dokumentationswerkzeug. Sie ersetzt **nicht** die persönliche Unterweisung
> (§ 12 ArbSchG) und ist **keine Rechtsberatung**. Die mitgelieferten Themen sind **Platzhalter ohne fachlichen
> Inhalt**. Keine Verbindung zu BG BAU oder DGUV.

## Ablauf

```
Inhaber plant ──► Links an Mitarbeitende (optional: Inhalte vorab auf dem Handy lesen)
      │
      ▼
Persönliche Unterweisung vor Ort ──► „Als durchgeführt markieren“ (Inhalt wird eingefroren)
      │
      ▼
Jede/r bestätigt per Link: Name + ausdrückliche Aussage (+ Übung bei PSA)
      │
      ▼
„Abschließen“ ──► PDF-Protokoll mit SHA-256 ──► Archiv (unveränderbar, Export als ZIP)
```

## Funktionen (MVP)

- Login/Registrierung Inhaber, Betrieb einrichten (Supabase Auth)
- Mitarbeiterverwaltung (datensparsam; deaktivieren statt löschen, solange Nachweise existieren)
- Themenbibliothek mit 6 Platzhaltern („noch nicht geprüft“), Übernahme, Bearbeitung, Prüfvermerk
  (Inhaltsänderung setzt den Prüfstatus automatisch zurück)
- Fälligkeitsübersicht als Ampel (rot = fällig/nie, gelb = ≤ 30 Tage, grün), Jugendliche max. 6 Monate
- Unterweisung planen (Fällige vorausgewählt), Links mit QR-Code / WhatsApp / Kopieren
- Öffentliche Unterschriftsseite `/u/<token>` ohne Login, mobil optimiert
- PDF-Protokoll (serverseitig, deterministisch) mit Inhalts-Hash; PDF-Hash in der DB
- Archiv mit Filter, PDF-Download (signierte URL, 60 s), ZIP-Export (PDFs + CSV + `SHA256SUMS.txt`),
  Prüfung einer vorliegenden PDF auf Unverändertheit (Hash wird im Browser berechnet)
- Nachträge zu abgeschlossenen Unterweisungen (Original bleibt unverändert)

Nicht enthalten (bewusst): Bezahlung, Prämien, Mehrsprachigkeit, Videos.

## Technik

Next.js 15 (App Router, Server Actions) · TypeScript strict · Tailwind 4 · Supabase (Auth, Postgres + RLS,
Storage) · `pdf-lib` · `zod`

```
app/
  (auth)/          Login, Registrierung, Betrieb einrichten
  (app)/           Übersicht, Unterweisungen, Mitarbeiter, Themen, Archiv (angemeldet)
  u/[token]/       öffentliche Unterschriftsseite
  hinweise/        Disclaimer, Datenschutz, Löschkonzept
lib/               Fälligkeit, Hash, PDF, Abschluss, Supabase-Clients
supabase/
  migrations/      Schema, Rechte/RLS/Trigger/RPCs, Bibliothek, Storage
  seed.sql         Demo-Daten
  tests/           SQL-Tests für die Datenbankregeln
tests/             Unit-Tests (Vitest)
e2e/               End-to-End-Test ohne Docker (siehe e2e/README.md)
docs/              Löschkonzept, offene Punkte
scripts/           db-test.sh, loeschlauf.mjs
```

## Sicherheits- und Integritätskonzept

Die Regeln werden **in der Datenbank** erzwungen, nicht nur in der App:

| Regel | Umsetzung |
|---|---|
| Mandantentrennung | RLS auf allen Tabellen über `betrieb_mitglied` |
| Unterschrift nur durch Mitarbeitende | Spalten nicht beschreibbar (spaltengenaue GRANTs); nur `teilnahme_unterschreiben()` |
| Unterschrift erst nach Durchführung | Statusprüfung in der RPC; Vorab-Link zeigt nur Inhalte |
| Unveränderbarkeit | Trigger: unterschriebene Teilnahmen, abgeschlossene Unterweisungen, `nachweis`, `audit_log` |
| Eingefrorener Inhalt | `thema_snapshot` beim Statuswechsel auf „durchgeführt“ |
| Nachweis-Integrität | `unterweisung_abschliessen()` prüft `sha256(inhalt_kanonisch) = inhalt_sha256` und die Anzahl der Unterschriften, atomar |
| Links | 256-Bit-Token, in der DB nur SHA-256, 14 Tage gültig, nach Abschluss entwertet; `Referrer-Policy: no-referrer` |
| Storage | privater Bucket, Upload nur in eigenen Betrieb/zu durchgeführter Unterweisung, kein Update/Delete |
| Audit | Trigger protokollieren Aktion + geänderte Spaltennamen (keine Werte) |

**Zwei Hashes:** Eine Datei kann ihren eigenen Hash nicht enthalten. Im PDF steht daher der SHA-256 des
festgeschriebenen Datensatzes (`inhalt_kanonisch`, in der DB gespeichert und nachrechenbar). Der SHA-256 der
PDF-Datei selbst steht in der DB und in der Archivansicht.

**Gespeichert bei der Unterschrift:** eingegebener Name, Server-Zeitstempel, User Agent, Wortlaut der
bestätigten Aussage, ggf. Übungsbestätigung. Keine IP-Adresse.

## Lokal starten

Voraussetzungen: Node 20+, [Supabase CLI](https://supabase.com/docs/guides/cli) mit Docker.

```bash
npm install
supabase start            # spielt migrations/ + seed.sql ein
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY aus `supabase status` eintragen
npm run dev
```

Demo-Zugang: **inhaber@demo.local / demo1234**

Demo-Links:
- http://localhost:3000/u/demo-offen-cccccccccccccccccccccccc (Unterschrift möglich)
- http://localhost:3000/u/demo-vorab-dddddddddddddddddddddddd (geplant, nur Vorab-Lesen)

Die Seed-Daten enthalten einen Demo-Betrieb, 5 fiktive Mitarbeitende, alle 6 Platzhalter-Themen, eine gestern
durchgeführte Unterweisung (2 von 3 unterschrieben) und eine geplante.

## Tests

```bash
npm test             # Unit-Tests: Fälligkeit, Hash/Kanonisierung, PDF (deterministisch, mehrseitig)
npm run db:test      # SQL-Tests gegen lokales Postgres (ohne Docker): RLS, Rechte, Trigger, RPCs, Löschlauf
npm run typecheck
bash e2e/run.sh      # kompletter Browser-Ablauf (Postgres + GoTrue + PostgREST + Storage-Nachbau)
```

## Produktion (EU)

1. Supabase-Projekt in **eu-central-1 (Frankfurt)** anlegen, AV-Vertrag abschließen.
2. Migrationen einspielen: `supabase link --project-ref … && supabase db push` (**ohne** `seed.sql`).
3. Auth: E-Mail-Bestätigung aktivieren, Site-URL und Redirect `https://<domain>/auth/callback` eintragen.
4. Hosting z. B. Vercel mit Funktionsregion `fra1`; Umgebungsvariablen aus `.env.example` setzen.
5. Wartung einrichten: `tokens_bereinigen()` täglich (pg_cron), `scripts/loeschlauf.mjs` monatlich
   (siehe [docs/loeschkonzept.md](docs/loeschkonzept.md)).
6. Impressum/Datenschutzerklärung des Betreibers ergänzen.

## Offene Punkte

Siehe [docs/offene-punkte.md](docs/offene-punkte.md). Die wichtigsten: Themeninhalte durch eine Fachkraft,
Aufbewahrungsfrist festlegen, rechtliche Einordnung der elektronischen Bestätigung, Einladung weiterer
Unterweisender, Einstellungsseite.
