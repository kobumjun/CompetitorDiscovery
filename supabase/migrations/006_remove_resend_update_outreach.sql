-- ============================================
-- remove_resend_update_outreach
-- ============================================
-- Add new outreach status for mailto flow without editing already-applied migration.

alter table public.outreaches
  drop constraint if exists outreaches_status_check;

alter table public.outreaches
  add constraint outreaches_status_check
  check (status in ('draft', 'sent', 'failed', 'opened_in_client'));
