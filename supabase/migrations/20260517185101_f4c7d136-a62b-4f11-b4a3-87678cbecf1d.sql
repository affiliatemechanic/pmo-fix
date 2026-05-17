
alter table public.pmo_submissions add column email text;

drop policy if exists "submissions_insert_anyone" on public.pmo_submissions;
create policy "submissions_insert_anyone" on public.pmo_submissions for insert to anon, authenticated
  with check (
    length(description) between 5 and 5000
    and (category is null or length(category) <= 100)
    and email is not null
    and length(email) between 5 and 255
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and (user_id is null or user_id = auth.uid())
  );
