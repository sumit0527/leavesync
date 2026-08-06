-- leaveSYNC: safe Director-only leave type editing
-- Targeted live fix. Does not modify existing leave applications, balances,
-- notifications, approval workflows, or any other leave type automatically.

begin;

drop function if exists public.update_leave_type_safely(
  uuid,
  text,
  text,
  integer,
  boolean,
  boolean
);

create function public.update_leave_type_safely(
  p_leave_type_id uuid,
  p_name text,
  p_description text,
  p_annual_allocation integer,
  p_requires_document boolean,
  p_has_fixed_allocation boolean
)
returns public.leave_types
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_name text := trim(coalesce(p_name, ''));
  v_allocation integer;
  v_updated public.leave_types;
begin
  select p.role
  into v_caller_role
  from public.profiles p
  where p.id = auth.uid();

  if v_caller_role is distinct from 'main_admin' then
    raise exception 'Only Director can edit leave types'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.leave_types lt
    where lt.id = p_leave_type_id
  ) then
    raise exception 'Leave type was not found'
      using errcode = 'P0002';
  end if;

  if v_name = '' then
    raise exception 'Leave type name is required'
      using errcode = '22023';
  end if;

  if coalesce(p_has_fixed_allocation, true) then
    if p_annual_allocation is null
       or p_annual_allocation < 1
       or p_annual_allocation > 365 then
      raise exception 'Annual allocation must be between 1 and 365 days'
        using errcode = '22023';
    end if;

    v_allocation := p_annual_allocation;
  else
    v_allocation := 0;
  end if;

  if exists (
    select 1
    from public.leave_types lt
    where lower(trim(lt.name)) = lower(v_name)
      and lt.id <> p_leave_type_id
  ) then
    raise exception 'Another leave type with this name already exists'
      using errcode = '23505';
  end if;

  update public.leave_types
  set
    name = v_name,
    description = nullif(trim(coalesce(p_description, '')), ''),
    annual_allocation = v_allocation,
    requires_document = coalesce(p_requires_document, false),
    has_fixed_allocation = coalesce(p_has_fixed_allocation, true)
  where id = p_leave_type_id
  returning *
  into v_updated;

  if not found then
    raise exception 'Leave type update failed'
      using errcode = 'P0001';
  end if;

  return v_updated;
end;
$$;

revoke all
on function public.update_leave_type_safely(
  uuid,
  text,
  text,
  integer,
  boolean,
  boolean
)
from public, anon;

grant execute
on function public.update_leave_type_safely(
  uuid,
  text,
  text,
  integer,
  boolean,
  boolean
)
to authenticated;

commit;

notify pgrst, 'reload schema';

-- Read-only verification:
-- select id, name, annual_allocation, requires_document,
--        has_fixed_allocation, is_active
-- from public.leave_types
-- order by name;
