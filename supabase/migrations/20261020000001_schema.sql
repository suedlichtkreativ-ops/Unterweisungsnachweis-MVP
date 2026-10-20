-- Unterweisungsnachweis – Grundschema
-- Alle Tabellen sind mandantenfähig über betrieb_id. Zugriff ausschließlich über RLS
-- (siehe 20261020000002_sicherheit.sql).

create extension if not exists pgcrypto with schema extensions;

create type public.rolle as enum ('inhaber', 'unterweisender');
create type public.pruefstatus as enum ('nicht_geprueft', 'geprueft');
create type public.unterweisung_status as enum ('geplant', 'durchgefuehrt', 'abgeschlossen');

-- ---------------------------------------------------------------------------
-- Betrieb (Mandant)
-- ---------------------------------------------------------------------------
create table public.betrieb (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) between 2 and 200),
  anschrift           text check (length(anschrift) <= 500),
  -- Aufbewahrungsfrist der Nachweise in Jahren. NULL = noch nicht festgelegt
  -- (dann wird nichts automatisch gelöscht). Siehe docs/loeschkonzept.md.
  aufbewahrung_jahre  int check (aufbewahrung_jahre between 1 and 30),
  erstellt_am         timestamptz not null default now()
);

create table public.betrieb_mitglied (
  betrieb_id   uuid not null references public.betrieb(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  rolle        public.rolle not null,
  anzeigename  text not null check (length(trim(anzeigename)) between 2 and 120),
  erstellt_am  timestamptz not null default now(),
  primary key (betrieb_id, user_id)
);
create index on public.betrieb_mitglied (user_id);

-- ---------------------------------------------------------------------------
-- Mitarbeiter – bewusst datensparsam: keine Anschrift, kein Geburtsdatum,
-- keine Kontaktdaten. "jugendlich" steuert das verkürzte Intervall.
-- ---------------------------------------------------------------------------
create table public.mitarbeiter (
  id               uuid primary key default gen_random_uuid(),
  betrieb_id       uuid not null references public.betrieb(id) on delete cascade,
  vorname          text not null check (length(trim(vorname)) between 1 and 100),
  nachname         text not null check (length(trim(nachname)) between 1 and 100),
  taetigkeit       text check (length(taetigkeit) <= 120),
  eintritt         date,
  jugendlich       boolean not null default false,
  aktiv            boolean not null default true,
  erstellt_am      timestamptz not null default now()
);
create index on public.mitarbeiter (betrieb_id);

-- ---------------------------------------------------------------------------
-- Thema. betrieb_id IS NULL = Bibliotheksvorlage (für alle lesbar, nicht änderbar).
-- ---------------------------------------------------------------------------
create table public.thema (
  id                uuid primary key default gen_random_uuid(),
  betrieb_id        uuid references public.betrieb(id) on delete cascade,
  vorlage_id        uuid references public.thema(id) on delete set null,
  titel             text not null check (length(trim(titel)) between 2 and 200),
  kurzbeschreibung  text check (length(kurzbeschreibung) <= 500),
  inhalt            text not null default '' check (length(inhalt) <= 50000),
  intervall_monate  int not null default 12 check (intervall_monate between 1 and 60),
  erfordert_uebung  boolean not null default false,
  pruefstatus       public.pruefstatus not null default 'nicht_geprueft',
  geprueft_von      text check (length(geprueft_von) <= 200),
  geprueft_am       date,
  aktiv             boolean not null default true,
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint pruefung_vollstaendig check (
    pruefstatus = 'nicht_geprueft' or (geprueft_von is not null and geprueft_am is not null)
  )
);
create index on public.thema (betrieb_id);

-- ---------------------------------------------------------------------------
-- Unterweisung
--   geplant       -> Links können verschickt werden, Inhalte vorab lesbar,
--                    Unterschrift noch NICHT möglich
--   durchgefuehrt -> persönliche Unterweisung hat stattgefunden, Inhalt des
--                    Themas ist eingefroren (thema_snapshot), Unterschrift möglich
--   abgeschlossen -> Nachweis-PDF erzeugt, alles unveränderbar
-- ---------------------------------------------------------------------------
create table public.unterweisung (
  id                      uuid primary key default gen_random_uuid(),
  betrieb_id              uuid not null references public.betrieb(id) on delete cascade,
  thema_id                uuid not null references public.thema(id),
  datum                   date not null,
  ort                     text check (length(ort) <= 200),
  unterweisender_name     text not null check (length(trim(unterweisender_name)) between 2 and 200),
  unterweisender_user_id  uuid references auth.users(id) on delete set null,
  bemerkung               text check (length(bemerkung) <= 2000),
  uebung_beschreibung     text check (length(uebung_beschreibung) <= 2000),
  status                  public.unterweisung_status not null default 'geplant',
  thema_snapshot          jsonb,
  durchgefuehrt_am        timestamptz,
  abgeschlossen_am        timestamptz,
  nachtrag_zu             uuid references public.unterweisung(id),
  erstellt_von            uuid references auth.users(id) on delete set null,
  erstellt_am             timestamptz not null default now()
);
create index on public.unterweisung (betrieb_id, datum desc);

-- ---------------------------------------------------------------------------
-- Teilnahme / Unterschrift
-- token_hash: SHA-256 (hex) des Zufallstokens. Der Token selbst wird nie gespeichert.
-- ---------------------------------------------------------------------------
create table public.teilnahme (
  id                 uuid primary key default gen_random_uuid(),
  betrieb_id         uuid not null references public.betrieb(id) on delete cascade,
  unterweisung_id    uuid not null references public.unterweisung(id) on delete cascade,
  mitarbeiter_id     uuid not null references public.mitarbeiter(id),
  token_hash         text unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_laeuft_ab    timestamptz,
  unterschrift_name  text check (length(trim(unterschrift_name)) between 2 and 200),
  aussage            text,
  unterschrieben_am  timestamptz,
  user_agent         text check (length(user_agent) <= 500),
  uebung_bestaetigt  boolean,
  test_ergebnis      text check (length(test_ergebnis) <= 200),  -- im MVP ungenutzt
  erstellt_am        timestamptz not null default now(),
  unique (unterweisung_id, mitarbeiter_id),
  constraint unterschrift_vollstaendig check (
    (unterschrieben_am is null and unterschrift_name is null and aussage is null)
    or (unterschrieben_am is not null and unterschrift_name is not null and aussage is not null)
  )
);
create index on public.teilnahme (betrieb_id);
create index on public.teilnahme (mitarbeiter_id);

-- ---------------------------------------------------------------------------
-- Nachweis (PDF-Protokoll) – append-only
-- inhalt_kanonisch: exakt der Text, über den inhalt_sha256 gebildet wurde.
-- ---------------------------------------------------------------------------
create table public.nachweis (
  id                uuid primary key default gen_random_uuid(),
  betrieb_id        uuid not null references public.betrieb(id) on delete cascade,
  unterweisung_id   uuid not null unique references public.unterweisung(id),
  storage_pfad      text not null unique,
  pdf_sha256        text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  inhalt_sha256     text not null check (inhalt_sha256 ~ '^[0-9a-f]{64}$'),
  inhalt_kanonisch  text not null,
  erzeugt_am        timestamptz not null default now(),
  erzeugt_von       uuid references auth.users(id) on delete set null
);
create index on public.nachweis (betrieb_id, erzeugt_am desc);
create index on public.nachweis (pdf_sha256);

-- ---------------------------------------------------------------------------
-- Audit-Log – append-only, wird ausschließlich von Triggern befüllt
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  betrieb_id  uuid references public.betrieb(id) on delete cascade,
  user_id     uuid,
  aktion      text not null,
  tabelle     text not null,
  objekt_id   uuid,
  details     jsonb,
  zeitpunkt   timestamptz not null default now()
);
create index on public.audit_log (betrieb_id, zeitpunkt desc);
