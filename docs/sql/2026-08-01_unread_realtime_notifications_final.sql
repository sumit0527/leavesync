-- leaveSYNC final unread/realtime notification inbox
-- Safe for live portal data:
--   * does NOT change users, applications, approvals, balances or leave history
--   * clears only old notification clutter by marking existing alerts as read
--   * creates fresh unread alerts only for currently pending work
--   * future alerts are routed to exact users and exact college units

begin;

-- Users can read and mark only their own notification rows.
alter table public.notifications enable row level security;

drop policy if exists "Notification owner can read" on public.notifications;
create policy "Notification owner can read"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Notification owner can update" on public.notifications;
create policy "Notification owner can update"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Registration notification routing
-- Staff pending registration -> approved Principal/UH users in the same unit.
-- Principal/UH pending registration -> approved Director and Viewer users.
-- ---------------------------------------------------------------------------

create or replace function public.route_pending_registration_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  person_name text;
  unit_text text;
  notification_type text;
begin
  if coalesce(new.approval_status, '') <> 'pending' then
    return new;
  end if;

  person_name := coalesce(nullif(trim(new.full_name), ''), new.username, 'New user');
  unit_text := case new.college_unit
    when 'junior' then 'Junior College'
    when 'senior' then 'Senior College'
    when 'pharmacy' then 'Pharmacy College'
    else 'Unassigned Unit'
  end;

  if new.role = 'staff' then
    notification_type := 'staff_registration_pending:' || new.id::text;

    insert into public.notifications (
      user_id, title, message, type, related_application_id, is_read
    )
    select
      approver.id,
      'Staff Registration Pending',
      person_name || ' from ' || unit_text || ' is waiting for account approval.',
      notification_type,
      null,
      false
    from public.profiles approver
    where approver.role in ('admin', 'principal')
      and approver.admin_designation in ('principal', 'uh')
      and approver.approval_status = 'approved'
      and coalesce(approver.employment_status, 'active') = 'active'
      and approver.college_unit = new.college_unit
      and not exists (
        select 1 from public.notifications n
        where n.user_id = approver.id
          and n.type = notification_type
          and n.is_read = false
      );

  elsif new.role in ('admin', 'principal')
        and new.admin_designation in ('principal', 'uh') then
    notification_type := 'management_registration_pending:' || new.id::text;

    insert into public.notifications (
      user_id, title, message, type, related_application_id, is_read
    )
    select
      management.id,
      'Principal / UH Registration Pending',
      person_name || ' (' || upper(coalesce(new.admin_designation, 'management')) || ') from '
        || unit_text || ' is waiting for Director approval.',
      notification_type,
      null,
      false
    from public.profiles management
    where management.role in ('main_admin', 'director', 'viewer')
      and management.approval_status = 'approved'
      and coalesce(management.employment_status, 'active') = 'active'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = management.id
          and n.type = notification_type
          and n.is_read = false
      );
  end if;

  return new;
end;
$$;

