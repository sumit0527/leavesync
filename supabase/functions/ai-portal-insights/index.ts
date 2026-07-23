import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type ChatHistoryMessage = { role?: 'user' | 'assistant'; text?: string };
type RequestBody = { question?: string; history?: ChatHistoryMessage[] };

type Scope = {
  units: string[];
  roles: string[];
  statuses: string[];
  topics: string[];
  dateRange: 'today' | 'tomorrow' | 'week' | 'month' | 'year' | null;
  wantsCount: boolean;
  wantsList: boolean;
  wantsNames: boolean;
  wantsSummary: boolean;
  wantsCompare: boolean;
  wantsLowBalance: boolean;
  wantsOldPending: boolean;
  wantsHighest: boolean;
  wantsBreakdown: boolean;
  personQuery: string | null;
  leaveTypeQuery: string | null;
};

const unitLabel: Record<string, string> = {
  junior: 'Junior College',
  senior: 'Senior College',
  pharmacy: 'Pharmacy College',
};

const allUnits = ['junior', 'senior', 'pharmacy'];
const maxListRows = 10;

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function norm(value: unknown) {
  return String(value ?? '').toLowerCase().trim();
}

function formatUnit(unit: unknown) {
  const key = norm(unit);
  return unitLabel[key] ?? 'Unit Not Assigned';
}

function unitKey(value: unknown) {
  const v = norm(value);
  if (v.includes('junior')) return 'junior';
  if (v.includes('senior')) return 'senior';
  if (v.includes('pharmacy') || v.includes('pharma')) return 'pharmacy';
  return v === '-' ? '' : v;
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

function roleKeyFromLabel(label: string) {
  const value = norm(label);
  if (value.includes('staff')) return 'staff';
  if (value === 'principal') return 'principal';
  if (value === 'uh' || value.includes('unit head')) return 'uh';
  if (value.includes('director')) return 'director';
  if (value.includes('viewer')) return 'viewer';
  return value;
}

function statusKey(value: unknown) {
  const v = norm(value);
  if (v.includes('pending') || v.includes('waiting')) return 'pending';
  if (v.includes('approved') || v.includes('accept')) return 'approved';
  if (v.includes('reject') || v.includes('decline')) return 'rejected';
  if (v.includes('past') || v.includes('old') || v.includes('inactive')) return 'past';
  return v;
}

function formatDate(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return { start, end };
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item) || 'Not Assigned';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function tableFromCounts(title: string, counts: Record<string, number>) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return `${title}: 0`;
  return `${title}:\n${entries.map(([key, value]) => `• ${key}: ${value}`).join('\n')}`;
}

function listPreview<T>(items: T[], lineFn: (item: T, index: number) => string, emptyText = 'No matching records found.') {
  if (!items.length) return emptyText;
  const shown = items.slice(0, maxListRows).map(lineFn).join('\n');
  const more = items.length > maxListRows ? `\n…and ${items.length - maxListRows} more. Please narrow by unit, status, department, leave type, or person name.` : '';
  return `${shown}${more}`;
}

function isActiveProfile(profile: any) {
  return norm(profile.employment_status ?? 'active') !== 'past' && profile.active !== false;
}

function buildPortalContext(data: { profiles: any[]; leaves: any[]; allocations: any[]; departments: any[]; notifications: any[] }) {
  const users = data.profiles.filter(isActiveProfile).map((p) => ({
    id: clean(p.id),
    name: clean(p.full_name),
    username: clean(p.username),
    email: clean(p.email),
    phone: clean(p.phone),
    role: roleLabel(p),
    role_key: roleKeyFromLabel(roleLabel(p)),
    raw_role: clean(p.role),
    status: statusKey(p.approval_status),
    unit_key: unitKey(p.college_unit),
    unit: formatUnit(p.college_unit),
    designation: clean(p.admin_designation),
    department: clean(p.department?.name),
  }));

  const leaveApplications = data.leaves.map((leave) => {
    const staff = leave?.staff ?? {};
    return {
      id: clean(leave.id),
      applicant: clean(staff.full_name),
      username: clean(staff.username),
      role: roleLabel(staff),
      role_key: roleKeyFromLabel(roleLabel(staff)),
      unit_key: unitKey(staff.college_unit),
      unit: formatUnit(staff.college_unit),
      department: clean(staff.department?.name),
      leave_type: clean(leave?.leave_type?.name),
      status: statusKey(leave?.status),
      leave_days: Number(leave?.leave_days ?? 0),
      start_date: clean(leave?.start_date),
      end_date: clean(leave?.end_date),
      created_at: clean(leave?.created_at),
    };
  });

  const allocations = data.allocations.map((a) => {
    const staff = a?.staff ?? {};
    return {
      user: clean(staff.full_name),
      username: clean(staff.username),
      role: roleLabel(staff),
      role_key: roleKeyFromLabel(roleLabel(staff)),
      unit_key: unitKey(staff.college_unit),
      unit: formatUnit(staff.college_unit),
      leave_type: clean(a?.leave_type?.name),
      year: Number(a?.year ?? new Date().getFullYear()),
      total_allocated: Number(a?.total_allocated ?? 0),
      used: Number(a?.used ?? 0),
      remaining: Number(a?.remaining ?? 0),
    };
  });

  const departments = data.departments.map((d) => ({
    id: clean(d.id),
    name: clean(d.name),
    unit_key: unitKey(d.college_unit),
    unit: formatUnit(d.college_unit),
  }));

  const notifications = data.notifications.map((n) => ({
    id: clean(n.id),
    title: clean(n.title),
    message: clean(n.message),
    is_read: Boolean(n.is_read),
    created_at: clean(n.created_at),
  }));

  return { generated_at: new Date().toISOString(), current_year: new Date().getFullYear(), users, leaveApplications, allocations, departments, notifications };
}

