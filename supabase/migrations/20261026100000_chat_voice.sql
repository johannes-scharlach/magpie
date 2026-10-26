-- Voice messages sent to the cook (ADR 32): a private bucket, objects named
-- <list_id>/<uuid>.m4a, the same shape as chat-images. Members of the list
-- record and play; the message part carries a signed URL that the API
-- downloads for the model.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-voice',
  'chat-voice',
  false,
  10485760,
  array['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac']
)
on conflict (id) do nothing;

create policy "members can upload chat voice" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-voice'
    and public.is_list_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members can read chat voice" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-voice'
    and public.is_list_member(((storage.foldername(name))[1])::uuid)
  );
