import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type ChatHistoryMessage = { role?: 'user' | 'assistant'; text?: string };
type RequestBody = {
  question?: string;
  history?: ChatHistoryMessage[];
  audioBase64?: string;
  audioMimeType?: string;
};

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

const unitLabel: Record<string, string> = {
  junior: 'Junior College',
  senior: 'Senior College',
  pharmacy: 'Pharmacy College',
};

const unitKeys = ['junior', 'senior', 'pharmacy'];
const currentYear = new Date().getFullYear();
const LIST_LIMIT = 12;

function norm(value: unknown) {
  return String(value ?? '').toLowerCase().trim();
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
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
  return label;
}

function statusKey(value: unknown) {
  const v = norm(value);
  if (v.includes('pending')) return 'pending';
  if (v.includes('approved')) return 'approved';
  if (v.includes('rejected')) return 'rejected';
  if (v.includes('past') || v.includes('inactive')) return 'past';
  return v || 'unknown';
}

function dateOnly(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
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
  return norm(profile?.employment_status ?? 'active') !== 'past' && profile?.active !== false;
}

function overlapsRange(leave: LeaveRecord, start: Date, end: Date) {
  const leaveStart = new Date(`${leave.start_date}T00:00:00`);
  const leaveEnd = new Date(`${leave.end_date}T23:59:59`);
  if (Number.isNaN(leaveStart.getTime()) || Number.isNaN(leaveEnd.getTime())) return false;
  return leaveStart <= end && leaveEnd >= start;
}

function range(name: 'today' | 'tomorrow' | 'week' | 'month' | 'year') {
  const now = new Date();
  if (name === 'today') {
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) };
  }
  if (name === 'tomorrow') {
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59) };
  }
  if (name === 'week') {
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()), 23, 59, 59) };
  }
  if (name === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  }
  return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
}

function redactName(value: string) {
  return value === '-' ? 'Unknown' : value;
}

function isSensitiveRequest(question: string) {
  const q = norm(question);
  return /(password|passcode|otp|token|secret|api key|service role|anon key|email address|mail id|mobile|phone|contact number|address|home address|personal address|salary|bank|account number|reason|medical reason|health|disease|diagnosis|private note)/.test(q);
}

function isPortalRelated(question: string) {
  const q = norm(question);
  if (/^(hi|hello|hey|thanks|thank you)$/.test(q)) return true;
  return /(leave|application|staff|employee|principal|uh|unit head|director|viewer|department|unit|junior|senior|pharmacy|registration|approval|pending|approved|rejected|allocation|balance|calendar|analytics|report|notification|holiday|today|tomorrow|week|month|year|portal|users?|dashboard)/.test(q);
}

