-- ============================================
-- Lead Extraction + Outreach
-- ============================================

create table public.extracted_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  source_url text not null,
  company_name text,
  company_info text,
  industry text,
  emails jsonb not null default '[]'::jsonb,
  outreach_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_extracted_leads_user_id on public.extracted_leads(user_id);
create index idx_extracted_leads_created_at on public.extracted_leads(created_at desc);

create trigger set_extracted_leads_updated_at
  before update on public.extracted_leads
  for each row execute function public.handle_updated_at();

create table public.outreaches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.extracted_leads(id) on delete cascade not null,
  type text not null check (type in ('proposal', 'pitch', 'investment', 'quote')),
  recipient_email text not null,
  subject text not null default '',
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_outreaches_lead_id on public.outreaches(lead_id);
create index idx_outreaches_status on public.outreaches(status);

alter table public.extracted_leads enable row level security;
alter table public.outreaches enable row level security;

create policy "Users can view own extracted leads"
  on public.extracted_leads for select using (auth.uid() = user_id);
create policy "Users can insert own extracted leads"
  on public.extracted_leads for insert with check (auth.uid() = user_id);
create policy "Users can update own extracted leads"
  on public.extracted_leads for update using (auth.uid() = user_id);
create policy "Users can delete own extracted leads"
  on public.extracted_leads for delete using (auth.uid() = user_id);
create policy "Service role manages extracted leads"
  on public.extracted_leads for all using (auth.role() = 'service_role');

create policy "Users can view own outreaches"
  on public.outreaches for select
  using (
    exists (
      select 1
      from public.extracted_leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  );
create policy "Users can insert own outreaches"
  on public.outreaches for insert
  with check (
    exists (
      select 1
      from public.extracted_leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  );
create policy "Users can update own outreaches"
  on public.outreaches for update
  using (
    exists (
      select 1
      from public.extracted_leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  );
create policy "Users can delete own outreaches"
  on public.outreaches for delete
  using (
    exists (
      select 1
      from public.extracted_leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  );
create policy "Service role manages outreaches"
  on public.outreaches for all using (auth.role() = 'service_role');
