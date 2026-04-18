-- Add lead_sensitivity preference to users table
alter table public.users
  add column if not exists lead_sensitivity text not null default 'balanced'
    check (lead_sensitivity in ('conservative', 'balanced', 'aggressive'));
