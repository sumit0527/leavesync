import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type ChatHistoryMessage = { role?: 'user' | 'assistant'; text?: string };
type RequestBody = { question?: string; history?: ChatHistoryMessage[]; audioBase64?: string; audioMimeType?: string };

type ProfileRecord = {
  name: string;
  role: string;
  role_key: string;
  unit: string;
  unit_key: string;
  designation: string;
  status: string;
  department: string;
  active_status: string;
};

type LeaveRecord = {
  applicant: string;
  role: string;
  role_key: string;
  unit: string;
  unit_key: string;
  department: string;
  leave_type: string;
  status: string;
  days: number;
  start_date: string;
  end_date: string;
  applied_on: string;
  age_hours: number;
};

type AllocationRecord = {
  user: string;
  role: string;
  role_key: string;
  unit: string;
  unit_key: string;
  leave_type: string;
  year: number;
  total: number;
  used: number;
  remaining: number;
};

type DepartmentRecord = { name: string; unit: string; unit_key: string };
type FilterSpec = {
  resolvedQuestion: string;
  units: string[];
  roles: string[];
  statuses: string[];
  leaveTypes: string[];
  departments: string[];
  personName?: string;
  dateRange?: 'today' | 'tomorrow' | 'week' | 'month' | 'year' | 'upcoming';
  wantsCount: boolean;
  wantsList: boolean;
  wantsCompare: boolean;
};

type PortalContext = ReturnType<typeof buildContext>;

const unitLabel: Record<string, string> = {
  junior: 'Junior College',
  senior: 'Senior College',
  pharmacy: 'Pharmacy College',
};

const unitKeys = ['junior', 'senior', 'pharmacy'];
const currentYear = new Date().getFullYear();
const LIST_LIMIT = 10;

function norm(value: unknown) {
  return String(value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function unitKey(value: unknown) {
  const v = norm(value);
  if (v.includes('junior')) return 'junior';
  if (v.includes('senior')) return 'senior';
  if (v.includes('pharmacy') || v.includes('pharma')) return 'pharmacy';
  return '';
}

function unitName(value: unknown) {
  const key = unitKey(value);
  return key ? unitLabel[key] : 'Unit Not Assigned';
}

function roleLabel(profile: any) {
  const role = norm(profile?.role);
  const designation = norm(profile?.admin_designation);
  if (role === 'staff') return 'Staff';
  if (role === 'viewer') return 'Viewer';
  if (role === 'main_admin' || role === 'director') return 'Director';
  if (role === 'admin' || role === 'principal') {
    if (designation === 'principal') return 'Principal';
    if (designation === 'uh') return 'UH';
    return 'Principal / UH';
  }
  return clean(profile?.role);
}

function roleKey(profile: any) {
  const label = norm(roleLabel(profile));
  if (label === 'staff') return 'staff';
  if (label === 'principal') return 'principal';
  if (label === 'uh') return 'uh';
  if (label === 'director') return 'director';
  if (label === 'viewer') return 'viewer';
  return label || 'unknown';
}

function statusKey(value: unknown) {
  const v = norm(value);
  if (v.includes('pending')) return 'pending';
  if (v.includes('approved') || v.includes('accept')) return 'approved';
  if (v.includes('rejected') || v.includes('reject') || v.includes('declined')) return 'rejected';
  if (v.includes('past') || v.includes('inactive')) return 'past';
  return v || 'unknown';
}

function dateOnly(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function prettyDate(value: unknown) {
  if (!value || value === '-') return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateTime(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item) || 'Not Assigned';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function crossCount<T>(items: T[], first: (item: T) => string, second: (item: T) => string) {
  const output: Record<string, Record<string, number>> = {};
  for (const item of items) {
    const a = first(item) || 'Not Assigned';
    const b = second(item) || 'Not Assigned';
    output[a] ??= {};
    output[a][b] = (output[a][b] ?? 0) + 1;
  }
  return output;
}

function isActive(profile: any) {
  const activeText = norm(profile?.employment_status ?? 'active');
  return activeText !== 'past' && activeText !== 'inactive' && profile?.active !== false;
}

function overlapsRange(leave: LeaveRecord, start: Date, end: Date) {
  const leaveStart = new Date(`${leave.start_date}T00:00:00`);
  const leaveEnd = new Date(`${leave.end_date}T23:59:59`);
  if (Number.isNaN(leaveStart.getTime()) || Number.isNaN(leaveEnd.getTime())) return false;
  return leaveStart <= end && leaveEnd >= start;
}

function range(name: 'today' | 'tomorrow' | 'week' | 'month' | 'year' | 'upcoming') {
  const now = new Date();
  if (name === 'today') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) };
  if (name === 'tomorrow') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59) };
  if (name === 'week') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()), 23, 59, 59) };
  if (name === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  if (name === 'upcoming') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), 23, 59, 59) };
  return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
}

