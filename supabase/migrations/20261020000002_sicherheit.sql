-- Unterweisungsnachweis – Rechte, RLS, Unveränderbarkeit, RPC-Funktionen
--
-- Prinzip: Die Datenbank erzwingt die Regeln selbst. Die App kann sie nicht umgehen.
--   * Spaltengenaue GRANTs: Clients dürfen nur Felder schreiben, die sie schreiben sollen.
--   * RLS: Jeder sieht nur Daten seines Betriebs.
--   * Trigger: Unterschriebene Teilnahmen, abgeschlossene Unterweisungen, Nachweise
--     und das Audit-Log sind unveränderbar.
--   * Unterschrift und Abschluss laufen ausschließlich über SECURITY-DEFINER-Funktionen.

-- ===========================================================================
-- Hilfsfunktionen
-- ===========================================================================
create function public.ist_mitglied(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.betrieb_mitglied m
    where m.betrieb_id = b and m.user_id = (select auth.uid())
  );
$$;

create function public.ist_inhaber(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.betrieb_mitglied m
    where m.betrieb_id = b and m.user_id = (select auth.uid()) and m.rolle = 'inhaber'
  );
$$;

-- Wahr nur innerhalb des Löschlaufs (loeschlauf_ausfuehren), der als Owner läuft.
-- Clients (anon/authenticated) können die Einstellung über die API nicht setzen,
-- und selbst wenn: current_user wäre dann anon/authenticated.
create function public.loeschlauf_aktiv() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('app.loeschlauf', true), '') = 'on'
     and current_user not in ('anon', 'authenticated');
$$;

-- Wortlaut der Bestätigung. Einzige Quelle – UI und Speicherung nutzen dieselbe Funktion.
create function public.aussage_text(p_datum date, p_unterweisender text, p_thema text, p_uebung boolean)
returns text language sql stable set search_path = '' as $$
  select 'Ich bestätige, dass ich am ' || to_char(p_datum, 'DD.MM.YYYY')
      || ' von ' || p_unterweisender
      || ' persönlich zum Thema „' || p_thema || '“ unterwiesen wurde,'
      || ' die Inhalte verstanden habe und Gelegenheit hatte, Fragen zu stellen.'
      || case when p_uebung then ' Ich habe an der praktischen Übung teilgenommen.' else '' end;
$$;

