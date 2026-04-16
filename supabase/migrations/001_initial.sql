-- ============================================
-- ThreadScope: Initial Database Schema
-- ============================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================
-- Users profile table (extends auth.users)
-- ============================================
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  credits integer not null default 3,
  plan text not null default 'free'
    check (plan in ('free', 'lite', 'standard', 'pro')),
  plan_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_email on public.users(email);
create index idx_users_plan on public.users(plan);

-- ============================================
-- Analyses table
-- ============================================
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  post_url text not null,
  post_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  results jsonb,
  credits_used integer not null default 1,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_analyses_user_id on public.analyses(user_id);
create index idx_analyses_status on public.analyses(status);
create index idx_analyses_created_at on public.analyses(created_at desc);
create index idx_analyses_user_status on public.analyses(user_id, status);
create index idx_analyses_results on public.analyses using gin(results);

-- ============================================
-- Subscriptions table
-- ============================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  lemon_squeezy_subscription_id text unique not null,
  plan text not null
    check (plan in ('lite', 'standard', 'pro')),
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'expired', 'past_due')),
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_status on public.subscriptions(status);
create index idx_subscriptions_ls_id on public.subscriptions(lemon_squeezy_subscription_id);

-- ============================================
-- Updated_at trigger function
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Users table
alter table public.users enable row level security;

create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Service role can manage all users"
  on public.users for all
  using (auth.role() = 'service_role');

-- Analyses table
alter table public.analyses enable row level security;

create policy "Users can view own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

create policy "Users can create own analyses"
  on public.analyses for insert
  with check (auth.uid() = user_id);

create policy "Service role can manage all analyses"
  on public.analyses for all
  using (auth.role() = 'service_role');

-- Subscriptions table
alter table public.subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can manage all subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- ============================================
-- Auto-create user profile on auth signup
-- (Alternative to callback route — belt + suspenders)
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, credits, plan)
  values (new.id, new.email, 3, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
