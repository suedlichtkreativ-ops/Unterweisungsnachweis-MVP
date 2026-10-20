# End-to-End-Test (ohne Docker)

`bash e2e/run.sh` startet eine Supabase-nahe Umgebung und spielt den kompletten Ablauf im Browser durch:

- **Postgres** (lokale Binaries, temporäres Datenverzeichnis)
- **GoTrue** = Supabase Auth (Original-Binary, migriert `auth` selbst)
- **PostgREST** (Original-Binary)
- **Storage-Nachbau** (`gateway.mjs`): speichert Dateien lokal, prüft Upload/Download aber echt gegen
  `storage.objects` **mit RLS als anfragender Nutzer** – die Policies aus `20261020000004_storage.sql` greifen also.

Danach: alle Migrationen + `seed.sql`, `next build`, `next start` und `ablauf.mjs` (Playwright):
Login, Vorab-Link, Unterschrift, Abschluss, PDF-Hash, Archivprüfung (inkl. Manipulation), ZIP-Export mit
`sha256sum -c`, Registrierung eines zweiten Betriebs, Thema prüfen, Mitarbeitende, Planung, Links,
Durchführung, Unterschriften, Abschluss, Nachtrag und Mandantentrennung.

Screenshots und PDFs landen in `e2e/.tmp/out/`. Chromium: `CHROMIUM=/pfad/zu/chrome bash e2e/run.sh`
oder `npx playwright install chromium` in `e2e/`.

Abweichungen zu echtem Supabase: Storage-API ist nachgebaut, kein Kong-Gateway, kein Realtime.
