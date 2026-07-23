import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type RequestBody = {
  question?: string;
};

const unitLabel: Record<string, string> = {
  junior: 'Junior College',
  senior: 'Senior College',
  pharmacy: 'Pharmacy College',
};

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function roleLabel(profile: any) {
  const role = String(profile?.role ?? '').toLowerCase();
  const designation = String(profile?.admin_designation ?? '').toLowerCase();

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

function formatUnit(unit: unknown) {
  const key = String(unit ?? '').toLowerCase();
  return unitLabel[key] ?? 'Unit Not Assigned';
}

function formatDate(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function personLine(profile: any) {
  return `${clean(profile?.full_name)} | ${roleLabel(profile)} | ${formatUnit(profile?.college_unit)} | ${clean(profile?.department?.name)} | ${clean(profile?.approval_status)}`;
}

function leaveLine(leave: any) {
  const staff = leave?.staff ?? {};
  return `${clean(staff.full_name)} | ${roleLabel(staff)} | ${formatUnit(staff.college_unit)} | ${clean(staff.department?.name)} | ${clean(leave?.leave_type?.name)} | ${clean(leave?.status)} | ${clean(leave?.leave_days)} day(s) | ${formatDate(leave?.start_date)} to ${formatDate(leave?.end_date)} | created ${formatDate(leave?.created_at)}`;
}

function allocationLine(allocation: any) {
  const staff = allocation?.staff ?? {};
  return `${clean(staff.full_name)} | ${roleLabel(staff)} | ${formatUnit(staff.college_unit)} | ${clean(allocation?.leave_type?.name)} | year ${clean(allocation?.year)} | total ${clean(allocation?.total_allocated)} | used ${clean(allocation?.used)} | remaining ${clean(allocation?.remaining)}`;
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function buildPortalContext(data: {
  profiles: any[];
  leaves: any[];
  allocations: any[];
  departments: any[];
}) {
  const { profiles, leaves, allocations, departments } = data;
  const activeProfiles = profiles.filter((p) => String(p.employment_status ?? 'active') !== 'past');
  const approvedProfiles = activeProfiles.filter((p) => p.approval_status === 'approved');
  const pendingProfiles = activeProfiles.filter((p) => p.approval_status === 'pending');
  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const approvedLeaves = leaves.filter((l) => l.status === 'approved');
  const rejectedLeaves = leaves.filter((l) => l.status === 'rejected');

  const now = new Date();
  const todayLeaves = approvedLeaves.filter((leave) => {
    const start = new Date(`${leave.start_date}T00:00:00`);
    const end = new Date(`${leave.end_date}T23:59:59`);
    return start <= now && end >= now;
  });

  const older24Cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pending24 = pendingLeaves.filter((leave) => {
    const staffRole = String(leave?.staff?.role ?? '').toLowerCase();
    return staffRole === 'staff' && new Date(leave.created_at) < older24Cutoff;
  });

  const unitRoleStatusCounts = activeProfiles.map((p) => ({
    name: clean(p.full_name),
    username: clean(p.username),
    email: clean(p.email),
    phone: clean(p.phone),
    role: roleLabel(p),
    raw_role: clean(p.role),
    status: clean(p.approval_status),
    unit: formatUnit(p.college_unit),
    raw_unit: clean(p.college_unit),
    designation: clean(p.admin_designation),
    department: clean(p.department?.name),
  }));

  const leaveRecords = leaves.map((leave) => ({
    applicant: clean(leave?.staff?.full_name),
    username: clean(leave?.staff?.username),
    role: roleLabel(leave?.staff),
    unit: formatUnit(leave?.staff?.college_unit),
    department: clean(leave?.staff?.department?.name),
    leave_type: clean(leave?.leave_type?.name),
    status: clean(leave?.status),
    leave_days: Number(leave?.leave_days ?? 0),
    start_date: clean(leave?.start_date),
    end_date: clean(leave?.end_date),
    created_at: clean(leave?.created_at),
  }));

  const allocationRecords = allocations.map((a) => ({
    user: clean(a?.staff?.full_name),
    username: clean(a?.staff?.username),
    role: roleLabel(a?.staff),
    unit: formatUnit(a?.staff?.college_unit),
    leave_type: clean(a?.leave_type?.name),
    year: Number(a?.year ?? new Date().getFullYear()),
    total_allocated: Number(a?.total_allocated ?? 0),
    used: Number(a?.used ?? 0),
    remaining: Number(a?.remaining ?? 0),
  }));

  const departmentRecords = departments.map((d) => ({
    name: clean(d.name),
    unit: formatUnit(d.college_unit),
    raw_unit: clean(d.college_unit),
  }));

  return {
    generated_at: new Date().toISOString(),
    current_year: new Date().getFullYear(),
    summary: {
      total_active_users: activeProfiles.length,
      total_approved_users: approvedProfiles.length,
      total_pending_registrations: pendingProfiles.length,
      total_leave_applications: leaves.length,
      pending_leave_applications: pendingLeaves.length,
      approved_leave_applications: approvedLeaves.length,
      rejected_leave_applications: rejectedLeaves.length,
      today_approved_leaves: todayLeaves.length,
      staff_leaves_pending_more_than_24_hours: pending24.length,
      departments_count: departments.length,
      active_users_by_raw_unit: countBy(activeProfiles, (p) => clean(p.college_unit)),
      approved_users_by_raw_unit: countBy(approvedProfiles, (p) => clean(p.college_unit)),
      pending_registrations_by_raw_unit: countBy(pendingProfiles, (p) => clean(p.college_unit)),
      pending_leaves_by_raw_unit: countBy(pendingLeaves, (l) => clean(l?.staff?.college_unit)),
      approved_leaves_by_raw_unit: countBy(approvedLeaves, (l) => clean(l?.staff?.college_unit)),
    },
    users: unitRoleStatusCounts,
    leave_applications: leaveRecords,
    leave_allocations: allocationRecords,
    departments: departmentRecords,
    compact_lists: {
      pending_registrations: pendingProfiles.slice(0, 80).map(personLine),
      pending_leaves: pendingLeaves.slice(0, 80).map(leaveLine),
      today_leaves: todayLeaves.slice(0, 80).map(leaveLine),
      pending_24_hour_staff_leaves: pending24.slice(0, 80).map(leaveLine),
      low_balance_allocations: allocations
        .filter((a) => Number(a.remaining ?? 0) <= 2)
        .slice(0, 80)
        .map(allocationLine),
    },
  };
}


function detectScope(question: string) {
  const q = question.toLowerCase();
  const unit = q.includes('junior') ? 'junior' : q.includes('senior') ? 'senior' : (q.includes('pharmacy') || q.includes('pharma')) ? 'pharmacy' : null;
  const status = q.includes('pending') || q.includes('waiting') ? 'pending' : q.includes('approved') ? 'approved' : q.includes('rejected') ? 'rejected' : null;
  const role = q.includes('principal') ? 'Principal' : (q.includes('uh') || q.includes('unit head')) ? 'UH' : (q.includes('staff') || q.includes('employee')) ? 'Staff' : null;
  const asksCount = /\b(how many|count|total|number of)\b/.test(q);
  const asksList = /\b(show|list|who|which|give me|details|names)\b/.test(q);
  const asksLeave = q.includes('leave') || q.includes('application') || q.includes('balance') || q.includes('allocation') || q.includes('today') || q.includes('week') || q.includes('month');
  const asksDepartment = q.includes('department');
  const asksUser = q.includes('staff') || q.includes('employee') || q.includes('principal') || q.includes('uh') || q.includes('user') || q.includes('registration');
  return { unit, status, role, asksCount, asksList, asksLeave, asksDepartment, asksUser };
}

function unitMatches(recordUnit: string, rawUnit: string | undefined, unit: string | null) {
  if (!unit) return true;
  return String(rawUnit ?? '').toLowerCase() === unit || String(recordUnit ?? '').toLowerCase().includes(unit);
}

function buildFocusedContext(question: string, context: any) {
  const scope = detectScope(question);
  const maxRows = 12;

  let matchedUsers = [...(context.users ?? [])];
  matchedUsers = matchedUsers.filter((u: any) => unitMatches(u.unit, u.raw_unit, scope.unit));
  if (scope.status) matchedUsers = matchedUsers.filter((u: any) => String(u.status).toLowerCase() === scope.status);
  if (scope.role) matchedUsers = matchedUsers.filter((u: any) => String(u.role).toLowerCase() === scope.role.toLowerCase());

  let matchedLeaves = [...(context.leave_applications ?? [])];
  matchedLeaves = matchedLeaves.filter((l: any) => unitMatches(l.unit, undefined, scope.unit));
  if (scope.status) matchedLeaves = matchedLeaves.filter((l: any) => String(l.status).toLowerCase() === scope.status);
  if (scope.role) matchedLeaves = matchedLeaves.filter((l: any) => String(l.role).toLowerCase() === scope.role.toLowerCase());

  let matchedAllocations = [...(context.leave_allocations ?? [])];
  matchedAllocations = matchedAllocations.filter((a: any) => unitMatches(a.unit, undefined, scope.unit));
  if (scope.role) matchedAllocations = matchedAllocations.filter((a: any) => String(a.role).toLowerCase() === scope.role.toLowerCase());

  let matchedDepartments = [...(context.departments ?? [])];
  matchedDepartments = matchedDepartments.filter((d: any) => unitMatches(d.unit, d.raw_unit, scope.unit));

  const userCounts = {
    total: matchedUsers.length,
    by_status: countBy(matchedUsers, (u: any) => String(u.status).toLowerCase()),
    by_role: countBy(matchedUsers, (u: any) => String(u.role)),
    by_unit: countBy(matchedUsers, (u: any) => String(u.unit)),
  };

  const leaveCounts = {
    total: matchedLeaves.length,
    by_status: countBy(matchedLeaves, (l: any) => String(l.status).toLowerCase()),
    by_role: countBy(matchedLeaves, (l: any) => String(l.role)),
    by_unit: countBy(matchedLeaves, (l: any) => String(l.unit)),
    by_leave_type: countBy(matchedLeaves, (l: any) => String(l.leave_type)),
  };

  return {
    generated_at: context.generated_at,
    current_year: context.current_year,
    interpreted_scope: scope,
    display_policy: {
      max_list_rows: maxRows,
      list_rule: 'Never print more than max_list_rows records. If there are more, show first max_list_rows and say how many more exist. For count questions, answer count only with one short explanation.',
      exact_question_rule: 'Answer only what the user asked. Do not add unrelated dashboard summaries.',
    },
    overall_summary: context.summary,
    matched_counts: {
      users: userCounts,
      leave_applications: leaveCounts,
      departments: matchedDepartments.length,
      allocations: matchedAllocations.length,
    },
    matched_samples: {
      users: matchedUsers.slice(0, maxRows),
      leave_applications: matchedLeaves.slice(0, maxRows),
      leave_allocations: matchedAllocations.slice(0, maxRows),
      departments: matchedDepartments.slice(0, maxRows),
    },
    has_more: {
      users: Math.max(0, matchedUsers.length - maxRows),
      leave_applications: Math.max(0, matchedLeaves.length - maxRows),
      leave_allocations: Math.max(0, matchedAllocations.length - maxRows),
      departments: Math.max(0, matchedDepartments.length - maxRows),
    },
  };
}

function fallbackAnswer(question: string, context: any) {
  const q = question.toLowerCase();
  const unit =
    q.includes('junior') ? 'junior' :
    q.includes('senior') ? 'senior' :
    q.includes('pharmacy') || q.includes('pharma') ? 'pharmacy' :
    null;

  const wantsPending = q.includes('pending') || q.includes('waiting');
  const wantsApproved = q.includes('approved');
  const wantsStaff = q.includes('staff') || q.includes('employee');
  const wantsPrincipal = q.includes('principal');
  const wantsUh = q.includes('uh') || q.includes('unit head');
  const wantsLeave = q.includes('leave') || q.includes('application');

  if (!wantsLeave && (wantsStaff || wantsPrincipal || wantsUh || q.includes('user') || q.includes('registration'))) {
    let users = context.users as any[];
    if (unit) users = users.filter((u) => String(u.raw_unit).toLowerCase() === unit);
    if (wantsPending) users = users.filter((u) => u.status === 'pending');
    if (wantsApproved) users = users.filter((u) => u.status === 'approved');
    if (wantsStaff) users = users.filter((u) => u.role === 'Staff');
    if (wantsPrincipal) users = users.filter((u) => u.role === 'Principal');
    if (wantsUh) users = users.filter((u) => u.role === 'UH');

    const unitText = unit ? formatUnit(unit) : 'all units';
    const statusText = wantsPending ? 'pending ' : wantsApproved ? 'approved ' : '';
    const roleText = wantsStaff ? 'staff' : wantsPrincipal ? 'principal' : wantsUh ? 'UH' : 'users';
    const sample = users.slice(0, 8).map((u) => `• ${u.name} (${u.unit}, ${u.role}, ${u.status})`).join('\n');
    const more = users.length > 8 ? `\n…and ${users.length - 8} more. Please ask with a unit/status/name filter for more details.` : '';

    if (q.includes('how many') || q.includes('count') || q.includes('total')) {
      return `${statusText}${roleText} in ${unitText}: ${users.length}`;
    }
    return `${statusText}${roleText} in ${unitText}: ${users.length}${sample ? `\n\n${sample}${more}` : ''}`;
  }

  if (wantsLeave) {
    let leaves = context.leave_applications as any[];
    if (unit) leaves = leaves.filter((l) => String(l.unit).toLowerCase().includes(unit));
    if (wantsPending) leaves = leaves.filter((l) => l.status === 'pending');
    if (wantsApproved) leaves = leaves.filter((l) => l.status === 'approved');

    const sample = leaves.slice(0, 8).map((l) => `• ${l.applicant} (${l.unit}, ${l.role}) - ${l.leave_type}, ${l.status}, ${l.start_date} to ${l.end_date}`).join('\n');
    const more = leaves.length > 8 ? `\n…and ${leaves.length - 8} more. Please ask with a unit/status/name filter for more details.` : '';
    if (q.includes('how many') || q.includes('count') || q.includes('total')) {
      return `Matching leave applications: ${leaves.length}`;
    }
    return `Matching leave applications: ${leaves.length}${sample ? `\n\n${sample}${more}` : ''}`;
  }

  return [
    `Current portal summary:`,
    `Active users: ${context.summary.total_active_users}`,
    `Approved users: ${context.summary.total_approved_users}`,
    `Pending registrations: ${context.summary.total_pending_registrations}`,
    `Pending leave applications: ${context.summary.pending_leave_applications}`,
    `Today approved leaves: ${context.summary.today_approved_leaves}`,
  ].join('\n');
}

async function callGemini(question: string, context: any) {
  const focusedContext = buildFocusedContext(question, context);
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('FREE_AI_API_KEY');
  if (!apiKey) {
    return fallbackAnswer(question, context);
  }

  const model = Deno.env.get('FREE_AI_MODEL') || 'gemini-1.5-flash-latest';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `
You are LeaveSync AI, a read-only assistant inside G.D. Sawant College Leave Management Portal.

Answer ONLY questions related to this portal data:
- users/staff/principal/UH/director/viewer
- Junior/Senior/Pharmacy units
- registrations and approval status
- departments
- leave applications
- leave balances/allocations
- pending requests and 24-hour Director review
- reports/analytics/calendar-style summaries

Rules:
1. Answer the user's exact question only. Do NOT dump full dashboard summaries unless the user asks for a full summary.
2. Use only the JSON portal context. Do not invent data.
3. If the question asks "how many", give the count first and keep the answer short.
4. If the question asks "show/list/who", show maximum 12 records. If more exist, say how many more and suggest narrowing by unit/status/person.
5. Never list all staff/users when count is large. Use counts and short grouped summaries unless names are explicitly requested.
6. If the question is not related to portal data, politely say you can only answer LeaveSync portal questions.
7. Keep answers clear for a college Director. Mention unit names clearly.
8. If data is missing or zero, say so clearly.
9. Use the focused context first. Use overall_summary only when the user asks broad/overall questions.

User question:
${question}

Portal context JSON:
${JSON.stringify(focusedContext)}
`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.7,
        maxOutputTokens: 900,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Free AI provider failed:', response.status, errorText);
    return fallbackAnswer(question, context);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('\n').trim() || fallbackAnswer(question, context);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: 'Supabase function secrets are missing.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: 'Please login again to use LeaveSync AI.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: caller, error: callerError } = await admin
      .from('profiles')
      .select('id, role, approval_status')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (callerError) throw callerError;

    const callerRole = String(caller?.role ?? '').toLowerCase();
    if (!['main_admin', 'director', 'viewer'].includes(callerRole)) {
      return jsonResponse({ error: 'LeaveSync AI Insights is available only for Director and Viewer portals.' }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const question = String(body.question ?? '').trim();

    if (!question) {
      return jsonResponse({ error: 'Question is required.' }, 400);
    }

    const [profilesResult, leavesResult, allocationsResult, departmentsResult] = await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, username, email, phone, role, approval_status, college_unit, admin_designation, employment_status, department:departments(name)')
        .limit(1200),
      admin
        .from('leave_applications')
        .select('id, status, leave_days, start_date, end_date, created_at, staff:profiles!leave_applications_staff_id_fkey(id, full_name, username, role, college_unit, admin_designation, employment_status, department:departments(name)), leave_type:leave_types(name)')
        .order('created_at', { ascending: false })
        .limit(1200),
      admin
        .from('staff_leave_allocations')
        .select('total_allocated, used, remaining, year, staff:profiles(id, full_name, username, role, college_unit, admin_designation, employment_status), leave_type:leave_types(name)')
        .limit(2000),
      admin
        .from('departments')
        .select('id, name, college_unit')
        .order('college_unit', { ascending: true })
        .limit(500),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (leavesResult.error) throw leavesResult.error;
    if (allocationsResult.error) throw allocationsResult.error;
    if (departmentsResult.error) throw departmentsResult.error;

    const context = buildPortalContext({
      profiles: profilesResult.data ?? [],
      leaves: leavesResult.data ?? [],
      allocations: allocationsResult.data ?? [],
      departments: departmentsResult.data ?? [],
    });

    const answer = await callGemini(question, context);

    return jsonResponse({
      answer,
      generatedAt: new Date().toISOString(),
      mode: Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('FREE_AI_API_KEY') ? 'free_ai' : 'fallback',
    });
  } catch (error) {
    console.error('ai-portal-insights failed:', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