function combineWithHistory(question: string, history: ChatHistoryMessage[] = []) {
  const current = question.trim();
  const hasUnit = /\b(junior|senior|pharmacy|pharma)\b/i.test(current);
  const hasTopic = /\b(staff|employee|principal|uh|unit head|director|viewer|leave|application|balance|allocation|department|registration|user|notification|today|week|month|year)\b/i.test(current);
  if (hasUnit && hasTopic) return current;

  const lastUser = [...history].reverse().find((m) => m.role === 'user' && m.text && m.text.trim().toLowerCase() !== current.toLowerCase())?.text ?? '';
  if (!lastUser) return current;

  const carryParts: string[] = [];
  if (!hasUnit) {
    const match = lastUser.match(/\b(junior|senior|pharmacy|pharma)\b/i);
    if (match) carryParts.push(match[1].toLowerCase() === 'pharma' ? 'pharmacy' : match[1]);
  }
  if (!hasTopic) {
    const topic = lastUser.match(/\b(staff|employee|principal|uh|unit head|director|viewer|leave|application|balance|allocation|department|registration|user|notification)\b/i);
    if (topic) carryParts.push(topic[1]);
  }
  return carryParts.length ? `${current} (${carryParts.join(' ')})` : current;
}

function detectScope(question: string): Scope {
  const q = norm(question);
  const units = allUnits.filter((u) => q.includes(u) || (u === 'pharmacy' && q.includes('pharma')));
  const roles: string[] = [];
  if (/\bstaff\b|\bemployee(s)?\b/.test(q)) roles.push('staff');
  if (/\bprincipal(s)?\b/.test(q)) roles.push('principal');
  if (/\buh\b|unit head/.test(q)) roles.push('uh');
  if (/\bdirector(s)?\b/.test(q)) roles.push('director');
  if (/\bviewer(s)?\b/.test(q)) roles.push('viewer');

  const statuses: string[] = [];
  if (/pending|waiting|not approved|approval waiting/.test(q)) statuses.push('pending');
  if (/approved|accepted|active/.test(q)) statuses.push('approved');
  if (/rejected|declined/.test(q)) statuses.push('rejected');
  if (/old|past|inactive/.test(q)) statuses.push('past');

  const topics: string[] = [];
  if (/department/.test(q)) topics.push('departments');
  if (/balance|allocation|remaining|used leave|leave used|low balance/.test(q)) topics.push('allocations');
  if (/leave|application|on leave|today|tomorrow|week|month|year|24 hour|24-hour/.test(q)) topics.push('leaves');
  if (/staff|employee|principal|uh|director|viewer|user|registration|account/.test(q)) topics.push('users');
  if (/notification|unread|read/.test(q)) topics.push('notifications');
  if (/summary|overview|dashboard|status|insight|statistics|analytics/.test(q)) topics.push('summary');

  let dateRange: Scope['dateRange'] = null;
  if (/today|currently|now/.test(q)) dateRange = 'today';
  else if (/tomorrow/.test(q)) dateRange = 'tomorrow';
  else if (/this week|week/.test(q)) dateRange = 'week';
  else if (/this month|month/.test(q)) dateRange = 'month';
  else if (/this year|year|annual/.test(q)) dateRange = 'year';

  const personMatch = question.match(/(?:of|for|about|name|named)\s+([A-Za-z][A-Za-z\s.]{2,40})/i);
  const leaveTypeMatch = question.match(/(casual|medical|sick|earned|maternity|paternity|emergency|half day|half-day|paid|unpaid)[\w\s-]*leave/i);

  return {
    units,
    roles,
    statuses,
    topics,
    dateRange,
    wantsCount: /\b(how many|count|total|number of|kitne| कितने)\b/.test(q),
    wantsList: /\b(show|list|who|which|give me|details|names|display|find)\b/.test(q),
    wantsNames: /\b(name|names|who|list)\b/.test(q),
    wantsSummary: /summary|overview|dashboard|status|insight|brief/.test(q),
    wantsCompare: /compare|unit-wise|unit wise|wise|breakdown|which unit/.test(q),
    wantsLowBalance: /low balance|less balance|remaining|balance below|balance less|allocation over|insufficient/.test(q),
    wantsOldPending: /24 hour|24-hour|older than 24|director review|not take action|no action/.test(q),
    wantsHighest: /most|highest|maximum|top/.test(q),
    wantsBreakdown: /breakdown|unit-wise|unit wise|wise|separate|by unit|by department|by leave type/.test(q),
    personQuery: personMatch?.[1]?.trim() ?? null,
    leaveTypeQuery: leaveTypeMatch?.[0]?.trim().toLowerCase() ?? null,
  };
}

