-- Add My Offer fields to users table
alter table public.users
  add column if not exists offer_categories text[] not null default '{}',
  add column if not exists product_name text not null default '',
  add column if not exists value_proposition text not null default '',
  add column if not exists target_keywords text[] not null default '{}';
