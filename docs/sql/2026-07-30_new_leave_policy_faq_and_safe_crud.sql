-- leaveSYNC policy update - 30 Jul 2026
-- Safe for live data: adds columns/tables/functions and does not delete existing applications.

begin;

alter table public.leave_types
  add column if not exists has_fixed_allocation boolean not null default true,
  add column if not exists is_active boolean not null default true;

insert into public.leave_types (name, description, annual_allocation, requires_document, has_fixed_allocation, is_active)
select 'Duty Leave', 'Leave granted for official duty. Reason and supporting document are mandatory.', 0, true, false, true
where not exists (select 1 from public.leave_types where lower(name) = lower('Duty Leave'));

insert into public.leave_types (name, description, annual_allocation, requires_document, has_fixed_allocation, is_active)
select 'C-Off', 'Compensatory off. Reason and supporting document are mandatory.', 0, true, false, true
where not exists (select 1 from public.leave_types where lower(name) in (lower('C-Off'), lower('C Off')));

create table if not exists public.faq_questions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('leaves','calendar','applications','documents','account','reports','other')),
  question text not null check (char_length(trim(question)) between 10 and 1000),
  status text not null default 'new' check (status in ('new','reviewed','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.faq_questions enable row level security;

drop policy if exists "Users can submit FAQ questions" on public.faq_questions;
create policy "Users can submit FAQ questions"
on public.faq_questions for insert to authenticated
with check (submitted_by = auth.uid());

drop policy if exists "Users can read own FAQ questions" on public.faq_questions;
create policy "Users can read own FAQ questions"
on public.faq_questions for select to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('main_admin','viewer')
  )
);

create or replace function public.calculate_leave_days(start_date date, end_date date)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  current_day date;
  total numeric := 0;
begin
  if start_date is null or end_date is null or end_date < start_date then return 0; end if;
  current_day := start_date;
  while current_day <= end_date loop
    if extract(dow from current_day) <> 0
       and not exists (select 1 from public.holidays h where h.date = current_day) then
      total := total + 1;
    end if;
    current_day := current_day + 1;
  end loop;
  return total;
end;
$$;

grant execute on function public.calculate_leave_days(date,date) to authenticated;

create or replace function public.delete_leave_type_safely(p_leave_type_id uuid)
returns table(action text, application_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  used_count bigint;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role <> 'main_admin' then raise exception 'Only Director can remove leave types'; end if;

  select count(*) into used_count from public.leave_applications where leave_type_id = p_leave_type_id;

  if used_count > 0 then
    update public.leave_types set is_active = false, updated_at = now() where id = p_leave_type_id;
    if not found then raise exception 'Leave type was not found'; end if;
    return query select 'archived'::text, used_count;
  else
    delete from public.staff_leave_allocations where leave_type_id = p_leave_type_id;
    delete from public.leave_types where id = p_leave_type_id;
    if not found then raise exception 'Leave type was not found or could not be deleted'; end if;
    return query select 'deleted'::text, 0::bigint;
  end if;
end;
$$;

grant execute on function public.delete_leave_type_safely(uuid) to authenticated;

update storage.buckets
set allowed_mime_types = array['application/pdf','image/jpeg','image/png'],
    file_size_limit = 5242880
where id = 'leave-documents';

commit;
notify pgrst, 'reload schema';

-- Server-side policy validation so direct API calls cannot bypass the form rules.
create or replace function public.validate_leave_application_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  india_now timestamp := timezone('Asia/Kolkata', now());
  india_today date := timezone('Asia/Kolkata', now())::date;
  current_minutes integer := extract(hour from india_now)::integer * 60 + extract(minute from india_now)::integer;
  document_required boolean := false;
begin
  if new.start_date < india_today then
    raise exception 'Leave cannot be applied for a past date';
  end if;

  if new.start_date = india_today and current_minutes >= 600 and current_minutes < 1020 then
    raise exception 'Same-day leave cannot be applied between 10:00 AM and 5:00 PM';
  end if;

  if extract(dow from new.start_date) = 0 or extract(dow from new.end_date) = 0 then
    raise exception 'Sunday cannot be selected as a leave date';
  end if;

  if exists (
    select 1 from public.holidays h
    where h.date between new.start_date and new.end_date
  ) then
    -- Date ranges may contain holidays, but starting/ending directly on a holiday is not allowed.
    if exists (select 1 from public.holidays h where h.date in (new.start_date, new.end_date)) then
      raise exception 'Leave cannot start or end on a configured public holiday';
    end if;
  end if;

  select coalesce(requires_document, false) into document_required
  from public.leave_types where id = new.leave_type_id;

  if nullif(trim(new.reason), '') is null then
    raise exception 'Reason is mandatory for every leave application';
  end if;

  if document_required and nullif(trim(coalesce(new.document_url, '')), '') is null then
    raise exception 'Supporting document is mandatory for the selected leave type';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_leave_application_policy on public.leave_applications;
create trigger trg_validate_leave_application_policy
before insert or update of start_date, end_date, leave_type_id, reason, document_url
on public.leave_applications
for each row execute function public.validate_leave_application_policy();
