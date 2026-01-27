-- Clean up prior attempt (different signature)
drop function if exists public.has_any_role(uuid, text[]);

-- Helper function using correct enum type public.user_role
create or replace function public.has_any_role(_user_id uuid, _roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = any(_roles)
  );
$$;

-- Ensure RLS is enabled and update leads SELECT policy
alter table if exists public.leads enable row level security;

drop policy if exists "Role-based leads access" on public.leads;
create policy "Role-based leads access"
  on public.leads
  for select
  using (
    auth.uid() = user_id
    or public.has_any_role(
      auth.uid(),
      ARRAY['super_admin','admin','manager','loan_processor','underwriter','funder','closer','loan_originator']::public.user_role[]
    )
  );

-- Ensure RLS is enabled and update contact_entities SELECT policy
alter table if exists public.contact_entities enable row level security;

drop policy if exists "Extended roles can view contacts" on public.contact_entities;
create policy "Extended roles can view contacts"
  on public.contact_entities
  for select
  using (
    auth.uid() = user_id
    or public.has_any_role(
      auth.uid(),
      ARRAY['super_admin','admin','manager','loan_processor','underwriter','funder','closer','loan_originator']::public.user_role[]
    )
  );