function matchesScope(item: any, scope: Scope, type: 'user' | 'leave' | 'allocation' | 'department' | 'notification') {
  if (scope.units.length && !scope.units.includes(item.unit_key)) return false;
  if (scope.roles.length && 'role_key' in item && !scope.roles.includes(item.role_key)) return false;
  if (scope.statuses.length && 'status' in item && !scope.statuses.includes(item.status)) return false;
  if (scope.personQuery) {
    const haystack = `${item.name ?? ''} ${item.applicant ?? ''} ${item.user ?? ''} ${item.username ?? ''} ${item.email ?? ''}`.toLowerCase();
    if (!haystack.includes(scope.personQuery.toLowerCase())) return false;
  }
  if (scope.leaveTypeQuery && (type === 'leave' || type === 'allocation')) {
    if (!norm(item.leave_type).includes(scope.leaveTypeQuery.replace('leave', '').trim())) return false;
  }
  return true;
}

function filterByDateRange(leaves: any[], dateRange: Scope['dateRange']) {
  if (!dateRange) return leaves;
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);
  if (dateRange === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (dateRange === 'tomorrow') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
  } else if (dateRange === 'week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()), 23, 59, 59);
  } else if (dateRange === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (dateRange === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }
  return leaves.filter((leave) => {
    const range = daysBetween(leave.start_date, leave.end_date);
    if (!range) return false;
    return range.start <= end && range.end >= start;
  });
}

function lineUser(u: any) {
  return `• ${u.name} (${u.unit}, ${u.role}, ${u.status}, ${u.department})`;
}

function lineLeave(l: any) {
  return `• ${l.applicant} (${l.unit}, ${l.role}) — ${l.leave_type}, ${l.status}, ${l.leave_days} day(s), ${formatDate(l.start_date)} to ${formatDate(l.end_date)}`;
}

function lineAllocation(a: any) {
  return `• ${a.user} (${a.unit}, ${a.role}) — ${a.leave_type}: remaining ${a.remaining}/${a.total_allocated}, used ${a.used}, year ${a.year}`;
}

function lineDepartment(d: any) {
  return `• ${d.name} (${d.unit})`;
}

function isPortalRelated(question: string) {
  const q = norm(question);
  if (/^(hi|hello|hey|thanks|thank you)$/.test(q)) return true;
  return /leave|staff|employee|principal|uh|director|viewer|department|unit|junior|senior|pharmacy|registration|approval|pending|approved|rejected|allocation|balance|calendar|analytics|report|notification|today|week|month|portal|users?/.test(q);
}