function buildContext(data: { profiles: any[]; leaves: any[]; allocations: any[]; departments: any[]; leaveTypes: any[]; holidays: any[]; notifications: any[] }) {
  const users: ProfileRecord[] = data.profiles.filter(isActive).map((p) => ({
    name: redactName(clean(p.full_name)),
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
      applicant: redactName(clean(staff.full_name)),
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
      user: redactName(clean(staff.full_name)),
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

  const departments = data.departments.map((d) => ({
    name: clean(d.name),
    unit: unitName(d.college_unit),
    unit_key: unitKey(d.college_unit),
  }));

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
  const lowBalance = currentYearAllocations.filter((a) => a.remaining <= 2).sort((a, b) => a.remaining - b.remaining).slice(0, 30);

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

  return {
    generated_at: new Date().toISOString(),
    data_rules: {
      scope: 'Director/Viewer read-only portal data',
      list_limit: LIST_LIMIT,
      sensitive_policy: 'Do not reveal emails, phone numbers, addresses, passwords, tokens, API keys, bank details, health details, or detailed leave reasons.',
    },
    analytics,
    units: unitKeys.map((u) => unitLabel[u]),
    users,
    leaveApplications,
    allocations: currentYearAllocations,
    departments,
    leaveTypes,
    holidays,
    notifications,
  };
}

function relevantSample(context: any, question: string) {
  const q = norm(question);
  const units = unitKeys.filter((u) => q.includes(u) || (u === 'pharmacy' && q.includes('pharma')));
  const status = ['pending', 'approved', 'rejected'].filter((s) => q.includes(s));
  const roleHints = [
    { key: 'staff', re: /staff|employee/ },
    { key: 'principal', re: /principal/ },
    { key: 'uh', re: /\buh\b|unit head/ },
    { key: 'director', re: /director/ },
    { key: 'viewer', re: /viewer/ },
  ].filter((r) => r.re.test(q)).map((r) => r.key);

  const filter = (item: any) => {
    if (units.length && !units.includes(item.unit_key)) return false;
    if (status.length && item.status && !status.includes(item.status)) return false;
    if (roleHints.length && item.role_key && !roleHints.includes(item.role_key)) return false;
    return true;
  };

  return {
    matching_users: context.users.filter(filter).slice(0, 60),
    matching_leave_applications: context.leaveApplications.filter(filter).slice(0, 80),
    matching_allocations: context.allocations.filter(filter).slice(0, 80),
    matching_departments: context.departments.filter(filter).slice(0, 80),
  };
}

function buildSystemPrompt(context: any, question: string, history: ChatHistoryMessage[]) {
  return `You are LeaveSync AI, a read-only assistant inside the Director/Viewer portal of a college leave management system.

Your job:
1. Understand the user's natural language question first.
2. Answer ONLY from the JSON portal data provided below.
3. Give the exact answer for the asked unit/status/role/topic. Do not dump unrelated data.
4. If the question asks for analytics/report, present it like the Director analytics section: Application Summary table, Unit-wise/Department-wise breakdown, Leave Type usage, pending/approved/rejected counts as relevant.
5. If the question asks for a list and many rows match, show at most ${LIST_LIMIT} rows and mention how many more exist. Ask the user to narrow by unit/status/department/person if needed.
6. Support follow-up questions using the current chat history. Example: if previous question was Pharmacy pending staff and current question is "what about senior", answer Senior pending staff.
7. If the user asks for sensitive details such as email, phone number, address, password, API key, token, bank details, medical/health details, or detailed leave reasons, refuse politely and explain that the chatbot only shows safe portal insights. You may suggest opening the relevant secured portal page if they are authorized.
8. Never approve, reject, delete, edit, or perform any action. Only answer and guide.
9. If a question is not related to LeaveSync portal data, say you can answer only LeaveSync portal questions.
10. Keep wording simple and Director-friendly.

Chat history:
${JSON.stringify(history.slice(-8))}

User question:
${question}

Portal analytics and live records:
${JSON.stringify({
  generated_at: context.generated_at,
  data_rules: context.data_rules,
  analytics: context.analytics,
  relevant_records_for_this_question: relevantSample(context, question),
  records_available: {
    users: context.users.length,
    leaveApplications: context.leaveApplications.length,
    allocations: context.allocations.length,
    departments: context.departments.length,
    leaveTypes: context.leaveTypes.length,
    holidays: context.holidays.length,
    notifications: context.notifications.length,
  },
  all_records: {
    users: context.users,
    leaveApplications: context.leaveApplications,
    allocations: context.allocations,
    departments: context.departments,
    leaveTypes: context.leaveTypes,
    holidays: context.holidays,
    notifications: context.notifications,
  },
})}`;
}

async function callGeminiText(prompt: string, maxOutputTokens = 900) {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('FREE_AI_API_KEY');
  if (!apiKey) return null;
  const model = Deno.env.get('FREE_AI_MODEL') || 'gemini-1.5-flash-latest';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.05, topP: 0.4, maxOutputTokens },
    }),
  });
  if (!response.ok) {
    console.error('Gemini text request failed:', response.status, await response.text());
    return null;
  }
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('\n').trim() || null;
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

