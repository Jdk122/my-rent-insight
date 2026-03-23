
create table if not exists public.walkscore_cache (
  normalized_address text primary key,
  walkscore integer,
  transit integer,
  bike integer,
  description text,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_walkscore_cache_updated on public.walkscore_cache (updated_at);

alter table public.walkscore_cache enable row level security;

create policy "Deny all public access" on public.walkscore_cache for all to public using (false);