function isSensitiveRequest(question: string) {
  const q = norm(question);
  return /(password|passcode|otp|token|secret|api key|service role|anon key|email address|mail id|email id|mobile|phone|contact number|address|home address|personal address|salary|bank|account number|reason|medical reason|health|disease|diagnosis|private note|session|jwt|key)/.test(q);
}

function isPortalRelated(question: string) {
  const q = norm(question);
  if (/^(hi|hello|hey|thanks|thank you)$/.test(q)) return true;
  return /(leave|application|staff|employee|principal|uh|unit head|director|viewer|department|unit|junior|senior|pharmacy|registration|approval|pending|approved|rejected|allocation|balance|calendar|analytics|report|notification|holiday|today|tomorrow|week|month|year|portal|users?|dashboard|summary|count|total|who|which|how many|show|list|compare)/.test(q);
}

function buildContext(data: { profiles: any[]; leaves: any[]; allocations: any[]; departments: any[]; leaveTypes: any[]; holidays: any[]; notifications: any[] }) {
  const users: ProfileRecord[] = data.profiles.filter(isActive).map((p) => ({
    name: clean(p.full_name) === '-' ? 'Unknown' : clean(p.full_name),
    role: roleLabel(p),
    role_key: roleKey(p),
    unit: unitName(p.college_unit),
    unit_key: unitKey(p.college_unit),
    designation: clean(p.admin_designation),
    status: statusKey(p.approval_status),
    department: clean(p.department?.name),
    active_status: clean(p.employment_status ?? 'active'),
  }));

  const leaveApplications: LeaveRecord[] = data.leaves.map((leave) => {
    const staff = leave?.staff ?? {};
    const created = leave?.created_at ? new Date(String(leave.created_at)).getTime() : Date.now();
    return {
      applicant: clean(staff.full_name) === '-' ? 'Unknown' : clean(staff.full_name),
      role: roleLabel(staff),
      role_key: roleKey(staff),
      unit: unitName(staff.college_unit),
      unit_key: unitKey(staff.college_unit),
      department: clean(staff.department?.name),
      leave_type: clean(leave?.leave_type?.name),
      status: statusKey(leave?.status),
      days: Number(leave?.leave_days ?? 0),
      start_date: dateOnly(leave?.start_date),
      end_date: dateOnly(leave?.end_date),
      applied_on: dateTime(leave?.created_at),
      age_hours: Math.max(0, Math.round((Date.now() - created) / 36_000) / 10),
    };
  });

  const allocations: AllocationRecord[] = data.allocations.map((a) => {
    const staff = a?.staff ?? {};
    return {
      user: clean(staff.full_name) === '-' ? 'Unknown' : clean(staff.full_name),
      role: roleLabel(staff),
      role_key: roleKey(staff),
      unit: unitName(staff.college_unit),
      unit_key: unitKey(staff.college_unit),
      leave_type: clean(a?.leave_type?.name),
      year: Number(a?.year ?? currentYear),
      total: Number(a?.total_allocated ?? 0),
      used: Number(a?.used ?? 0),
      remaining: Number(a?.remaining ?? 0),
    };
  });

  const departments: DepartmentRecord[] = data.departments.map((d) => ({ name: clean(d.name), unit: unitName(d.college_unit), unit_key: unitKey(d.college_unit) }));
  const leaveTypes = data.leaveTypes.map((t) => ({ name: clean(t.name), default_days: Number(t.default_days ?? t.max_days ?? 0), active: t.is_active !== false }));
  const holidays = data.holidays.map((h) => ({ name: clean(h.name), date: dateOnly(h.date), unit: unitName(h.college_unit), unit_key: unitKey(h.college_unit) }));
  const notifications = data.notifications.map((n) => ({ title: clean(n.title), message: clean(n.message), read: Boolean(n.is_read), created_at: dateTime(n.created_at) })).slice(0, 80);

  const approvedLeaves = leaveApplications.filter((l) => l.status === 'approved');
  const pendingLeaves = leaveApplications.filter((l) => l.status === 'pending');
  const rejectedLeaves = leaveApplications.filter((l) => l.status === 'rejected');
  const pending24h = pendingLeaves.filter((l) => l.role_key === 'staff' && l.age_hours >= 24);
  const today = range('today');
  const week = range('week');
  const month = range('month');
  const todayOnLeave = approvedLeaves.filter((l) => overlapsRange(l, today.start, today.end));
  const weekOnLeave = approvedLeaves.filter((l) => overlapsRange(l, week.start, week.end));
  const monthApplications = leaveApplications.filter((l) => overlapsRange(l, month.start, month.end));
  const currentYearAllocations = allocations.filter((a) => a.year === currentYear);
  const lowBalance = currentYearAllocations.filter((a) => a.remaining <= 2).sort((a, b) => a.remaining - b.remaining).slice(0, 50);

  const analytics = {
    application_summary_all_years: {
      total: leaveApplications.length,
      approved: approvedLeaves.length,
      pending: pendingLeaves.length,
      rejected: rejectedLeaves.length,
    },
    application_summary_current_year: {
      total: leaveApplications.filter((l) => l.start_date.startsWith(String(currentYear))).length,
      approved: approvedLeaves.filter((l) => l.start_date.startsWith(String(currentYear))).length,
      pending: pendingLeaves.filter((l) => l.start_date.startsWith(String(currentYear))).length,
      rejected: rejectedLeaves.filter((l) => l.start_date.startsWith(String(currentYear))).length,
    },
    users: {
      total_active: users.length,
      by_unit: countBy(users, (u) => u.unit),
      by_role: countBy(users, (u) => u.role),
      by_status: countBy(users, (u) => u.status),
      by_unit_and_status: crossCount(users, (u) => u.unit, (u) => u.status),
      by_unit_and_role: crossCount(users, (u) => u.unit, (u) => u.role),
      pending_staff_by_unit: countBy(users.filter((u) => u.role_key === 'staff' && u.status === 'pending'), (u) => u.unit),
      approved_staff_by_unit: countBy(users.filter((u) => u.role_key === 'staff' && u.status === 'approved'), (u) => u.unit),
      principal_uh_by_unit: crossCount(users.filter((u) => ['principal', 'uh'].includes(u.role_key)), (u) => u.unit, (u) => u.role),
    },
    leaves: {
      by_unit: countBy(leaveApplications, (l) => l.unit),
      by_status: countBy(leaveApplications, (l) => l.status),
      by_type: countBy(leaveApplications, (l) => l.leave_type),
      by_unit_and_status: crossCount(leaveApplications, (l) => l.unit, (l) => l.status),
      by_unit_and_type: crossCount(leaveApplications, (l) => l.unit, (l) => l.leave_type),
      by_department: countBy(leaveApplications, (l) => `${l.unit} / ${l.department}`),
      by_department_status: crossCount(leaveApplications, (l) => `${l.unit} / ${l.department}`, (l) => l.status),
      by_applicant_role: countBy(leaveApplications, (l) => l.role),
      pending_older_than_24h_staff: pending24h.length,
      today_on_leave_count: todayOnLeave.length,
      this_week_on_leave_count: weekOnLeave.length,
      this_month_applications_count: monthApplications.length,
    },
    departments: {
      total: departments.length,
      by_unit: countBy(departments, (d) => d.unit),
      staff_count_by_department: countBy(users.filter((u) => u.role_key === 'staff'), (u) => `${u.unit} / ${u.department}`),
      user_count_by_department: countBy(users, (u) => `${u.unit} / ${u.department}`),
    },
    balances: {
      year: currentYear,
      low_balance_count: lowBalance.length,
      by_leave_type: countBy(currentYearAllocations, (a) => a.leave_type),
      low_balance_preview: lowBalance,
    },
    notifications: {
      loaded_recent: notifications.length,
      unread: notifications.filter((n) => !n.read).length,
    },
  };

  return { generated_at: new Date().toISOString(), analytics, users, leaveApplications, allocations: currentYearAllocations, departments, leaveTypes, holidays, notifications };
}

