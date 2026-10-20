-- Prüft die in der Datenbank erzwungenen Regeln. Läuft nach Migrationen + Seed.
-- Jede Prüfung bricht bei Abweichung mit einer Exception ab (ON_ERROR_STOP).

create function pg_temp.erwarte_fehler(befehl text, muster text) returns void
language plpgsql as $$
begin
  begin
    execute befehl;
  exception when others then
    if sqlerrm !~* muster then
      raise exception 'Falscher Fehler für «%»: % (erwartet: %)', befehl, sqlerrm, muster;
    end if;
    return;
  end;
  raise exception 'Erwarteter Fehler blieb aus: %', befehl;
end $$;

create function pg_temp.pruefe(bedingung boolean, text text) returns void
language plpgsql as $$
begin
  if bedingung is not true then
    raise exception 'Prüfung fehlgeschlagen: %', text;
  end if;
end $$;

create function pg_temp.als(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;

-- Zweiter Nutzer / Betrieb
insert into auth.users (id, email) values ('99999999-9999-4999-8999-999999999999', 'fremd@demo.local');

-- ---------------------------------------------------------------------------
\echo '  · Betrieb anlegen per RPC, Doppelanlage verhindert'
set role authenticated;
select pg_temp.als('99999999-9999-4999-8999-999999999999');
select public.betrieb_anlegen('Fremdbetrieb', '', 'Fritz Fremd');
select pg_temp.erwarte_fehler($$select public.betrieb_anlegen('Noch einer', '', 'Fritz')$$, 'bereits');

\echo '  · Mandantentrennung (RLS)'
select pg_temp.pruefe((select count(*) from public.mitarbeiter) = 0, 'Fremder sieht keine Mitarbeiter');
select pg_temp.pruefe((select count(*) from public.unterweisung) = 0, 'Fremder sieht keine Unterweisungen');
select pg_temp.pruefe((select count(*) from public.teilnahme) = 0, 'Fremder sieht keine Teilnahmen');
select pg_temp.pruefe((select count(*) from public.audit_log where betrieb_id = '22222222-2222-4222-8222-222222222222') = 0,
                      'Fremder sieht kein fremdes Audit-Log');
select pg_temp.pruefe((select count(*) from public.thema where betrieb_id is null) = 6, 'Bibliothek (6 Themen) sichtbar');
select pg_temp.erwarte_fehler($$insert into public.mitarbeiter (betrieb_id, vorname, nachname)
  values ('22222222-2222-4222-8222-222222222222', 'Eve', 'Einbruch')$$, 'row-level security');
update public.mitarbeiter set nachname = 'X' where betrieb_id = '22222222-2222-4222-8222-222222222222';
select pg_temp.erwarte_fehler($$select public.unterweisung_abschliessen('55555555-5555-4555-8555-000000000001',
  'x', repeat('a',64), repeat('a',64), '{}', 2)$$, 'nicht gefunden');
update public.thema set titel = 'Gehackt' where betrieb_id is null;
reset role;
select pg_temp.pruefe((select count(*) from public.mitarbeiter where nachname = 'X') = 0, 'Fremdes Update ohne Wirkung');
select pg_temp.pruefe((select count(*) from public.thema where titel = 'Gehackt') = 0, 'Bibliothek unverändert');

-- ---------------------------------------------------------------------------
\echo '  · Spaltenrechte: Unterschrift/Nachweis/Prüfstatus nicht direkt schreibbar'
set role authenticated;
select pg_temp.als('11111111-1111-4111-8111-111111111111');
select pg_temp.erwarte_fehler($$update public.teilnahme set unterschrift_name = 'Fake', unterschrieben_am = now(), aussage = 'x'$$, 'permission denied');
select pg_temp.erwarte_fehler($$insert into public.nachweis (betrieb_id, unterweisung_id, storage_pfad, pdf_sha256, inhalt_sha256, inhalt_kanonisch)
  values ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-000000000002', 'x', repeat('a',64), repeat('a',64), '{}')$$, 'permission denied');
select pg_temp.erwarte_fehler($$insert into public.thema (betrieb_id, titel, pruefstatus, geprueft_von, geprueft_am)
  values ('22222222-2222-4222-8222-222222222222', 'Test', 'geprueft', 'X', current_date)$$, 'permission denied');
select pg_temp.erwarte_fehler($$insert into public.betrieb_mitglied (betrieb_id, user_id, rolle, anzeigename)
  values ('22222222-2222-4222-8222-222222222222', '99999999-9999-4999-8999-999999999999', 'inhaber', 'Fritz')$$, 'permission denied');
select pg_temp.erwarte_fehler($$select public.loeschlauf_ausfuehren()$$, 'permission denied');
select pg_temp.erwarte_fehler($$select public.tokens_bereinigen()$$, 'permission denied');

\echo '  · Unterschriebene Teilnahme unveränderbar (auch mit gesetztem Löschlauf-Flag)'
select set_config('app.loeschlauf', 'on', false);
select pg_temp.erwarte_fehler($$update public.teilnahme set token_laeuft_ab = now() + interval '99 days'
  where mitarbeiter_id = '33333333-3333-4333-8333-000000000001'$$, 'unveränderbar');
select pg_temp.erwarte_fehler($$delete from public.teilnahme
  where mitarbeiter_id = '33333333-3333-4333-8333-000000000001'$$, 'unveränderbar');
select set_config('app.loeschlauf', '', false);

\echo '  · Durchgeführte Unterweisung eingefroren, Statusmaschine'
select pg_temp.erwarte_fehler($$update public.unterweisung set datum = current_date - 30
  where id = '55555555-5555-4555-8555-000000000001'$$, 'eingefroren');
select pg_temp.erwarte_fehler($$update public.unterweisung set status = 'abgeschlossen'
  where id = '55555555-5555-4555-8555-000000000001'$$, 'unterweisung_abschliessen');
select pg_temp.erwarte_fehler($$update public.unterweisung set status = 'durchgefuehrt'
  where id = '55555555-5555-4555-8555-000000000002'$$, 'Zukunft');
select pg_temp.erwarte_fehler($$delete from public.unterweisung
  where id = '55555555-5555-4555-8555-000000000001'$$, 'Nur geplante');
update public.unterweisung set bemerkung = 'Bemerkung erlaubt' where id = '55555555-5555-4555-8555-000000000001';
select pg_temp.pruefe((select thema_snapshot ->> 'titel' from public.unterweisung
  where id = '55555555-5555-4555-8555-000000000001') = 'Absturzsicherung / PSA gegen Absturz', 'Snapshot vorhanden');

\echo '  · Thema: Inhaltsänderung setzt Prüfstatus zurück'
update public.thema set pruefstatus = 'geprueft', geprueft_von = 'Fachkraft Muster', geprueft_am = current_date
  where id = '44444444-4444-4444-8444-000000000006';
select pg_temp.pruefe((select pruefstatus = 'geprueft' from public.thema where id = '44444444-4444-4444-8444-000000000006'), 'geprüft gesetzt');
update public.thema set inhalt = inhalt || ' geändert' where id = '44444444-4444-4444-8444-000000000006';
select pg_temp.pruefe((select pruefstatus = 'nicht_geprueft' and geprueft_von is null
  from public.thema where id = '44444444-4444-4444-8444-000000000006'), 'Prüfstatus zurückgesetzt');
select pg_temp.erwarte_fehler($$update public.thema set pruefstatus = 'geprueft'
  where id = '44444444-4444-4444-8444-000000000005'$$, 'pruefung_vollstaendig');
reset role;

-- ---------------------------------------------------------------------------
\echo '  · Öffentliche Unterschrift per Token (anon)'
set role anon;
select pg_temp.erwarte_fehler($$select * from public.mitarbeiter$$, 'permission denied');
select pg_temp.erwarte_fehler($$select * from public.teilnahme$$, 'permission denied');
select pg_temp.pruefe(public.teilnahme_info('gibt-es-nicht-000000000000000') is null, 'Unbekannter Token -> null');
select pg_temp.pruefe((public.teilnahme_info('demo-vorab-dddddddddddddddddddddddd') ->> 'status') = 'geplant', 'Vorab-Info lesbar');
select pg_temp.erwarte_fehler($$select public.teilnahme_unterschreiben('demo-vorab-dddddddddddddddddddddddd', 'Dana Wolf', 'test', false)$$,
  'erst nach der Durchführung');
select pg_temp.pruefe((public.teilnahme_info('demo-offen-cccccccccccccccccccccccc') ->> 'aussage') like 'Ich bestätige, dass ich am %praktischen Übung%', 'Aussage-Vorschau mit Übung');
select pg_temp.erwarte_fehler($$select public.teilnahme_unterschreiben('demo-offen-cccccccccccccccccccccccc', 'Can Yilmaz', 'test', false)$$,
  'praktischen Übung');
select pg_temp.erwarte_fehler($$select public.teilnahme_unterschreiben('demo-offen-cccccccccccccccccccccccc', ' ', 'test', true)$$,
  'Namen');
select public.teilnahme_unterschreiben('demo-offen-cccccccccccccccccccccccc', '  Can   Yilmaz ', 'Mozilla/5.0 Test', true);
select pg_temp.erwarte_fehler($$select public.teilnahme_unterschreiben('demo-offen-cccccccccccccccccccccccc', 'Can Yilmaz', 'test', true)$$,
  'Bereits');
reset role;
select pg_temp.pruefe((select unterschrift_name = 'Can Yilmaz' and user_agent = 'Mozilla/5.0 Test' and uebung_bestaetigt
  from public.teilnahme where mitarbeiter_id = '33333333-3333-4333-8333-000000000003'), 'Unterschrift gespeichert');

-- Abgelaufener Token
update public.teilnahme set token_laeuft_ab = now() - interval '1 minute'
  where mitarbeiter_id = '33333333-3333-4333-8333-000000000005';
set role anon;
select pg_temp.pruefe(public.teilnahme_info('demo-vorab-eeeeeeeeeeeeeeeeeeeeeeeeeeee') is null, 'Abgelaufener Token -> null');
reset role;

-- ---------------------------------------------------------------------------
\echo '  · Abschluss mit Nachweis'
set role authenticated;
select pg_temp.als('11111111-1111-4111-8111-111111111111');
select pg_temp.erwarte_fehler($$select public.unterweisung_abschliessen('55555555-5555-4555-8555-000000000001',
  '22222222-2222-4222-8222-222222222222/55555555-5555-4555-8555-000000000001/a.pdf',
  repeat('a',64), public.hash_hex('{"unterweisung_id":"55555555-5555-4555-8555-000000000001"}'),
  '{"unterweisung_id":"55555555-5555-4555-8555-000000000001"}', 2)$$, 'zwischenzeitlich');
select pg_temp.erwarte_fehler($$select public.unterweisung_abschliessen('55555555-5555-4555-8555-000000000001',
  '22222222-2222-4222-8222-222222222222/55555555-5555-4555-8555-000000000001/a.pdf',
  repeat('a',64), repeat('b',64), '{"unterweisung_id":"55555555-5555-4555-8555-000000000001"}', 3)$$, 'Hash');
select pg_temp.erwarte_fehler($$select public.unterweisung_abschliessen('55555555-5555-4555-8555-000000000001',
  '99999999/55555555-5555-4555-8555-000000000001/a.pdf',
  repeat('a',64), public.hash_hex('{"unterweisung_id":"55555555-5555-4555-8555-000000000001"}'),
  '{"unterweisung_id":"55555555-5555-4555-8555-000000000001"}', 3)$$, 'Ablagepfad');
select public.unterweisung_abschliessen('55555555-5555-4555-8555-000000000001',
  '22222222-2222-4222-8222-222222222222/55555555-5555-4555-8555-000000000001/a.pdf',
  repeat('a',64), public.hash_hex('{"unterweisung_id":"55555555-5555-4555-8555-000000000001"}'),
  '{"unterweisung_id":"55555555-5555-4555-8555-000000000001"}', 3);
select pg_temp.pruefe((select status = 'abgeschlossen' and abgeschlossen_am is not null from public.unterweisung
  where id = '55555555-5555-4555-8555-000000000001'), 'Status abgeschlossen');
select pg_temp.pruefe((select count(*) from public.teilnahme where unterweisung_id = '55555555-5555-4555-8555-000000000001'
  and token_hash is not null) = 0, 'Tokens nach Abschluss entfernt');
select pg_temp.erwarte_fehler($$update public.unterweisung set bemerkung = 'Nachträglich'
  where id = '55555555-5555-4555-8555-000000000001'$$, 'Nachtrag');
select pg_temp.erwarte_fehler($$insert into public.teilnahme (betrieb_id, unterweisung_id, mitarbeiter_id)
  values ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-000000000001', '33333333-3333-4333-8333-000000000005')$$,
  'abgeschlossenen');
-- Nachtrag zu abgeschlossener Unterweisung ist möglich
insert into public.unterweisung (betrieb_id, thema_id, datum, unterweisender_name, nachtrag_zu, bemerkung)
values ('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-000000000001', current_date,
        'Max Mustermann', '55555555-5555-4555-8555-000000000001', 'Nachtrag Test');
reset role;

\echo '  · Nachweis und Audit-Log append-only (auch für postgres ohne Löschlauf)'
select pg_temp.erwarte_fehler($$update public.nachweis set pdf_sha256 = repeat('c',64)$$, 'append-only');
select pg_temp.erwarte_fehler($$delete from public.nachweis$$, 'append-only');
select pg_temp.erwarte_fehler($$delete from public.audit_log$$, 'append-only');
select pg_temp.erwarte_fehler($$update public.audit_log set aktion = 'x'$$, 'append-only');
select pg_temp.pruefe((select count(*) from public.audit_log where tabelle = 'nachweis') = 1, 'Audit für Nachweis');
select pg_temp.pruefe((select count(*) from public.audit_log where details ->> 'status' = 'abgeschlossen') = 1, 'Audit für Statuswechsel');

-- ---------------------------------------------------------------------------
\echo '  · Storage-Policies'
insert into storage.buckets (id) values ('fremd') on conflict do nothing;
set role authenticated;
select pg_temp.als('11111111-1111-4111-8111-111111111111');
select pg_temp.erwarte_fehler($$insert into storage.objects (bucket_id, name)
  values ('nachweise', '22222222-2222-4222-8222-222222222222/55555555-5555-4555-8555-000000000001/neu.pdf')$$, 'row-level security');
select pg_temp.als('99999999-9999-4999-8999-999999999999');
select pg_temp.erwarte_fehler($$insert into storage.objects (bucket_id, name)
  values ('nachweise', '22222222-2222-4222-8222-222222222222/55555555-5555-4555-8555-000000000001/x.pdf')$$, 'row-level security');
reset role;

-- ---------------------------------------------------------------------------
\echo '  · Löschlauf nach Aufbewahrungsfrist'
update public.betrieb set aufbewahrung_jahre = 2 where id = '22222222-2222-4222-8222-222222222222';
begin;
  set local app.loeschlauf = 'on';
  update public.unterweisung set datum = current_date - interval '3 years'
   where id in ('55555555-5555-4555-8555-000000000001');
  update public.unterweisung set datum = current_date - interval '3 years'
   where nachtrag_zu = '55555555-5555-4555-8555-000000000001';
  update public.mitarbeiter set aktiv = false where id = '33333333-3333-4333-8333-000000000001';
commit;
-- Nachtrag ist nicht abgeschlossen -> wird nicht gelöscht, blockiert aber nicht (älter als Frist)
delete from public.unterweisung where nachtrag_zu is not null;
select pg_temp.pruefe((select array_agg(storage_pfad) from public.loeschlauf_ausfuehren())
  = array['22222222-2222-4222-8222-222222222222/55555555-5555-4555-8555-000000000001/a.pdf'], 'Pfad zurückgegeben');
select pg_temp.pruefe(not exists (select 1 from public.unterweisung where id = '55555555-5555-4555-8555-000000000001'), 'Unterweisung gelöscht');
select pg_temp.pruefe(not exists (select 1 from public.nachweis), 'Nachweis gelöscht');
select pg_temp.pruefe(not exists (select 1 from public.mitarbeiter where id = '33333333-3333-4333-8333-000000000001'), 'Inaktive Mitarbeiterin gelöscht');
select pg_temp.pruefe(exists (select 1 from public.mitarbeiter where id = '33333333-3333-4333-8333-000000000002'), 'Aktiver Mitarbeiter bleibt');
select pg_temp.pruefe(exists (select 1 from public.audit_log where aktion = 'loeschlauf'), 'Löschlauf protokolliert');
-- Nach dem Löschlauf greift die Sperre wieder
select pg_temp.erwarte_fehler($$delete from public.audit_log$$, 'append-only');
