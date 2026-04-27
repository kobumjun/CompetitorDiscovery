alter table public.extracted_leads
  add column if not exists search_keyword text;