function lastUserQuestion(history: ChatHistoryMessage[]) {
  return [...history].reverse().find((m) => m.role === 'user' && m.text)?.text ?? '';
}

function resolveFollowUp(question: string, history: ChatHistoryMessage[]) {
  const q = norm(question);
  const last = lastUserQuestion(history);
  if (!last) return question;
  const hasTopic = /(staff|employee|principal|uh|director|viewer|leave|application|department|analytics|report|balance|notification|holiday|calendar|registration)/.test(q);
  const hasUnit = /(junior|senior|pharmacy|pharma)/.test(q);
  if (/^(what about|and|same for|for)\b/.test(q) || (!hasTopic && hasUnit)) return `${last}. Now answer for ${question}.`;
  return question;
}

function parseFilters(question: string, history: ChatHistoryMessage[], context: PortalContext): FilterSpec {
  const resolvedQuestion = resolveFollowUp(question, history);
  const q = norm(resolvedQuestion);
  const units = unitKeys.filter((u) => q.includes(u) || (u === 'pharmacy' && q.includes('pharma')));
  const roles: string[] = [];
  if (/staff|employee/.test(q)) roles.push('staff');
  if (/principal/.test(q)) roles.push('principal');
  if (/\buh\b|unit head/.test(q)) roles.push('uh');
  if (/director/.test(q)) roles.push('director');
  if (/viewer/.test(q)) roles.push('viewer');
  if (/(principal\s*(and|\/|&)?\s*uh|uh\s*(and|\/|&)?\s*principal|management)/.test(q)) {
    if (!roles.includes('principal')) roles.push('principal');
    if (!roles.includes('uh')) roles.push('uh');
  }

  const statuses: string[] = [];
  if (/pending|waiting|not approved/.test(q)) statuses.push('pending');
  if (/approved|accepted|active/.test(q)) statuses.push('approved');
  if (/rejected|declined/.test(q)) statuses.push('rejected');
  if (/past|inactive|old/.test(q)) statuses.push('past');

  const leaveTypes = context.leaveTypes.map((t: any) => norm(t.name)).filter((name: string) => name && q.includes(name));
  const departments = context.departments.map((d: any) => norm(d.name)).filter((name: string) => name && name !== '-' && q.includes(name));
  const possibleNames = [...context.users.map((u) => u.name), ...context.leaveApplications.map((l) => l.applicant)].filter((name) => name && name !== 'Unknown');
  const matchedName = possibleNames.find((name) => {
    const n = norm(name);
    if (n.length < 4) return false;
    if (q.includes(n)) return true;
    const parts = n.split(' ').filter((part) => part.length >= 3);
    return parts.length >= 2 && parts.every((part) => q.includes(part));
  });

  let dateRange: FilterSpec['dateRange'];
  if (/today/.test(q)) dateRange = 'today';
  else if (/tomorrow/.test(q)) dateRange = 'tomorrow';
  else if (/this week|week/.test(q)) dateRange = 'week';
  else if (/this month|month/.test(q)) dateRange = 'month';
  else if (/this year|year|annual/.test(q)) dateRange = 'year';
  else if (/upcoming|next/.test(q)) dateRange = 'upcoming';

  return {
    resolvedQuestion,
    units,
    roles: [...new Set(roles)],
    statuses: [...new Set(statuses)],
    leaveTypes,
    departments,
    personName: matchedName,
    dateRange,
    wantsCount: /(how many|count|total|number of|kitne|kiti)/.test(q),
    wantsList: /(show|list|who|which|details|records|display|give me)/.test(q),
    wantsCompare: /(most|highest|lowest|compare|unit wise|unit-wise|wise|breakdown|summary)/.test(q),
  };
}

