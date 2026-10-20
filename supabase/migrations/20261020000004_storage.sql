-- Privater Storage-Bucket für Nachweis-PDFs.
-- Pfad: <betrieb_id>/<unterweisung_id>/<pdf_sha256>.pdf
-- Es gibt bewusst KEINE update/delete-Policy: hochgeladene Nachweise sind für
-- Nutzer unveränderbar. Gelöscht wird nur im Löschlauf mit dem Service-Role-Key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nachweise', 'nachweise', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy nachweis_pdf_lesen on storage.objects for select to authenticated
  using (bucket_id = 'nachweise' and public.ist_mitglied(((storage.foldername(name))[1])::uuid));

create policy nachweis_pdf_hochladen on storage.objects for insert to authenticated
  with check (
    bucket_id = 'nachweise'
    and public.ist_mitglied(((storage.foldername(name))[1])::uuid)
    -- nur zu einer durchgeführten (noch nicht abgeschlossenen) Unterweisung dieses Betriebs
    and exists (
      select 1 from public.unterweisung u
       where u.id = ((storage.foldername(name))[2])::uuid
         and u.betrieb_id = ((storage.foldername(name))[1])::uuid
         and u.status = 'durchgefuehrt'
    )
  );