create or replace function public.close_registration_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.approval_status = 'pending'
     and new.approval_status in ('approved', 'rejected') then
    update public.notifications
    set is_read = true
    where is_read = false
      and type in (
        'staff_registration_pending:' || new.id::text,
        'management_registration_pending:' || new.id::text
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_route_pending_registration_notification on public.profiles;
create trigger trg_route_pending_registration_notification
after insert on public.profiles
for each row
execute function public.route_pending_registration_notification();

drop trigger if exists trg_close_registration_notification on public.profiles;
create trigger trg_close_registration_notification
after update of approval_status on public.profiles
for each row
execute function public.close_registration_notification();

-- ---------------------------------------------------------------------------
-- Leave notification routing
-- Staff leave -> Principal/UH in applicant's exact unit.
-- Principal/UH leave -> Director and Viewer.
-- Principal/UH also receives a personal "submitted" update in My Leave portal.
-- ---------------------------------------------------------------------------

create or replace function public.route_new_leave_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant_role text;
  applicant_name text;
  applicant_unit text;
  applicant_designation text;
  unit_text text;
  leave_name text;
begin
  if coalesce(new.status, 'pending') <> 'pending' then
    return new;
  end if;

  select
    p.role,
    coalesce(nullif(trim(p.full_name), ''), p.username, 'Portal user'),
    p.college_unit,
    p.admin_designation
  into
    applicant_role,
    applicant_name,
    applicant_unit,
    applicant_designation
  from public.profiles p
  where p.id = new.staff_id;

  if not found then
    return new;
  end if;

  select coalesce(lt.name, 'Leave')
  into leave_name
  from public.leave_types lt
  where lt.id = new.leave_type_id;

  unit_text := case applicant_unit
    when 'junior' then 'Junior College'
    when 'senior' then 'Senior College'
    when 'pharmacy' then 'Pharmacy College'
    else 'Unassigned Unit'
  end;

  if applicant_role = 'staff' then
    insert into public.notifications (
      user_id, title, message, type, related_application_id, is_read
    )
    select
      approver.id,
      'Staff Leave Request Pending',
      applicant_name || ' from ' || unit_text || ' applied for ' || leave_name
        || ' (' || to_char(new.start_date, 'DD Mon YYYY') || ' to '
        || to_char(new.end_date, 'DD Mon YYYY') || ').',
      'staff_leave_pending',
      new.id,
      false
    from public.profiles approver
    where approver.role in ('admin', 'principal')
      and approver.admin_designation in ('principal', 'uh')
      and approver.approval_status = 'approved'
      and coalesce(approver.employment_status, 'active') = 'active'
      and approver.college_unit = applicant_unit
      and not exists (
        select 1 from public.notifications n
        where n.user_id = approver.id
          and n.related_application_id = new.id
          and n.type = 'staff_leave_pending'
          and n.is_read = false
      );

  elsif applicant_role in ('admin', 'principal')
        and applicant_designation in ('principal', 'uh') then
    insert into public.notifications (
      user_id, title, message, type, related_application_id, is_read
    )
    select
      management.id,
      'Principal / UH Leave Pending',
      applicant_name || ' (' || upper(applicant_designation) || ') from '
        || unit_text || ' applied for ' || leave_name || ' ('
        || to_char(new.start_date, 'DD Mon YYYY') || ' to '
        || to_char(new.end_date, 'DD Mon YYYY') || ').',
      'management_leave_pending',
      new.id,
      false
    from public.profiles management
    where management.role in ('main_admin', 'director', 'viewer')
      and management.approval_status = 'approved'
      and coalesce(management.employment_status, 'active') = 'active'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = management.id
          and n.related_application_id = new.id
          and n.type = 'management_leave_pending'
          and n.is_read = false
      );

    -- Own leave update appears in Principal/UH My Leave notifications.
    if not exists (
      select 1 from public.notifications n
      where n.user_id = new.staff_id
        and n.related_application_id = new.id
        and n.type = 'my_leave_submitted'
        and n.is_read = false
    ) then
      insert into public.notifications (
        user_id, title, message, type, related_application_id, is_read
      ) values (
        new.staff_id,
        'Leave Application Submitted',
        'Your ' || leave_name || ' application from '
          || to_char(new.start_date, 'DD Mon YYYY') || ' to '
          || to_char(new.end_date, 'DD Mon YYYY')
          || ' was submitted and is waiting for Director review.',
        'my_leave_submitted',
        new.id,
        false
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.route_leave_decision_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  leave_name text;
  reviewer_name text;
  decision_title text;
  decision_type text;
begin
  if old.status is not distinct from new.status
     or new.status not in ('approved', 'rejected') then
    return new;
  end if;

  -- Remove the approver alert and the older "submitted" update.
  update public.notifications
  set is_read = true
  where related_application_id = new.id
    and is_read = false
    and type in (
      'staff_leave_pending',
      'management_leave_pending',
      'my_leave_submitted'
    );

  select coalesce(lt.name, 'Leave')
  into leave_name
  from public.leave_types lt
  where lt.id = new.leave_type_id;

  select coalesce(nullif(trim(p.full_name), ''), p.username, 'Authorized reviewer')
  into reviewer_name
  from public.profiles p
  where p.id = new.reviewed_by;

  decision_title := case
    when new.status = 'approved' then 'Leave Application Approved'
    else 'Leave Application Rejected'
  end;

  decision_type := case
    when new.status = 'approved' then 'leave_approved'
    else 'leave_rejected'
  end;

  if not exists (
    select 1 from public.notifications n
    where n.user_id = new.staff_id
      and n.related_application_id = new.id
      and n.type = decision_type
      and n.is_read = false
  ) then
    insert into public.notifications (
      user_id, title, message, type, related_application_id, is_read
    ) values (
      new.staff_id,
      decision_title,
      'Your ' || leave_name || ' application from '
        || to_char(new.start_date, 'DD Mon YYYY') || ' to '
        || to_char(new.end_date, 'DD Mon YYYY') || ' was '
        || new.status || ' by ' || coalesce(reviewer_name, 'Authorized reviewer')
        || case
          when nullif(trim(coalesce(new.admin_response, '')), '') is not null
            then '. Response: ' || trim(new.admin_response)
          else '.'
        end,
      decision_type,
      new.id,
      false
    );
  end if;

  return new;
end;
$$;

-- Remove earlier overlapping trigger names so one event creates one alert only.
drop trigger if exists trg_notify_leave_applicant_on_decision on public.leave_applications;
drop trigger if exists trg_notify_leave_submission on public.leave_applications;
drop trigger if exists trg_notify_leave_decision on public.leave_applications;
drop trigger if exists trg_route_new_leave_notification on public.leave_applications;
drop trigger if exists trg_route_leave_decision_notification on public.leave_applications;

create trigger trg_route_new_leave_notification
after insert on public.leave_applications
for each row
execute function public.route_new_leave_notification();

create trigger trg_route_leave_decision_notification
after update of status on public.leave_applications
for each row
execute function public.route_leave_decision_notification();

-- ---------------------------------------------------------------------------
-- Clean old clutter, then backfill ONLY currently pending live work.
-- ---------------------------------------------------------------------------

update public.notifications
set is_read = true
where is_read = false;

-- Current pending registrations.
insert into public.notifications (
  user_id, title, message, type, related_application_id, is_read
)
select
  approver.id,
  'Staff Registration Pending',
  coalesce(nullif(trim(staff.full_name), ''), staff.username, 'New staff')
    || ' from '
    || case staff.college_unit
      when 'junior' then 'Junior College'
      when 'senior' then 'Senior College'
      when 'pharmacy' then 'Pharmacy College'
      else 'Unassigned Unit'
    end
    || ' is waiting for account approval.',
  'staff_registration_pending:' || staff.id::text,
  null,
  false
from public.profiles staff
join public.profiles approver
  on approver.role in ('admin', 'principal')
 and approver.admin_designation in ('principal', 'uh')
 and approver.approval_status = 'approved'
 and coalesce(approver.employment_status, 'active') = 'active'
 and approver.college_unit = staff.college_unit
where staff.role = 'staff'
  and staff.approval_status = 'pending';

insert into public.notifications (
  user_id, title, message, type, related_application_id, is_read
)
select
  management.id,
  'Principal / UH Registration Pending',
  coalesce(nullif(trim(applicant.full_name), ''), applicant.username, 'Management user')
    || ' (' || upper(coalesce(applicant.admin_designation, 'management')) || ') from '
    || case applicant.college_unit
      when 'junior' then 'Junior College'
      when 'senior' then 'Senior College'
      when 'pharmacy' then 'Pharmacy College'
      else 'Unassigned Unit'
    end
    || ' is waiting for Director approval.',
  'management_registration_pending:' || applicant.id::text,
  null,
  false
from public.profiles applicant
join public.profiles management
  on management.role in ('main_admin', 'director', 'viewer')
 and management.approval_status = 'approved'
 and coalesce(management.employment_status, 'active') = 'active'
where applicant.role in ('admin', 'principal')
  and applicant.admin_designation in ('principal', 'uh')
  and applicant.approval_status = 'pending';

-- Current pending leave applications.
insert into public.notifications (
  user_id, title, message, type, related_application_id, is_read
)
select
  approver.id,
  'Staff Leave Request Pending',
  coalesce(nullif(trim(staff.full_name), ''), staff.username, 'Staff')
    || ' from '
    || case staff.college_unit
      when 'junior' then 'Junior College'
      when 'senior' then 'Senior College'
      when 'pharmacy' then 'Pharmacy College'
      else 'Unassigned Unit'
    end
    || ' applied for ' || coalesce(lt.name, 'Leave') || ' ('
    || to_char(la.start_date, 'DD Mon YYYY') || ' to '
    || to_char(la.end_date, 'DD Mon YYYY') || ').',
  'staff_leave_pending',
  la.id,
  false
from public.leave_applications la
join public.profiles staff on staff.id = la.staff_id
left join public.leave_types lt on lt.id = la.leave_type_id
join public.profiles approver
  on approver.role in ('admin', 'principal')
 and approver.admin_designation in ('principal', 'uh')
 and approver.approval_status = 'approved'
 and coalesce(approver.employment_status, 'active') = 'active'
 and approver.college_unit = staff.college_unit
where la.status = 'pending'
  and staff.role = 'staff';

insert into public.notifications (
  user_id, title, message, type, related_application_id, is_read
)
select
  management.id,
  'Principal / UH Leave Pending',
  coalesce(nullif(trim(applicant.full_name), ''), applicant.username, 'Management user')
    || ' (' || upper(coalesce(applicant.admin_designation, 'management')) || ') from '
    || case applicant.college_unit
      when 'junior' then 'Junior College'
      when 'senior' then 'Senior College'
      when 'pharmacy' then 'Pharmacy College'
      else 'Unassigned Unit'
    end
    || ' applied for ' || coalesce(lt.name, 'Leave') || ' ('
    || to_char(la.start_date, 'DD Mon YYYY') || ' to '
    || to_char(la.end_date, 'DD Mon YYYY') || ').',
  'management_leave_pending',
  la.id,
  false
from public.leave_applications la
join public.profiles applicant on applicant.id = la.staff_id
left join public.leave_types lt on lt.id = la.leave_type_id
join public.profiles management
  on management.role in ('main_admin', 'director', 'viewer')
 and management.approval_status = 'approved'
 and coalesce(management.employment_status, 'active') = 'active'
where la.status = 'pending'
  and applicant.role in ('admin', 'principal')
  and applicant.admin_designation in ('principal', 'uh');

-- Principal/UH own pending leave update in My Leave notification page.
insert into public.notifications (
  user_id, title, message, type, related_application_id, is_read
)
select
  applicant.id,
  'Leave Application Submitted',
  'Your ' || coalesce(lt.name, 'Leave') || ' application from '
    || to_char(la.start_date, 'DD Mon YYYY') || ' to '
    || to_char(la.end_date, 'DD Mon YYYY')
    || ' is waiting for Director review.',
  'my_leave_submitted',
  la.id,
  false
from public.leave_applications la
join public.profiles applicant on applicant.id = la.staff_id
left join public.leave_types lt on lt.id = la.leave_type_id
where la.status = 'pending'
  and applicant.role in ('admin', 'principal')
  and applicant.admin_designation in ('principal', 'uh');

commit;

notify pgrst, 'reload schema';