function applyUserFilters(users: ProfileRecord[], filters: FilterSpec) {
  return users.filter((u) => {
    if (filters.units.length && !filters.units.includes(u.unit_key)) return false;
    if (filters.roles.length && !filters.roles.includes(u.role_key)) return false;
    if (filters.statuses.length && !filters.statuses.includes(u.status)) return false;
    if (filters.departments.length && !filters.departments.includes(norm(u.department))) return false;
    if (filters.personName && norm(u.name) !== norm(filters.personName)) return false;
    return true;
  });
}

function applyLeaveFilters(leaves: LeaveRecord[], filters: FilterSpec, statusOverride?: string[]) {
  return leaves.filter((l) => {
    if (filters.units.length && !filters.units.includes(l.unit_key)) return false;
    if (filters.roles.length && !filters.roles.includes(l.role_key)) return false;
    const statuses = statusOverride ?? filters.statuses;
    if (statuses.length && !statuses.includes(l.status)) return false;
    if (filters.departments.length && !filters.departments.includes(norm(l.department))) return false;
    if (filters.leaveTypes.length && !filters.leaveTypes.includes(norm(l.leave_type))) return false;
    if (filters.personName && norm(l.applicant) !== norm(filters.personName)) return false;
    if (filters.dateRange) {
      const r = range(filters.dateRange);
      if (!overlapsRange(l, r.start, r.end)) return false;
    }
    return true;
  });
}

function applyDepartmentFilters(departments: DepartmentRecord[], filters: FilterSpec) {
  return departments.filter((d) => {
    if (filters.units.length && !filters.units.includes(d.unit_key)) return false;
    if (filters.departments.length && !filters.departments.includes(norm(d.name))) return false;
    return true;
  });
}

function applyAllocationFilters(allocations: AllocationRecord[], filters: FilterSpec) {
  return allocations.filter((a) => {
    if (filters.units.length && !filters.units.includes(a.unit_key)) return false;
    if (filters.roles.length && !filters.roles.includes(a.role_key)) return false;
    if (filters.leaveTypes.length && !filters.leaveTypes.includes(norm(a.leave_type))) return false;
    if (filters.personName && norm(a.user) !== norm(filters.personName)) return false;
    return true;
  });
}

function formatRows<T>(items: T[], rowFn: (item: T, index: number) => string, totalLabel = 'records') {
  if (!items.length) return 'No matching records found.';
  const shown = items.slice(0, LIST_LIMIT);
  const lines = shown.map(rowFn);
  if (items.length > LIST_LIMIT) lines.push(`...and ${items.length - LIST_LIMIT} more ${totalLabel}. Please narrow by unit, status, department, or name for a shorter list.`);
  return lines.join('\n');
}