function deterministicAnswer(question: string, context: any, history: ChatHistoryMessage[] = []) {
  const enrichedQuestion = combineWithHistory(question, history);
  const q = norm(enrichedQuestion);
  const scope = detectScope(enrichedQuestion);

  if (!isPortalRelated(enrichedQuestion)) {
    return 'I can answer questions only about LeaveSync portal data such as users, units, departments, registrations, leave applications, leave balances, notifications, and reports.';
  }

  if (/^(hi|hello|hey)/.test(q)) {
    return 'Hello. Ask me about LeaveSync users, units, registrations, leaves, balances, departments, or reports.';
  }

  let users = context.users.filter((u: any) => matchesScope(u, scope, 'user'));
  let leaves = context.leaveApplications.filter((l: any) => matchesScope(l, scope, 'leave'));
  let allocations = context.allocations.filter((a: any) => matchesScope(a, scope, 'allocation'));
  let departments = context.departments.filter((d: any) => matchesScope(d, scope, 'department'));
  const notifications = context.notifications;

  if (scope.wantsOldPending) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    leaves = leaves.filter((l: any) => l.status === 'pending' && l.role_key === 'staff' && new Date(l.created_at) < cutoff);
    if (scope.wantsCount) return `Staff leave requests pending for more than 24 hours: ${leaves.length}`;
    return `Staff leave requests pending for more than 24 hours: ${leaves.length}${leaves.length ? `\n\n${listPreview(leaves, lineLeave)}` : ''}`;
  }

  if (scope.wantsLowBalance || scope.topics.includes('allocations')) {
    const currentYear = context.current_year;
    allocations = allocations.filter((a: any) => a.year === currentYear);
    if (scope.wantsLowBalance) allocations = allocations.filter((a: any) => a.remaining <= 2);
    if (scope.wantsCount) return `Matching leave balance records: ${allocations.length}`;
    if (scope.wantsBreakdown || scope.wantsCompare) {
      return [
        tableFromCounts('Leave balance records by unit', countBy(allocations, (a: any) => a.unit)),
        tableFromCounts('Leave balance records by leave type', countBy(allocations, (a: any) => a.leave_type)),
      ].join('\n\n');
    }
    return `Matching leave balance records: ${allocations.length}${allocations.length ? `\n\n${listPreview(allocations, lineAllocation)}` : ''}`;
  }

  if (scope.topics.includes('departments')) {
    if (scope.wantsCount) return `Matching departments: ${departments.length}`;
    if (scope.wantsBreakdown || scope.wantsCompare) return tableFromCounts('Departments by unit', countBy(departments, (d: any) => d.unit));
    return `Matching departments: ${departments.length}${departments.length ? `\n\n${listPreview(departments, lineDepartment)}` : ''}`;
  }

  if (scope.topics.includes('notifications')) {
    const unread = notifications.filter((n: any) => !n.is_read);
    if (scope.wantsCount) return `Unread notifications: ${unread.length}\nTotal recent notifications loaded: ${notifications.length}`;
    return `Recent notifications: ${notifications.length}\nUnread notifications: ${unread.length}${notifications.length ? `\n\n${listPreview(notifications, (n: any) => `• ${n.title} — ${n.message} (${n.is_read ? 'read' : 'unread'})`)}` : ''}`;
  }

  const explicitlyUser = scope.topics.includes('users') && !scope.topics.includes('leaves');
  const explicitlyLeave = scope.topics.includes('leaves') || /on leave|leave application|leave request|approved leave|pending leave/.test(q);

  if (explicitlyLeave) {
    leaves = filterByDateRange(leaves, scope.dateRange);
    if (/on leave|currently|today/.test(q) && !scope.statuses.length) leaves = leaves.filter((l: any) => l.status === 'approved');

    if (scope.wantsHighest || /most/.test(q)) {
      if (/unit/.test(q)) return tableFromCounts('Leave applications by unit', countBy(leaves, (l: any) => l.unit));
      if (/type/.test(q)) return tableFromCounts('Leave applications by leave type', countBy(leaves, (l: any) => l.leave_type));
      if (/person|staff|employee|principal|uh/.test(q)) return tableFromCounts('Leave applications by person', countBy(leaves, (l: any) => `${l.applicant} (${l.unit})`));
    }

    if (scope.wantsBreakdown || scope.wantsCompare) {
      return [
        tableFromCounts('Leave applications by unit', countBy(leaves, (l: any) => l.unit)),
        tableFromCounts('Leave applications by status', countBy(leaves, (l: any) => l.status)),
        tableFromCounts('Leave applications by leave type', countBy(leaves, (l: any) => l.leave_type)),
      ].join('\n\n');
    }

    if (scope.wantsCount) return `Matching leave applications: ${leaves.length}`;
    return `Matching leave applications: ${leaves.length}${leaves.length ? `\n\n${listPreview(leaves, lineLeave)}` : ''}`;
  }

  if (explicitlyUser) {
    if (scope.wantsHighest || /which unit/.test(q)) return tableFromCounts('Users by unit', countBy(users, (u: any) => u.unit));
    if (scope.wantsBreakdown || scope.wantsCompare) {
      return [
        tableFromCounts('Users by unit', countBy(users, (u: any) => u.unit)),
        tableFromCounts('Users by role', countBy(users, (u: any) => u.role)),
        tableFromCounts('Users by status', countBy(users, (u: any) => u.status)),
      ].join('\n\n');
    }
    if (scope.wantsCount) return `Matching users: ${users.length}`;
    return `Matching users: ${users.length}${users.length ? `\n\n${listPreview(users, lineUser)}` : ''}`;
  }

  const activeUsers = context.users;
  const approvedUsers = activeUsers.filter((u: any) => u.status === 'approved');
  const pendingUsers = activeUsers.filter((u: any) => u.status === 'pending');
  const pendingLeaves = context.leaveApplications.filter((l: any) => l.status === 'pending');
  const todayLeaves = filterByDateRange(context.leaveApplications, 'today').filter((l: any) => l.status === 'approved');

  return [
    'LeaveSync portal summary:',
    `• Active users: ${activeUsers.length}`,
    `• Approved users: ${approvedUsers.length}`,
    `• Pending registrations: ${pendingUsers.length}`,
    `• Pending leave applications: ${pendingLeaves.length}`,
    `• Approved users on leave today: ${todayLeaves.length}`,
    '',
    tableFromCounts('Active users by unit', countBy(activeUsers, (u: any) => u.unit)),
    '',
    'Ask with a specific unit/status/role for a shorter answer, for example: “pending staff in pharmacy”.',
  ].join('\n');
}