create function public.hash_hex(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(pg_catalog.sha256(convert_to(p, 'UTF8')), 'hex');
$$;

-- ===========================================================================
-- Rechte: erst alles entziehen, dann gezielt (spaltengenau) vergeben
-- ===========================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.betrieb, public.betrieb_mitglied, public.mitarbeiter, public.thema,
  public.unterweisung, public.teilnahme, public.nachweis, public.audit_log to authenticated;

grant update (name, anschrift, aufbewahrung_jahre) on public.betrieb to authenticated;

grant insert (betrieb_id, vorname, nachname, taetigkeit, eintritt, jugendlich, aktiv),
      update (vorname, nachname, taetigkeit, eintritt, jugendlich, aktiv),
      delete
  on public.mitarbeiter to authenticated;

-- pruefstatus ist bei INSERT nicht freigegeben: neue Themen/Kopien sind immer "nicht geprüft".
grant insert (betrieb_id, vorlage_id, titel, kurzbeschreibung, inhalt, intervall_monate, erfordert_uebung, aktiv),
      update (titel, kurzbeschreibung, inhalt, intervall_monate, erfordert_uebung, aktiv,
              pruefstatus, geprueft_von, geprueft_am),
      delete
  on public.thema to authenticated;

grant insert (betrieb_id, thema_id, datum, ort, unterweisender_name, unterweisender_user_id,
              bemerkung, uebung_beschreibung, nachtrag_zu),
      update (datum, ort, unterweisender_name, bemerkung, uebung_beschreibung, status),
      delete
  on public.unterweisung to authenticated;

-- Unterschriftsfelder sind NICHT freigegeben – nur über teilnahme_unterschreiben().
grant insert (betrieb_id, unterweisung_id, mitarbeiter_id, token_hash, token_laeuft_ab),
      update (token_hash, token_laeuft_ab),
      delete
  on public.teilnahme to authenticated;

-- nachweis, audit_log, betrieb_mitglied: nur lesen. Schreiben nur über Funktionen/Trigger.

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.betrieb          enable row level security;
alter table public.betrieb_mitglied enable row level security;
alter table public.mitarbeiter      enable row level security;
alter table public.thema            enable row level security;
alter table public.unterweisung     enable row level security;
alter table public.teilnahme        enable row level security;
alter table public.nachweis         enable row level security;
alter table public.audit_log        enable row level security;

create policy betrieb_lesen   on public.betrieb for select to authenticated using (public.ist_mitglied(id));
create policy betrieb_aendern on public.betrieb for update to authenticated
  using (public.ist_inhaber(id)) with check (public.ist_inhaber(id));

create policy mitglied_lesen on public.betrieb_mitglied for select to authenticated
  using (public.ist_mitglied(betrieb_id));

create policy mitarbeiter_lesen on public.mitarbeiter for select to authenticated
  using (public.ist_mitglied(betrieb_id));
create policy mitarbeiter_anlegen on public.mitarbeiter for insert to authenticated
  with check (public.ist_inhaber(betrieb_id));
create policy mitarbeiter_aendern on public.mitarbeiter for update to authenticated
  using (public.ist_inhaber(betrieb_id)) with check (public.ist_inhaber(betrieb_id));
create policy mitarbeiter_loeschen on public.mitarbeiter for delete to authenticated
  using (public.ist_inhaber(betrieb_id));

create policy thema_lesen on public.thema for select to authenticated
  using (betrieb_id is null or public.ist_mitglied(betrieb_id));
create policy thema_anlegen on public.thema for insert to authenticated
  with check (betrieb_id is not null and public.ist_inhaber(betrieb_id));
create policy thema_aendern on public.thema for update to authenticated
  using (betrieb_id is not null and public.ist_inhaber(betrieb_id))
  with check (betrieb_id is not null and public.ist_inhaber(betrieb_id));
create policy thema_loeschen on public.thema for delete to authenticated
  using (betrieb_id is not null and public.ist_inhaber(betrieb_id));

create policy unterweisung_lesen on public.unterweisung for select to authenticated
  using (public.ist_mitglied(betrieb_id));
create policy unterweisung_anlegen on public.unterweisung for insert to authenticated
  with check (public.ist_mitglied(betrieb_id));
create policy unterweisung_aendern on public.unterweisung for update to authenticated
  using (public.ist_mitglied(betrieb_id)) with check (public.ist_mitglied(betrieb_id));
create policy unterweisung_loeschen on public.unterweisung for delete to authenticated
  using (public.ist_mitglied(betrieb_id));

create policy teilnahme_lesen on public.teilnahme for select to authenticated
  using (public.ist_mitglied(betrieb_id));
create policy teilnahme_anlegen on public.teilnahme for insert to authenticated
  with check (public.ist_mitglied(betrieb_id));
create policy teilnahme_aendern on public.teilnahme for update to authenticated
  using (public.ist_mitglied(betrieb_id)) with check (public.ist_mitglied(betrieb_id));
create policy teilnahme_loeschen on public.teilnahme for delete to authenticated
  using (public.ist_mitglied(betrieb_id));

create policy nachweis_lesen on public.nachweis for select to authenticated
  using (public.ist_mitglied(betrieb_id));

create policy audit_lesen on public.audit_log for select to authenticated
  using (public.ist_inhaber(betrieb_id));

-- ===========================================================================
-- Trigger: Mandantenkonsistenz und Unveränderbarkeit
-- ===========================================================================

-- Thema: Inhaltsänderung setzt Prüfstatus zurück.
create function public.tg_thema_bu() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.betrieb_id is distinct from new.betrieb_id then
    raise exception 'Betrieb eines Themas kann nicht geändert werden';
  end if;
  new.geaendert_am := now();
  if (new.inhalt is distinct from old.inhalt or new.titel is distinct from old.titel
      or new.erfordert_uebung is distinct from old.erfordert_uebung)
     and old.pruefstatus = 'geprueft' and new.pruefstatus = 'geprueft' then
    new.pruefstatus := 'nicht_geprueft';
    new.geprueft_von := null;
    new.geprueft_am := null;
  end if;
  if new.pruefstatus = 'nicht_geprueft' then
    new.geprueft_von := null;
    new.geprueft_am := null;
  end if;
  return new;
end $$;
create trigger thema_bu before update on public.thema
  for each row execute function public.tg_thema_bu();

create function public.tg_thema_bi() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.vorlage_id is not null and not exists (
    select 1 from public.thema v where v.id = new.vorlage_id and v.betrieb_id is null
  ) then
    raise exception 'Vorlage muss ein Bibliotheksthema sein';
  end if;
  return new;
end $$;
create trigger thema_bi before insert on public.thema
  for each row execute function public.tg_thema_bi();

-- Unterweisung: Statusmaschine geplant -> durchgefuehrt -> abgeschlossen
create function public.tg_unterweisung() returns trigger
language plpgsql set search_path = '' as $$
declare
  t public.thema;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'geplant' and not public.loeschlauf_aktiv() then
      raise exception 'Nur geplante Unterweisungen können gelöscht werden';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    select * into t from public.thema where id = new.thema_id;
    if t.id is null or t.betrieb_id is distinct from new.betrieb_id then
      raise exception 'Thema gehört nicht zum Betrieb';
    end if;
    if new.nachtrag_zu is not null and not exists (
      select 1 from public.unterweisung o
      where o.id = new.nachtrag_zu and o.betrieb_id = new.betrieb_id and o.status = 'abgeschlossen'
    ) then
      raise exception 'Nachtrag nur zu einer abgeschlossenen Unterweisung desselben Betriebs';
    end if;
    new.status := 'geplant';
    new.thema_snapshot := null;
    new.durchgefuehrt_am := null;
    new.abgeschlossen_am := null;
    return new;
  end if;

  -- UPDATE
  if public.loeschlauf_aktiv() then
    return new;
  end if;
  if old.status = 'abgeschlossen' then
    raise exception 'Abgeschlossene Unterweisungen sind unveränderbar. Bitte einen Nachtrag anlegen.';
  end if;
  if new.betrieb_id is distinct from old.betrieb_id or new.thema_id is distinct from old.thema_id
     or new.nachtrag_zu is distinct from old.nachtrag_zu then
    raise exception 'Betrieb, Thema und Nachtragsbezug sind nicht änderbar';
  end if;

  if old.status = 'durchgefuehrt' then
    -- Eingefroren: nur Bemerkung und der Statuswechsel zum Abschluss sind erlaubt.
    if new.datum is distinct from old.datum or new.ort is distinct from old.ort
       or new.unterweisender_name is distinct from old.unterweisender_name
       or new.uebung_beschreibung is distinct from old.uebung_beschreibung
       or new.thema_snapshot is distinct from old.thema_snapshot
       or new.durchgefuehrt_am is distinct from old.durchgefuehrt_am then
      raise exception 'Nach der Durchführung sind Datum, Ort, Unterweisender und Inhalt eingefroren';
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'geplant' and new.status = 'durchgefuehrt' then
      if new.datum > current_date then
        raise exception 'Eine Unterweisung in der Zukunft kann nicht als durchgeführt markiert werden';
      end if;
      select * into t from public.thema where id = new.thema_id;
      new.durchgefuehrt_am := now();
      new.thema_snapshot := jsonb_build_object(
        'id', t.id,
        'titel', t.titel,
        'kurzbeschreibung', t.kurzbeschreibung,
        'inhalt', t.inhalt,
        'erfordert_uebung', t.erfordert_uebung,
        'pruefstatus', t.pruefstatus,
        'geprueft_von', t.geprueft_von,
        'geprueft_am', t.geprueft_am,
        'stand', t.geaendert_am
      );
    elsif old.status = 'durchgefuehrt' and new.status = 'abgeschlossen' then
      if not exists (select 1 from public.nachweis n where n.unterweisung_id = new.id) then
        raise exception 'Abschluss nur über unterweisung_abschliessen()';
      end if;
      new.abgeschlossen_am := now();
    else
      raise exception 'Unzulässiger Statuswechsel % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end $$;
create trigger unterweisung_biud before insert or update or delete on public.unterweisung
  for each row execute function public.tg_unterweisung();

-- Teilnahme
create function public.tg_teilnahme() returns trigger
language plpgsql set search_path = '' as $$
declare
  u public.unterweisung;
  nur_token_entfernt boolean;
begin
  if public.loeschlauf_aktiv() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    select * into u from public.unterweisung where id = new.unterweisung_id;
    if u.betrieb_id is distinct from new.betrieb_id then
      raise exception 'Unterweisung gehört nicht zum Betrieb';
    end if;
    if u.status = 'abgeschlossen' then
      raise exception 'Zu abgeschlossenen Unterweisungen können keine Teilnehmer hinzugefügt werden';
    end if;
    if not exists (
      select 1 from public.mitarbeiter m
      where m.id = new.mitarbeiter_id and m.betrieb_id = new.betrieb_id and m.aktiv
    ) then
      raise exception 'Mitarbeiter gehört nicht zum Betrieb oder ist inaktiv';
    end if;
    if new.unterschrieben_am is not null then
      raise exception 'Unterschrift nur über teilnahme_unterschreiben()';
    end if;
    return new;
  end if;

  select * into u from public.unterweisung where id = old.unterweisung_id;

  if tg_op = 'DELETE' then
    if old.unterschrieben_am is not null or u.status = 'abgeschlossen' then
      raise exception 'Unterschriebene Teilnahmen sind unveränderbar';
    end if;
    return old;
  end if;

  -- UPDATE: Einzige Ausnahme nach Unterschrift/Abschluss: Token endgültig entfernen.
  nur_token_entfernt := new.token_hash is null and new.token_laeuft_ab is null
    and (to_jsonb(new) - 'token_hash' - 'token_laeuft_ab') = (to_jsonb(old) - 'token_hash' - 'token_laeuft_ab');
  if nur_token_entfernt then
    return new;
  end if;
  if old.unterschrieben_am is not null then
    raise exception 'Unterschriebene Teilnahmen sind unveränderbar';
  end if;
  if u.status = 'abgeschlossen' then
    raise exception 'Teilnahmen abgeschlossener Unterweisungen sind unveränderbar';
  end if;
  if new.betrieb_id is distinct from old.betrieb_id
     or new.unterweisung_id is distinct from old.unterweisung_id
     or new.mitarbeiter_id is distinct from old.mitarbeiter_id then
    raise exception 'Zuordnung einer Teilnahme ist nicht änderbar';
  end if;
  return new;
end $$;
create trigger teilnahme_biud before insert or update or delete on public.teilnahme
  for each row execute function public.tg_teilnahme();

-- Mitarbeiter: Betrieb nicht änderbar
create function public.tg_mitarbeiter_bu() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.betrieb_id is distinct from old.betrieb_id then
    raise exception 'Betrieb eines Mitarbeiters kann nicht geändert werden';
  end if;
  return new;
end $$;
create trigger mitarbeiter_bu before update on public.mitarbeiter
  for each row execute function public.tg_mitarbeiter_bu();

-- Append-only für Nachweis und Audit-Log
create function public.tg_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.loeschlauf_aktiv() then
    return coalesce(new, old);
  end if;
  raise exception 'Tabelle % ist append-only', tg_table_name;
end $$;
create trigger nachweis_append_only before update or delete on public.nachweis
  for each row execute function public.tg_append_only();
create trigger audit_append_only before update or delete on public.audit_log
  for each row execute function public.tg_append_only();

-- ===========================================================================
-- Audit-Trigger: protokolliert Aktion und geänderte Spalten (keine Werte –
-- Datensparsamkeit), bei Statuswechseln zusätzlich den neuen Status.
-- ===========================================================================
create function public.tg_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  alt jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  neu jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  spalten text[];
  details jsonb := '{}'::jsonb;
  b uuid;
begin
  if public.loeschlauf_aktiv() then
    return null;
  end if;
  b := coalesce((neu ->> 'betrieb_id')::uuid, (alt ->> 'betrieb_id')::uuid);
  if tg_table_name = 'betrieb' then
    b := coalesce((neu ->> 'id')::uuid, (alt ->> 'id')::uuid);
  end if;
  if b is null then
    return null;  -- Bibliotheksthemen
  end if;
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into spalten
    from jsonb_object_keys(neu) k
    where neu -> k is distinct from alt -> k and k not in ('geaendert_am');
    if spalten is null then
      return null;
    end if;
    details := jsonb_build_object('spalten', to_jsonb(spalten));
    if 'status' = any(spalten) then
      details := details || jsonb_build_object('status', neu ->> 'status');
    end if;
  end if;
  insert into public.audit_log (betrieb_id, user_id, aktion, tabelle, objekt_id, details)
  values (b, auth.uid(), lower(tg_op), tg_table_name,
          coalesce((neu ->> 'id')::uuid, (alt ->> 'id')::uuid),
          nullif(details, '{}'::jsonb));
  return null;
end $$;

create trigger audit after insert or update or delete on public.betrieb
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.mitarbeiter
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.thema
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.unterweisung
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.teilnahme
  for each row execute function public.tg_audit();
create trigger audit after insert on public.nachweis
  for each row execute function public.tg_audit();

-- ===========================================================================
-- RPC-Funktionen
-- ===========================================================================

-- Betrieb beim ersten Login anlegen. Der anlegende Nutzer wird Inhaber.
create function public.betrieb_anlegen(p_name text, p_anschrift text, p_anzeigename text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  b uuid;
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;
  if exists (select 1 from public.betrieb_mitglied where user_id = uid) then
    raise exception 'Nutzer ist bereits einem Betrieb zugeordnet';
  end if;
  insert into public.betrieb (name, anschrift) values (trim(p_name), nullif(trim(p_anschrift), ''))
    returning id into b;
  insert into public.betrieb_mitglied (betrieb_id, user_id, rolle, anzeigename)
    values (b, uid, 'inhaber', trim(p_anzeigename));
  return b;
end $$;

-- Öffentlich (anon): Anzeige-Daten zu einem Unterschrifts-Token.
-- Liefert NULL, wenn der Token unbekannt oder abgelaufen ist.
create function public.teilnahme_info(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  tn public.teilnahme;
  u public.unterweisung;
  t jsonb;
  m public.mitarbeiter;
  b public.betrieb;
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 200 then
    return null;
  end if;
  select * into tn from public.teilnahme
   where token_hash = public.hash_hex(p_token) and token_laeuft_ab > now();
  if tn.id is null then
    return null;
  end if;
  select * into u from public.unterweisung where id = tn.unterweisung_id;
  select * into m from public.mitarbeiter where id = tn.mitarbeiter_id;
  select * into b from public.betrieb where id = tn.betrieb_id;
  t := coalesce(u.thema_snapshot, (
    select jsonb_build_object('titel', x.titel, 'kurzbeschreibung', x.kurzbeschreibung,
      'inhalt', x.inhalt, 'erfordert_uebung', x.erfordert_uebung, 'pruefstatus', x.pruefstatus)
    from public.thema x where x.id = u.thema_id));
  return jsonb_build_object(
    'betrieb', b.name,
    'status', u.status,
    'datum', u.datum,
    'ort', u.ort,
    'unterweisender', u.unterweisender_name,
    'uebung_beschreibung', u.uebung_beschreibung,
    'thema', t,
    'mitarbeiter', m.vorname || ' ' || m.nachname,
    'unterschrieben_am', tn.unterschrieben_am,
    'aussage', coalesce(tn.aussage, public.aussage_text(u.datum, u.unterweisender_name,
                        t ->> 'titel', coalesce((t ->> 'erfordert_uebung')::boolean, false)))
  );
end $$;

-- Öffentlich (anon): Unterschrift leisten.
create function public.teilnahme_unterschreiben(p_token text, p_name text, p_user_agent text, p_uebung boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  tn public.teilnahme;
  u public.unterweisung;
  uebung boolean;
  name_bereinigt text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 200 then
    raise exception 'Link ungültig';
  end if;
  select * into tn from public.teilnahme
   where token_hash = public.hash_hex(p_token) and token_laeuft_ab > now()
   for update;
  if tn.id is null then
    raise exception 'Link ungültig oder abgelaufen';
  end if;
  if tn.unterschrieben_am is not null then
    raise exception 'Bereits unterschrieben';
  end if;
  select * into u from public.unterweisung where id = tn.unterweisung_id;
  if u.status <> 'durchgefuehrt' then
    raise exception 'Unterschrift ist erst nach der Durchführung der Unterweisung möglich';
  end if;
  if length(name_bereinigt) < 2 or length(name_bereinigt) > 200 then
    raise exception 'Bitte vollständigen Namen eingeben';
  end if;
  uebung := coalesce((u.thema_snapshot ->> 'erfordert_uebung')::boolean, false);
  if uebung and coalesce(p_uebung, false) is not true then
    raise exception 'Für dieses Thema ist die Teilnahme an der praktischen Übung zu bestätigen';
  end if;

  update public.teilnahme set
    unterschrift_name = name_bereinigt,
    aussage = public.aussage_text(u.datum, u.unterweisender_name, u.thema_snapshot ->> 'titel', uebung),
    unterschrieben_am = now(),
    user_agent = left(p_user_agent, 500),
    uebung_bestaetigt = case when uebung then true end
  where id = tn.id
  returning * into tn;

  return jsonb_build_object('unterschrieben_am', tn.unterschrieben_am, 'aussage', tn.aussage);
end $$;

-- Abschluss: legt den Nachweis an und friert die Unterweisung ein (eine Transaktion).
create function public.unterweisung_abschliessen(
  p_unterweisung_id uuid,
  p_storage_pfad text,
  p_pdf_sha256 text,
  p_inhalt_sha256 text,
  p_inhalt_kanonisch text,
  p_anzahl_unterschriften int
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  u public.unterweisung;
  anzahl int;
  n uuid;
begin
  select * into u from public.unterweisung where id = p_unterweisung_id for update;
  if u.id is null or not public.ist_mitglied(u.betrieb_id) then
    raise exception 'Unterweisung nicht gefunden';
  end if;
  if u.status <> 'durchgefuehrt' then
    raise exception 'Nur durchgeführte Unterweisungen können abgeschlossen werden';
  end if;
  select count(*) into anzahl from public.teilnahme
   where unterweisung_id = u.id and unterschrieben_am is not null;
  if anzahl = 0 then
    raise exception 'Mindestens eine Unterschrift ist erforderlich';
  end if;
  if anzahl <> p_anzahl_unterschriften then
    raise exception 'Unterschriften haben sich zwischenzeitlich geändert – bitte erneut abschließen';
  end if;
  if public.hash_hex(p_inhalt_kanonisch) <> p_inhalt_sha256 then
    raise exception 'Inhalts-Hash stimmt nicht';
  end if;
  if (p_inhalt_kanonisch::jsonb ->> 'unterweisung_id') is distinct from u.id::text then
    raise exception 'Inhalt gehört nicht zu dieser Unterweisung';
  end if;
  if p_storage_pfad not like u.betrieb_id::text || '/' || u.id::text || '/%' then
    raise exception 'Ungültiger Ablagepfad';
  end if;

  insert into public.nachweis (betrieb_id, unterweisung_id, storage_pfad, pdf_sha256,
                               inhalt_sha256, inhalt_kanonisch, erzeugt_von)
  values (u.betrieb_id, u.id, p_storage_pfad, lower(p_pdf_sha256), lower(p_inhalt_sha256),
          p_inhalt_kanonisch, auth.uid())
  returning id into n;

  -- Offene Links unbrauchbar machen
  update public.teilnahme set token_hash = null, token_laeuft_ab = null
   where unterweisung_id = u.id and token_hash is not null;

  update public.unterweisung set status = 'abgeschlossen' where id = u.id;
  return n;
end $$;

-- Wartung: abgelaufene Links entfernen (z. B. täglich per pg_cron).
create function public.tokens_bereinigen() returns int
language plpgsql security definer set search_path = '' as $$
declare
  anzahl int;
begin
  update public.teilnahme set token_hash = null, token_laeuft_ab = null
   where token_hash is not null and token_laeuft_ab <= now();
  get diagnostics anzahl = row_count;
  return anzahl;
end $$;

-- Wartung: Löschlauf nach Ablauf der Aufbewahrungsfrist.
-- Löscht Datenbankeinträge und gibt die Storage-Pfade zurück, die anschließend
-- über die Storage-API zu löschen sind (scripts/loeschlauf.mjs).
create function public.loeschlauf_ausfuehren()
returns table (storage_pfad text) language plpgsql security definer set search_path = '' as $$
declare
  pfade text[];
  anzahl_u int;
  anzahl_m int;
begin
  perform set_config('app.loeschlauf', 'on', true);

  create temporary table _faellig on commit drop as
    select u.id, n.storage_pfad
      from public.unterweisung u
      join public.betrieb b on b.id = u.betrieb_id
      left join public.nachweis n on n.unterweisung_id = u.id
     where u.status = 'abgeschlossen'
       and b.aufbewahrung_jahre is not null
       and u.datum < (current_date - make_interval(years => b.aufbewahrung_jahre))::date
       -- Nachträge werden zusammen mit dem Original gelöscht
       and not exists (
         select 1 from public.unterweisung x
          where x.nachtrag_zu = u.id
            and x.datum >= (current_date - make_interval(years => b.aufbewahrung_jahre))::date
       );

  select array_agg(f.storage_pfad) into pfade from _faellig f where f.storage_pfad is not null;

  delete from public.nachweis where unterweisung_id in (select id from _faellig);
  delete from public.teilnahme where unterweisung_id in (select id from _faellig);
  delete from public.unterweisung where id in (select id from _faellig);
  get diagnostics anzahl_u = row_count;

  -- Inaktive Mitarbeiter ohne verbleibende Teilnahmen vollständig löschen
  delete from public.mitarbeiter m
   where not m.aktiv
     and not exists (select 1 from public.teilnahme t where t.mitarbeiter_id = m.id);
  get diagnostics anzahl_m = row_count;

  insert into public.audit_log (betrieb_id, user_id, aktion, tabelle, details)
  values (null, null, 'loeschlauf', 'system',
          jsonb_build_object('unterweisungen', anzahl_u, 'mitarbeiter', anzahl_m));

  return query select unnest(coalesce(pfade, '{}'));
end $$;

-- ===========================================================================
-- Ausführungsrechte
-- ===========================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.ist_mitglied(uuid), public.ist_inhaber(uuid),
  public.loeschlauf_aktiv(), public.hash_hex(text),
  public.aussage_text(date, text, text, boolean) to anon, authenticated;
grant execute on function public.betrieb_anlegen(text, text, text) to authenticated;
grant execute on function public.unterweisung_abschliessen(uuid, text, text, text, text, int) to authenticated;
grant execute on function public.teilnahme_info(text) to anon, authenticated;
grant execute on function public.teilnahme_unterschreiben(text, text, text, boolean) to anon, authenticated;
-- tokens_bereinigen und loeschlauf_ausfuehren: nur service_role / postgres
grant execute on function public.tokens_bereinigen(), public.loeschlauf_ausfuehren() to service_role;

-- Künftig angelegte Funktionen nicht automatisch für anon/authenticated freigeben
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