function formatCountMap(title: string, counts: Record<string, number>) {
  const entries = Object.entries(counts);
  if (!entries.length) return `${title}: No data.`;
  return [`${title}:`, ...entries.map(([key, value]) => `• ${key}: ${value}`)].join('\n');
}

function formatStatusSummary(items: { status: string }[]) {
  const c = countBy(items, (i) => i.status);
  return `Total: ${items.length}\nApproved: ${c.approved ?? 0}\nPending: ${c.pending ?? 0}\nRejected: ${c.rejected ?? 0}`;
}

function topic(question: string) {
  const q = norm(question);
  if (/department/.test(q)) return 'departments';
  if (/balance|allocation|low balance|remaining/.test(q)) return 'balances';
  if (/holiday/.test(q)) return 'holidays';
  if (/notification/.test(q)) return 'notifications';
  if (/analytics|report|dashboard|overall|summary/.test(q)) return 'analytics';
  if (/calendar|on leave|today|tomorrow|week|month|upcoming/.test(q) && /leave/.test(q)) return 'calendar';
  if (/leave|application/.test(q) && !/(registration|staff registration|principal registration|uh registration)/.test(q)) return 'leaves';
  if (/registration|staff|employee|principal|\buh\b|director|viewer|users?|approval/.test(q)) return 'users';
  return 'general';
}

