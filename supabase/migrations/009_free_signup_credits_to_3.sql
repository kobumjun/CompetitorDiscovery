-- New signups: 3 free credits. Does not update existing user rows.
alter table public.users alter column credits set default 3;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, credits, plan)
  values (new.id, new.email, 3, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
