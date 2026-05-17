
-- Fix search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

-- Revoke execute on internal definer functions
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
-- authenticated keeps execute on has_role (needed by RLS policies)

-- Replace permissive insert policy with length bounds
drop policy if exists "submissions_insert_anyone" on public.pmo_submissions;
create policy "submissions_insert_anyone" on public.pmo_submissions for insert to anon, authenticated
  with check (
    length(description) between 5 and 5000
    and (category is null or length(category) <= 100)
    and (user_id is null or user_id = auth.uid())
  );
