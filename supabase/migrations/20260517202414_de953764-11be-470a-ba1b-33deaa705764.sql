-- AWeber list mappings (Paddle product_id -> AWeber list)
create table public.aweber_list_map (
  id uuid primary key default gen_random_uuid(),
  product_id text not null unique,
  list_id text not null,
  list_name text,
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aweber_list_map enable row level security;

create policy "aweber_list_map_admin_all"
  on public.aweber_list_map for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger aweber_list_map_set_updated_at
  before update on public.aweber_list_map
  for each row execute function public.set_updated_at();

-- AWeber OAuth + account settings (singleton row id='default')
create table public.aweber_settings (
  id text primary key,
  refresh_token text,
  access_token text,
  token_expires_at timestamptz,
  account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aweber_settings enable row level security;

create policy "aweber_settings_admin_all"
  on public.aweber_settings for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger aweber_settings_set_updated_at
  before update on public.aweber_settings
  for each row execute function public.set_updated_at();

-- Track when a profile has been synced to AWeber
alter table public.profiles add column if not exists aweber_synced_at timestamptz;