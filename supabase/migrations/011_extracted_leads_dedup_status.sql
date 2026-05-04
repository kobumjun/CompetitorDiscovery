-- Lead list: dedupe key + status for funnel UI (no backfill of credits / payments).

alter table public.extracted_leads
  add column if not exists contact_email text,
  add column if not exists website_url text,
  add column if not exists lead_status text not null default 'new';

alter table public.extracted_leads
  drop constraint if exists extracted_leads_lead_status_chk;

alter table public.extracted_leads
  add constraint extracted_leads_lead_status_chk
  check (lead_status in ('new', 'pitch_drafted', 'sent'));

-- Backfill from existing jsonb emails + source_url
update public.extracted_leads
set
  contact_email = lower(trim((emails->0->>'email'))),
  website_url = coalesce(nullif(trim(website_url), ''), source_url)
where jsonb_typeof(emails) = 'array'
  and jsonb_array_length(emails) > 0
  and (emails->0->>'email') is not null
  and trim((emails->0->>'email')) <> ''
  and contact_email is null;

update public.extracted_leads
set website_url = source_url
where website_url is null or trim(website_url) = '';

-- Remove duplicate rows (same user + email + website), keep oldest id
delete from public.extracted_leads a
using public.extracted_leads b
where a.id > b.id
  and a.user_id = b.user_id
  and a.contact_email is not null
  and b.contact_email is not null
  and lower(trim(a.contact_email)) = lower(trim(b.contact_email))
  and a.website_url = b.website_url;

create unique index if not exists extracted_leads_user_email_website_uq
  on public.extracted_leads (user_id, contact_email, website_url);
