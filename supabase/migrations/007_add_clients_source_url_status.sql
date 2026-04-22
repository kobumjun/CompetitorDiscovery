alter table public.clients
  add column if not exists source_url text,
  add column if not exists status text not null default 'new';
