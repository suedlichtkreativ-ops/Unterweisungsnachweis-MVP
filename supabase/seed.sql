-- Demo-Daten für die lokale Entwicklung (supabase db reset).
-- NICHT in Produktion einspielen.
--
-- Login:  inhaber@demo.local / demo1234
-- Links:  /u/demo-offen-cccccccccccccccccccccccc   (Unterschrift möglich)
--         /u/demo-vorab-dddddddddddddddddddddddd   (geplant – nur Vorab-Lesen)

-- Demo-Nutzer (Inhaber)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'inhaber@demo.local',
  extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
  jsonb_build_object('sub', '11111111-1111-4111-8111-111111111111', 'email', 'inhaber@demo.local', 'email_verified', true),
  'email', now(), now(), now());

-- Betrieb
insert into public.betrieb (id, name, anschrift)
values ('22222222-2222-4222-8222-222222222222', 'Demo Bedachungen GmbH', 'Musterstraße 1, 12345 Musterstadt');

insert into public.betrieb_mitglied (betrieb_id, user_id, rolle, anzeigename)
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'inhaber', 'Max Mustermann');

-- Mitarbeiter (fiktiv)
insert into public.mitarbeiter (id, betrieb_id, vorname, nachname, taetigkeit, eintritt, jugendlich) values
  ('33333333-3333-4333-8333-000000000001', '22222222-2222-4222-8222-222222222222', 'Anna',  'Becker',   'Dachdeckerin',   '2019-03-01', false),
  ('33333333-3333-4333-8333-000000000002', '22222222-2222-4222-8222-222222222222', 'Ben',   'Schulz',   'Dachdecker',     '2021-08-01', false),
  ('33333333-3333-4333-8333-000000000003', '22222222-2222-4222-8222-222222222222', 'Can',   'Yilmaz',   'Vorarbeiter',    '2015-04-15', false),
  ('33333333-3333-4333-8333-000000000004', '22222222-2222-4222-8222-222222222222', 'Dana',  'Wolf',     'Auszubildende',  '2026-08-01', true),
  ('33333333-3333-4333-8333-000000000005', '22222222-2222-4222-8222-222222222222', 'Emil',  'Hoffmann', 'Helfer',         '2024-02-01', false);

-- Alle 6 Bibliotheksthemen in den Betrieb übernehmen (Status bleibt "nicht geprüft")
insert into public.thema (id, betrieb_id, vorlage_id, titel, kurzbeschreibung, inhalt, intervall_monate, erfordert_uebung)
select ('44444444-4444-4444-8444-00000000000' || right(v.id::text, 1))::uuid,
       '22222222-2222-4222-8222-222222222222', v.id, v.titel, v.kurzbeschreibung, v.inhalt,
       v.intervall_monate, v.erfordert_uebung
  from public.thema v where v.betrieb_id is null;

-- Unterweisung 1: gestern durchgeführt (Absturzsicherung), 2 von 3 unterschrieben
insert into public.unterweisung (id, betrieb_id, thema_id, datum, ort, unterweisender_name,
  unterweisender_user_id, uebung_beschreibung, erstellt_von)
values ('55555555-5555-4555-8555-000000000001', '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-000000000001', current_date - 1, 'Lager / Werkhof', 'Max Mustermann',
  '11111111-1111-4111-8111-111111111111', 'Demo-Eintrag: Übung am Übungsdach (Platzhalter)',
  '11111111-1111-4111-8111-111111111111');

insert into public.teilnahme (betrieb_id, unterweisung_id, mitarbeiter_id, token_hash, token_laeuft_ab) values
  ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-000000000001', '33333333-3333-4333-8333-000000000001',
   public.hash_hex('demo-anna-aaaaaaaaaaaaaaaaaaaaaaaaaaaa'), now() + interval '14 days'),
  ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-000000000001', '33333333-3333-4333-8333-000000000002',
   public.hash_hex('demo-ben-bbbbbbbbbbbbbbbbbbbbbbbbbbbbb'), now() + interval '14 days'),
  ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-000000000001', '33333333-3333-4333-8333-000000000003',
   public.hash_hex('demo-offen-cccccccccccccccccccccccc'), now() + interval '14 days');

update public.unterweisung set status = 'durchgefuehrt' where id = '55555555-5555-4555-8555-000000000001';

select public.teilnahme_unterschreiben('demo-anna-aaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'Anna Becker', 'Seed', true);
select public.teilnahme_unterschreiben('demo-ben-bbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'Ben Schulz', 'Seed', true);

-- Unterweisung 2: in einer Woche geplant (Leitern), Link zum Vorab-Lesen
insert into public.unterweisung (id, betrieb_id, thema_id, datum, ort, unterweisender_name,
  unterweisender_user_id, erstellt_von)
values ('55555555-5555-4555-8555-000000000002', '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-000000000002', current_date + 7, 'Baustelle Musterweg', 'Max Mustermann',
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111');

insert into public.teilnahme (betrieb_id, unterweisung_id, mitarbeiter_id, token_hash, token_laeuft_ab) values
  ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-000000000002', '33333333-3333-4333-8333-000000000004',
   public.hash_hex('demo-vorab-dddddddddddddddddddddddd'), now() + interval '14 days'),
  ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-000000000002', '33333333-3333-4333-8333-000000000005',
   public.hash_hex('demo-vorab-eeeeeeeeeeeeeeeeeeeeeeeeeeee'), now() + interval '14 days');
