-- ============================================
-- ProposalPilot: Pivot Migration
-- ============================================

-- Drop old lead-extraction columns from users
alter table public.users
  drop column if exists offer_categories,
  drop column if exists product_name,
  drop column if exists value_proposition,
  drop column if exists target_keywords,
  drop column if exists lead_sensitivity;

-- Update default credits (5 free proposals)
alter table public.users alter column credits set default 5;

-- Drop old analyses table
drop table if exists public.analyses cascade;

-- ============================================
-- Business profiles
-- ============================================
create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique not null,
  business_name text not null default '',
  owner_name text not null default '',
  email text not null default '',
  phone text,
  website text,
  address text,
  logo_url text,
  industry text,
  services text[] not null default '{}',
  hourly_rate numeric,
  currency text not null default 'USD',
  tone text not null default 'professional'
    check (tone in ('professional', 'friendly', 'casual')),
  language text not null default 'en',
  payment_terms text,
  standard_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_business_profiles_updated_at
  before update on public.business_profiles
  for each row execute function public.handle_updated_at();

-- ============================================
-- Clients
-- ============================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_user_id on public.clients(user_id);

create trigger set_clients_updated_at
  before update on public.clients
  for each row execute function public.handle_updated_at();

-- ============================================
-- Proposals
-- ============================================
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  project_name text,
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','accepted','rejected','expired')),
  project_description text not null default '',
  estimated_budget numeric,
  estimated_timeline text,
  content jsonb not null default '{}',
  share_token text unique not null default gen_random_uuid()::text,
  view_count integer not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  signed_at timestamptz,
  signed_by_name text,
  signed_by_email text,
  signature_data text,
  currency text not null default 'USD',
  total_amount numeric,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_proposals_user_id on public.proposals(user_id);
create index idx_proposals_status on public.proposals(status);
create index idx_proposals_share_token on public.proposals(share_token);
create index idx_proposals_client_id on public.proposals(client_id);

create trigger set_proposals_updated_at
  before update on public.proposals
  for each row execute function public.handle_updated_at();

-- ============================================
-- Proposal activities
-- ============================================
create table public.proposal_activities (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  type text not null
    check (type in ('created','sent','viewed','signed','rejected','expired')),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_proposal_activities_proposal_id on public.proposal_activities(proposal_id);

-- ============================================
-- Templates
-- ============================================
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  category text,
  content jsonb not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_templates_user_id on public.templates(user_id);

create trigger set_templates_updated_at
  before update on public.templates
  for each row execute function public.handle_updated_at();

-- ============================================
-- RLS for new tables
-- ============================================

-- Business profiles
alter table public.business_profiles enable row level security;
create policy "Users can view own profile" on public.business_profiles for select using (auth.uid() = user_id);
create policy "Users can insert own profile" on public.business_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile" on public.business_profiles for update using (auth.uid() = user_id);
create policy "Service role manages profiles" on public.business_profiles for all using (auth.role() = 'service_role');

-- Clients
alter table public.clients enable row level security;
create policy "Users can view own clients" on public.clients for select using (auth.uid() = user_id);
create policy "Users can insert own clients" on public.clients for insert with check (auth.uid() = user_id);
create policy "Users can update own clients" on public.clients for update using (auth.uid() = user_id);
create policy "Users can delete own clients" on public.clients for delete using (auth.uid() = user_id);
create policy "Service role manages clients" on public.clients for all using (auth.role() = 'service_role');

-- Proposals
alter table public.proposals enable row level security;
create policy "Users can view own proposals" on public.proposals for select using (auth.uid() = user_id);
create policy "Users can insert own proposals" on public.proposals for insert with check (auth.uid() = user_id);
create policy "Users can update own proposals" on public.proposals for update using (auth.uid() = user_id);
create policy "Users can delete own proposals" on public.proposals for delete using (auth.uid() = user_id);
create policy "Service role manages proposals" on public.proposals for all using (auth.role() = 'service_role');
create policy "Public can view shared proposals" on public.proposals for select using (true);

-- Proposal activities
alter table public.proposal_activities enable row level security;
create policy "Users can view own activities" on public.proposal_activities for select
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid()));
create policy "Service role manages activities" on public.proposal_activities for all using (auth.role() = 'service_role');

-- Templates
alter table public.templates enable row level security;
create policy "Users can view own templates" on public.templates for select using (auth.uid() = user_id);
create policy "Users can insert own templates" on public.templates for insert with check (auth.uid() = user_id);
create policy "Users can update own templates" on public.templates for update using (auth.uid() = user_id);
create policy "Users can delete own templates" on public.templates for delete using (auth.uid() = user_id);
create policy "Service role manages templates" on public.templates for all using (auth.role() = 'service_role');

-- Update new user trigger for 5 credits
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, credits, plan)
  values (new.id, new.email, 5, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