function exactAnswer(context: PortalContext, question: string, history: ChatHistoryMessage[]) {
  const filters = parseFilters(question, history, context);
  const q = norm(filters.resolvedQuestion);
  const t = topic(filters.resolvedQuestion);

  if (/^(hi|hello|hey)$/.test(norm(question))) return 'Hi, ask me about LeaveSync portal data.';

  // Generic "applications" in Director portal can mean both registration approvals and leave applications.
  // When the user does not clearly say "leave" or "registration", show both safely.
  if (/application/.test(q) && !/leave/.test(q) && !/registration/.test(q)) {
    const users = applyUserFilters(context.users, filters);
    const leaves = applyLeaveFilters(context.leaveApplications, filters);
    const registrationCounts = countBy(users, (u) => u.unit);
    const leaveCounts = countBy(leaves, (l) => l.unit);
    if (/(unit wise|unit-wise|by unit|wise|breakdown)/.test(q)) {
      return [
        'Applications unit-wise:',
        '',
        'Registration applications/users:',
        ...unitKeys.filter((u) => !filters.units.length || filters.units.includes(u)).map((u) => `• ${unitLabel[u]}: ${registrationCounts[unitLabel[u]] ?? 0}`),
        '',
        'Leave applications:',
        ...unitKeys.filter((u) => !filters.units.length || filters.units.includes(u)).map((u) => `• ${unitLabel[u]}: ${leaveCounts[unitLabel[u]] ?? 0}`),
      ].join('\n');
    }
    return [
      'Applications summary:',
      `Registration applications/users: ${users.length}`,
      `Leave applications: ${leaves.length}`,
      '',
      'Registration status:',
      formatStatusSummary(users),
      '',
      'Leave status:',
      formatStatusSummary(leaves),
    ].join('\n');
  }

  if (t === 'departments') {
    const departments = applyDepartmentFilters(context.departments, filters);
    const staff = applyUserFilters(context.users, { ...filters, roles: ['staff'], statuses: [] });
    const users = applyUserFilters(context.users, { ...filters, roles: [], statuses: [] });
    const leaves = applyLeaveFilters(context.leaveApplications, { ...filters, statuses: [] });

    if (/application|leave/.test(q)) {
      const byDept = crossCount(leaves, (l) => `${l.unit} / ${l.department}`, (l) => l.status);
      const lines = Object.entries(byDept).map(([dept, statuses]) => `• ${dept}: Total ${Object.values(statuses).reduce((a, b) => a + b, 0)}, Approved ${statuses.approved ?? 0}, Pending ${statuses.pending ?? 0}, Rejected ${statuses.rejected ?? 0}`);
      return lines.length ? `Department-wise leave applications:\n${lines.join('\n')}` : 'No leave applications found for the selected department/unit filter.';
    }

    if (filters.wantsCount && filters.units.length) return `${unitLabel[filters.units[0]]} has ${departments.length} departments.`;

    const lines = [
      `Department summary${filters.units.length ? ` for ${filters.units.map((u) => unitLabel[u]).join(', ')}` : ''}:`,
      ...unitKeys.filter((u) => !filters.units.length || filters.units.includes(u)).map((u) => {
        const deptCount = departments.filter((d) => d.unit_key === u).length;
        const staffCount = staff.filter((s) => s.unit_key === u).length;
        const userCount = users.filter((s) => s.unit_key === u).length;
        return `• ${unitLabel[u]}: ${deptCount} departments, ${staffCount} staff, ${userCount} total users`;
      }),
    ];
    if (filters.wantsList || departments.length <= LIST_LIMIT) {
      lines.push('', 'Departments:');
      lines.push(formatRows(departments, (d) => `• ${d.name} (${d.unit})`, 'departments'));
    }
    return lines.join('\n');
  }

  if (t === 'balances') {
    let allocations = applyAllocationFilters(context.allocations, filters);
    if (/low|less|remaining|short|minimum/.test(q)) allocations = allocations.filter((a) => a.remaining <= 2).sort((a, b) => a.remaining - b.remaining);
    if (filters.wantsCount) return `Matching leave balance records: ${allocations.length}`;
    const grouped: Record<string, AllocationRecord[]> = {};
    for (const a of allocations) {
      const key = `${a.user} (${a.unit}, ${a.role})`;
      grouped[key] ??= [];
      grouped[key].push(a);
    }
    const entries = Object.entries(grouped).slice(0, LIST_LIMIT);
    if (!entries.length) return 'No matching leave balance records found.';
    const lines = entries.map(([person, rows]) => `• ${person}: ${rows.map((r) => `${r.leave_type} ${r.remaining}/${r.total} left`).join(', ')}`);
    if (Object.keys(grouped).length > LIST_LIMIT) lines.push(`...and ${Object.keys(grouped).length - LIST_LIMIT} more users. Please narrow by unit, role, or name.`);
    return `Leave balance summary for ${currentYear}:\n${lines.join('\n')}`;
  }

  if (t === 'calendar') {
    const status = /pending/.test(q) ? ['pending'] : ['approved'];
    const leaves = applyLeaveFilters(context.leaveApplications, filters, status);
    const label = filters.dateRange ? filters.dateRange.replace('upcoming', 'upcoming period') : 'selected period';
    if (filters.wantsCount && !filters.wantsList) return `${leaves.length} ${status[0]} leave records found for ${label}.`;
    return `${titleCase(status[0])} leaves for ${label}:\n${formatRows(leaves, (l) => `• ${l.applicant} (${l.unit}, ${l.role}) - ${l.leave_type}, ${prettyDate(l.start_date)} to ${prettyDate(l.end_date)} (${l.days} day${l.days === 1 ? '' : 's'})`, 'leave records')}`;
  }

  if (t === 'leaves') {
    let leaves = applyLeaveFilters(context.leaveApplications, filters);
    if (/older than 24|24 hour|24-hour|director review/.test(q)) leaves = leaves.filter((l) => l.status === 'pending' && l.role_key === 'staff' && l.age_hours >= 24);
    if (/most|highest/.test(q) && /pending/.test(q) && /unit/.test(q)) {
      const counts = countBy(leaves.filter((l) => l.status === 'pending'), (l) => l.unit);
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return top ? `${top[0]} has the most pending leave applications: ${top[1]}.\n\n${formatCountMap('Pending leaves unit-wise', counts)}` : 'No pending leave applications found.';
    }
    if (/(unit wise|unit-wise|by unit)/.test(q)) return formatCountMap('Leave applications unit-wise', countBy(leaves, (l) => l.unit));
    if (/(department wise|department-wise|by department)/.test(q)) return formatCountMap('Leave applications department-wise', countBy(leaves, (l) => `${l.unit} / ${l.department}`));
    if (/(leave type|type wise|by type|used most)/.test(q)) return formatCountMap('Leave type usage', countBy(leaves, (l) => l.leave_type));
    if (filters.wantsCount && !filters.wantsList) return `Matching leave applications: ${leaves.length}`;
    return `Leave applications:\n${formatStatusSummary(leaves)}\n\n${formatRows(leaves, (l) => `• ${l.applicant} (${l.unit}, ${l.role}) - ${l.leave_type}, ${l.status}, ${prettyDate(l.start_date)} to ${prettyDate(l.end_date)} (${l.days} day${l.days === 1 ? '' : 's'})`, 'leave applications')}`;
  }

  if (t === 'users') {
    const users = applyUserFilters(context.users, filters);
    if (/most|highest/.test(q) && /pending/.test(q) && /unit/.test(q)) {
      const counts = countBy(users.filter((u) => u.status === 'pending'), (u) => u.unit);
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return top ? `${top[0]} has the most pending registrations/users: ${top[1]}.\n\n${formatCountMap('Pending registrations/users unit-wise', counts)}` : 'No pending registrations/users found.';
    }
    if (/(unit wise|unit-wise|by unit)/.test(q)) return formatCountMap('Users unit-wise', countBy(users, (u) => u.unit));
    if (/(role wise|role-wise|by role)/.test(q)) return formatCountMap('Users role-wise', countBy(users, (u) => u.role));
    if (/(status wise|status-wise|by status)/.test(q)) return formatCountMap('Users status-wise', countBy(users, (u) => u.status));
    if (/(principal.*uh|uh.*principal|principal and uh)/.test(q)) {
      const mgmt = applyUserFilters(context.users, { ...filters, roles: ['principal', 'uh'] });
      const lines = unitKeys.filter((u) => !filters.units.length || filters.units.includes(u)).map((u) => {
        const items = mgmt.filter((m) => m.unit_key === u);
        return `• ${unitLabel[u]}: Principal ${items.filter((m) => m.role_key === 'principal').length}, UH ${items.filter((m) => m.role_key === 'uh').length}, Pending ${items.filter((m) => m.status === 'pending').length}, Approved ${items.filter((m) => m.status === 'approved').length}`;
      });
      return `Principal/UH status unit-wise:\n${lines.join('\n')}`;
    }
    const roleWord = filters.roles.length ? filters.roles.map((r) => r === 'uh' ? 'UH' : titleCase(r)).join('/') : 'users';
    const unitWord = filters.units.length ? ` in ${filters.units.map((u) => unitLabel[u]).join(', ')}` : '';
    const statusWord = filters.statuses.length ? `${filters.statuses.join('/')} ` : '';
    if (filters.wantsCount || !filters.wantsList) return `${statusWord}${roleWord}${unitWord}: ${users.length}`;
    return `${titleCase(statusWord)}${roleWord}${unitWord}:\n${formatStatusSummary(users)}\n\n${formatRows(users, (u) => `• ${u.name} (${u.unit}, ${u.role}, ${u.status}) - ${u.department}`, 'users')}`;
  }

  if (t === 'holidays') {
    const holidays = context.holidays.filter((h: any) => !filters.units.length || filters.units.includes(h.unit_key));
    return `Holidays:\n${formatRows(holidays, (h: any) => `• ${h.name} - ${prettyDate(h.date)} (${h.unit})`, 'holidays')}`;
  }

  if (t === 'notifications') {
    const n = context.notifications;
    return `Notifications loaded: ${n.length}\nUnread notifications: ${n.filter((x: any) => !x.read).length}\n\nRecent notifications:\n${formatRows(n, (item: any) => `• ${item.title} - ${item.created_at}`, 'notifications')}`;
  }

  // Analytics and general dashboard summary
  const a = context.analytics;
  const filteredLeaves = applyLeaveFilters(context.leaveApplications, filters);
  const filteredUsers = applyUserFilters(context.users, filters);
  const filteredDepartments = applyDepartmentFilters(context.departments, filters);
  const unitLines = unitKeys.filter((u) => !filters.units.length || filters.units.includes(u)).map((u) => {
    const unitLeaves = context.leaveApplications.filter((l) => l.unit_key === u);
    const unitUsers = context.users.filter((u2) => u2.unit_key === u);
    return `• ${unitLabel[u]}: Users ${unitUsers.length}, Departments ${context.departments.filter((d) => d.unit_key === u).length}, Leave Applications ${unitLeaves.length}, Approved Leaves ${unitLeaves.filter((l) => l.status === 'approved').length}, Pending Leaves ${unitLeaves.filter((l) => l.status === 'pending').length}, Rejected Leaves ${unitLeaves.filter((l) => l.status === 'rejected').length}`;
  });
  return [
    'LeaveSync portal analytics:',
    '',
    'Application Summary:',
    `Total: ${filteredLeaves.length || a.application_summary_all_years.total}`,
    `Approved: ${(filteredLeaves.length ? countBy(filteredLeaves, (l) => l.status).approved : a.application_summary_all_years.approved) ?? 0}`,
    `Pending: ${(filteredLeaves.length ? countBy(filteredLeaves, (l) => l.status).pending : a.application_summary_all_years.pending) ?? 0}`,
    `Rejected: ${(filteredLeaves.length ? countBy(filteredLeaves, (l) => l.status).rejected : a.application_summary_all_years.rejected) ?? 0}`,
    '',
    'Unit-wise Summary:',
    ...unitLines,
    '',
    `Users in selected filter: ${filteredUsers.length}`,
    `Departments in selected filter: ${filteredDepartments.length}`,
    '',
    formatCountMap('Leave type usage', countBy(filteredLeaves.length ? filteredLeaves : context.leaveApplications, (l) => l.leave_type)),
  ].join('\n');
}