function fallbackAnswer(context: any, question: string) {
  const q = norm(question);
  if (/department/.test(q)) {
    return `Departments: ${context.departments.length}\n` + unitKeys.map((u) => `• ${unitLabel[u]}: ${context.departments.filter((d: any) => d.unit_key === u).length}`).join('\n');
  }
  if (/analytics|report|summary|dashboard/.test(q)) {
    const a = context.analytics;
    return [
      'Portal analytics summary:',
      `• Total applications: ${a.application_summary_all_years.total}`,
      `• Approved: ${a.application_summary_all_years.approved}`,
      `• Pending: ${a.application_summary_all_years.pending}`,
      `• Rejected: ${a.application_summary_all_years.rejected}`,
      '',
      'Unit-wise users:',
      ...Object.entries(a.users.by_unit).map(([k, v]) => `• ${k}: ${v}`),
      '',
      'Leave type usage:',
      ...Object.entries(a.leaves.by_type).map(([k, v]) => `• ${k}: ${v}`),
    ].join('\n');
  }
  if (/pending staff.*pharmacy|pharmacy.*pending staff|pending employee.*pharmacy|pharmacy.*pending employee/.test(q)) {
    return `Pharmacy College pending staff: ${context.users.filter((u: any) => u.unit_key === 'pharmacy' && u.role_key === 'staff' && u.status === 'pending').length}`;
  }
  return [
    'I can answer from LeaveSync portal data. Quick summary:',
    `• Active users: ${context.analytics.users.total_active}`,
    `• Total leave applications: ${context.analytics.application_summary_all_years.total}`,
    `• Pending registrations: ${context.analytics.users.by_status.pending ?? 0}`,
    `• Pending leaves: ${context.analytics.application_summary_all_years.pending}`,
    `• Departments: ${context.departments.length}`,
  ].join('\n');
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

    if (body.audioBase64) {
      question = await transcribeWithGemini(body.audioBase64, clean(body.audioMimeType || 'audio/webm'));
    }

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
      admin.from('profiles').select('id, full_name, role, approval_status, college_unit, admin_designation, employment_status, active, department:departments(name)').limit(3000),
      admin.from('leave_applications').select('id, status, leave_days, start_date, end_date, created_at, staff:profiles!leave_applications_staff_id_fkey(id, full_name, role, college_unit, admin_designation, employment_status, department:departments(name)), leave_type:leave_types(name)').order('created_at', { ascending: false }).limit(3000),
      admin.from('staff_leave_allocations').select('total_allocated, used, remaining, year, staff:profiles(id, full_name, role, college_unit, admin_designation, employment_status), leave_type:leave_types(name)').limit(5000),
      admin.from('departments').select('id, name, college_unit').order('college_unit', { ascending: true }).limit(1000),
      admin.from('leave_types').select('id, name, default_days, max_days, is_active').limit(300),
      admin.from('holidays').select('id, name, date, college_unit').order('date', { ascending: true }).limit(500),
      admin.from('notifications').select('id, title, message, is_read, created_at').order('created_at', { ascending: false }).limit(300),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (leavesResult.error) throw leavesResult.error;
    if (allocationsResult.error) throw allocationsResult.error;
    if (departmentsResult.error) throw departmentsResult.error;
    // Optional tables/columns should not break the chatbot.
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

    const prompt = buildSystemPrompt(context, question, history);
    const geminiAnswer = await callGeminiText(prompt, 1100);
    const answer = geminiAnswer || fallbackAnswer(context, question);

    return jsonResponse({
      answer,
      transcript: body.audioBase64 ? question : undefined,
      generatedAt: new Date().toISOString(),
      mode: geminiAnswer ? 'gemini_live_portal_context' : 'deterministic_fallback',
    });
  } catch (error) {
    console.error('ai-portal-insights failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
