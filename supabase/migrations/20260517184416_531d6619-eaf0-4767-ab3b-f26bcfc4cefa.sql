
-- Enum for roles
create type public.app_role as enum ('admin', 'user');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role security-definer
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- Profiles RLS
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "profiles_select_admin" on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (auth.uid() = id);

-- user_roles RLS
create policy "user_roles_select_own" on public.user_roles for select to authenticated
  using (auth.uid() = user_id);
create policy "user_roles_select_admin" on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "user_roles_admin_all" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + assign role on signup (first user = admin)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  user_count int;
  assigned_role public.app_role;
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );

  select count(*) into user_count from public.user_roles;
  if user_count = 0 then
    assigned_role := 'admin';
  else
    assigned_role := 'user';
  end if;

  insert into public.user_roles (user_id, role) values (new.id, assigned_role);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger fn
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- PMO submissions
create table public.pmo_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  description text not null,
  category text,
  created_at timestamptz not null default now()
);
alter table public.pmo_submissions enable row level security;

-- Anyone (incl anon) can insert; admins can view all; users can view their own
create policy "submissions_insert_anyone" on public.pmo_submissions for insert to anon, authenticated
  with check (true);
create policy "submissions_select_own" on public.pmo_submissions for select to authenticated
  using (auth.uid() = user_id);
create policy "submissions_select_admin" on public.pmo_submissions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