async function callGeminiText(prompt: string, maxOutputTokens = 700) {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('FREE_AI_API_KEY');
  if (!apiKey) return null;
  const model = Deno.env.get('FREE_AI_MODEL') || 'gemini-1.5-flash-latest';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.02, topP: 0.3, maxOutputTokens },
    }),
  });
  if (!response.ok) {
    console.error('Gemini request failed:', response.status, await response.text());
    return null;
  }
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('\n').trim() || null;
}

async function polishAnswer(question: string, exact: string) {
  const prompt = `Rewrite this LeaveSync portal answer in simple Director-friendly language.\nDo not change any number, name, status, unit, date, or table line.\nDo not add new data.\nKeep it concise.\n\nQuestion: ${question}\n\nExact answer:\n${exact}`;
  return (await callGeminiText(prompt, 700)) || exact;
}

async function transcribeWithGemini(audioBase64: string, mimeType: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('FREE_AI_API_KEY');
  if (!apiKey) throw new Error('Voice question needs GEMINI_API_KEY in Supabase secrets.');
  const model = Deno.env.get('FREE_AI_MODEL') || 'gemini-1.5-flash-latest';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: 'Transcribe this audio into one short English question for a college leave management portal. Return only the transcription, no explanation.' },
          { inline_data: { mime_type: mimeType || 'audio/webm', data: audioBase64 } },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 120 },
    }),
  });
  if (!response.ok) throw new Error(`Voice transcription failed: ${response.status}`);
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join(' ').trim() || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return jsonResponse({ error: 'Supabase function secrets are missing.' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) return jsonResponse({ error: 'Please login again to use LeaveSync AI.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: caller, error: callerError } = await admin.from('profiles').select('id, role, approval_status').eq('id', userData.user.id).maybeSingle();
    if (callerError) throw callerError;
    const callerRole = norm(caller?.role);
    if (!['main_admin', 'director', 'viewer'].includes(callerRole)) {
      return jsonResponse({ error: 'LeaveSync AI Insights is available only for Director and Viewer portals.' }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    let question = clean(body.question);
    if (body.audioBase64) question = await transcribeWithGemini(body.audioBase64, clean(body.audioMimeType || 'audio/webm'));
    if (!question || question === '-') return jsonResponse({ error: 'Question is required.' }, 400);

    if (isSensitiveRequest(question)) {
      return jsonResponse({
        answer: 'For safety, I cannot show sensitive personal or system details such as contact numbers, email addresses, addresses, passwords, tokens, bank details, medical details, or detailed leave reasons. I can still help with safe Director/Viewer insights like counts, unit-wise summaries, departments, leave status, balances, and analytics.',
        transcript: body.audioBase64 ? question : undefined,
        generatedAt: new Date().toISOString(),
        mode: 'safety_guard',
      });
    }

    if (!isPortalRelated(question)) {
      return jsonResponse({
        answer: 'I can answer only LeaveSync portal questions, such as staff, Principal/UH, units, departments, leave applications, balances, calendar, notifications, and analytics reports.',
        transcript: body.audioBase64 ? question : undefined,
        generatedAt: new Date().toISOString(),
        mode: 'portal_only',
      });
    }

    const [profilesResult, leavesResult, allocationsResult, departmentsResult, leaveTypesResult, holidaysResult, notificationsResult] = await Promise.all([
      admin.from('profiles').select('id, full_name, role, approval_status, college_unit, admin_designation, employment_status, active, department:departments(name)').limit(5000),
      admin.from('leave_applications').select('id, status, leave_days, start_date, end_date, created_at, staff:profiles!leave_applications_staff_id_fkey(id, full_name, role, college_unit, admin_designation, employment_status, department:departments(name)), leave_type:leave_types(name)').order('created_at', { ascending: false }).limit(5000),
      admin.from('staff_leave_allocations').select('total_allocated, used, remaining, year, staff:profiles(id, full_name, role, college_unit, admin_designation, employment_status), leave_type:leave_types(name)').limit(8000),
      admin.from('departments').select('id, name, college_unit').order('college_unit', { ascending: true }).limit(1500),
      admin.from('leave_types').select('id, name, default_days, max_days, is_active').limit(500),
      admin.from('holidays').select('id, name, date, college_unit').order('date', { ascending: true }).limit(1000),
      admin.from('notifications').select('id, title, message, is_read, created_at').order('created_at', { ascending: false }).limit(500),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (leavesResult.error) throw leavesResult.error;
    if (allocationsResult.error) throw allocationsResult.error;
    if (departmentsResult.error) throw departmentsResult.error;
    if (leaveTypesResult.error) console.warn('Leave types skipped:', leaveTypesResult.error.message);
    if (holidaysResult.error) console.warn('Holidays skipped:', holidaysResult.error.message);
    if (notificationsResult.error) console.warn('Notifications skipped:', notificationsResult.error.message);

    const context = buildContext({
      profiles: profilesResult.data ?? [],
      leaves: leavesResult.data ?? [],
      allocations: allocationsResult.data ?? [],
      departments: departmentsResult.data ?? [],
      leaveTypes: leaveTypesResult.error ? [] : leaveTypesResult.data ?? [],
      holidays: holidaysResult.error ? [] : holidaysResult.data ?? [],
      notifications: notificationsResult.error ? [] : notificationsResult.data ?? [],
    });

    const exact = exactAnswer(context, question, history);
    const answer = await polishAnswer(question, exact);

    return jsonResponse({ answer, transcript: body.audioBase64 ? question : undefined, generatedAt: new Date().toISOString(), mode: 'deterministic_query_engine_plus_gemini_polish' });
  } catch (error) {
    console.error('ai-portal-insights failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
