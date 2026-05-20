
insert into storage.buckets (id, name, public) values ('fix-images', 'fix-images', true) on conflict (id) do nothing;

create policy "Fix images are publicly accessible"
on storage.objects for select
using (bucket_id = 'fix-images');

create policy "Admins can upload fix images"
on storage.objects for insert to authenticated
with check (bucket_id = 'fix-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can update fix images"
on storage.objects for update to authenticated
using (bucket_id = 'fix-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete fix images"
on storage.objects for delete to authenticated
using (bucket_id = 'fix-images' and public.has_role(auth.uid(), 'admin'));