async function polishWithGemini(question: string, deterministic: string, contextMeta: any) {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('FREE_AI_API_KEY');
  if (!apiKey) return deterministic;

  const model = Deno.env.get('FREE_AI_MODEL') || 'gemini-1.5-flash-latest';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = `
You are LeaveSync AI for a college leave portal. Rewrite the engine answer below into a clear, helpful Director-friendly response.

Hard rules:
- Do NOT change any number, name, unit, status, date, or leave type from the engine answer.
- Do NOT add new data or unrelated summary.
- Keep it concise.
- If the engine answer has bullet points, keep bullet points.
- If it says no records, say that clearly.

User question: ${question}
Portal metadata: ${JSON.stringify(contextMeta)}
Engine answer that must remain factually unchanged:
${deterministic}
`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.05, topP: 0.5, maxOutputTokens: 700 },
      }),
    });
    if (!response.ok) {
      console.error('Free AI provider failed:', response.status, await response.text());
      return deterministic;
    }
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('\n').trim() || deterministic;
  } catch (error) {
    console.error('Free AI provider request failed:', error);
    return deterministic;
  }
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
    const question = clean(body.question);
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    if (!question || question === '-') return jsonResponse({ error: 'Question is required.' }, 400);

    const [profilesResult, leavesResult, allocationsResult, departmentsResult, notificationsResult] = await Promise.all([
      admin.from('profiles').select('id, full_name, username, email, phone, role, approval_status, college_unit, admin_designation, employment_status, active, department:departments(name)').limit(1500),
      admin.from('leave_applications').select('id, status, leave_days, start_date, end_date, created_at, staff:profiles!leave_applications_staff_id_fkey(id, full_name, username, role, college_unit, admin_designation, employment_status, department:departments(name)), leave_type:leave_types(name)').order('created_at', { ascending: false }).limit(1500),
      admin.from('staff_leave_allocations').select('total_allocated, used, remaining, year, staff:profiles(id, full_name, username, role, college_unit, admin_designation, employment_status), leave_type:leave_types(name)').limit(2500),
      admin.from('departments').select('id, name, college_unit').order('college_unit', { ascending: true }).limit(700),
      admin.from('notifications').select('id, title, message, is_read, created_at').order('created_at', { ascending: false }).limit(300),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (leavesResult.error) throw leavesResult.error;
    if (allocationsResult.error) throw allocationsResult.error;
    if (departmentsResult.error) throw departmentsResult.error;
    // Notifications table may be absent in older deployments. Do not fail the AI for that.
    if (notificationsResult.error) console.warn('Notifications context skipped:', notificationsResult.error.message);

    const context = buildPortalContext({
      profiles: profilesResult.data ?? [],
      leaves: leavesResult.data ?? [],
      allocations: allocationsResult.data ?? [],
      departments: departmentsResult.data ?? [],
      notifications: notificationsResult.error ? [] : notificationsResult.data ?? [],
    });

    const engineAnswer = deterministicAnswer(question, context, history);
    const answer = await polishWithGemini(question, engineAnswer, {
      generated_at: context.generated_at,
      source: 'deterministic portal engine + live Supabase data',
      chat_memory: 'last few messages only; cleared on browser refresh',
    });

    return jsonResponse({
      answer,
      generatedAt: new Date().toISOString(),
      mode: Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('FREE_AI_API_KEY') ? 'free_ai_polished' : 'deterministic_free',
    });
  } catch (error) {
    console.error('ai-portal-insights failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
