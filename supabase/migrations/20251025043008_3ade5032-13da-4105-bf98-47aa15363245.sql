-- Backfill default 'viewer' role for all users missing any role
insert into public.user_roles (user_id, role)
select u.id, 'viewer'::public.user_role
from auth.users u
where not exists (
  select 1 from public.user_roles ur where ur.user_id = u.id
);

-- Ensure helper to set default viewer role for current user
create or replace function public.ensure_default_viewer_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.user_roles(user_id, role)
  select auth.uid(), 'viewer'::public.user_role
  where not exists (
    select 1 from public.user_roles ur where ur.user_id = auth.uid()
  );
end;
$$;