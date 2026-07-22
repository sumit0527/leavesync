import { useMemo, useRef, useState } from 'react';
import { Bot, Send, X, RefreshCw, Sparkles, Minimize2 } from 'lucide-react';
import { format, isAfter, isBefore, parseISO, startOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/db/supabase';
import { formatCollegeUnit, formatRoleForManagement } from '@/lib/college-units';

type ChatRole = 'assistant' | 'user';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  approval_status?: string | null;
  college_unit?: string | null;
  admin_designation?: string | null;
  employment_status?: string | null;
  department?: { name?: string | null } | null;
};

type LeaveRow = {
  id: string;
  status?: string | null;
  leave_days?: number | null;
  start_date: string;
  end_date: string;
  created_at: string;
  staff?: ProfileRow | null;
  leave_type?: { name?: string | null } | null;
};

type AllocationRow = {
  total_allocated?: number | null;
  used?: number | null;
  remaining?: number | null;
  year?: number | null;
  staff?: ProfileRow | null;
  leave_type?: { name?: string | null } | null;
};

type DepartmentRow = {
  id: string;
  name: string;
  college_unit?: string | null;
};

type AiSnapshot = {
  profiles: ProfileRow[];
  leaves: LeaveRow[];
  allocations: AllocationRow[];
  departments: DepartmentRow[];
  generatedAt: Date;
};

type UnitKey = 'junior' | 'senior' | 'pharmacy';
type ProfileStatus = 'pending' | 'approved' | 'rejected';
type ProfileRoleFilter = 'staff' | 'principal' | 'uh' | 'admin';

const units: UnitKey[] = ['junior', 'senior', 'pharmacy'];

const quickPrompts = [
  'How many pending staff in Pharmacy?',
  'Today summary',
  'Pending leave requests',
  'Unit-wise users',
  'Low leave balance',
  '24-hour pending staff leaves',
];

function roleLabel(profile?: ProfileRow | null) {
  return formatRoleForManagement(profile?.role, profile?.admin_designation);
}

function normalize(text: string) {
  return text.toLowerCase().replace(/college/g, '').replace(/collage/g, '').replace(/\s+/g, ' ').trim();
}

function inDateRange(dateValue: string, from: Date, to: Date) {
  const date = parseISO(dateValue);
  return !isBefore(date, from) && !isAfter(date, to);
}

function isActive(profile: ProfileRow) {
  return (profile.employment_status ?? 'active') !== 'past';
}

function isApproved(profile: ProfileRow) {
  return profile.approval_status === 'approved';
}

function getUnit(profile?: ProfileRow | null) {
  return profile?.college_unit ?? 'unassigned';
}

function formatPerson(profile?: ProfileRow | null) {
  if (!profile) return 'Unknown user';
  const unit = formatCollegeUnit(profile.college_unit);
  const role = roleLabel(profile);
  return `${profile.full_name} (${unit}, ${role})`;
}

function countByUnit<T>(items: T[], getItemUnit: (item: T) => string | null | undefined) {
  return units.map((unit) => ({
    unit,
    count: items.filter((item) => getItemUnit(item) === unit).length,
  }));
}

function bullet(lines: string[]) {
  if (!lines.length) return 'No matching records found.';
  return lines.map((line) => `• ${line}`).join('\n');
}

function extractUnit(q: string): UnitKey | null {
  if (q.includes('junior')) return 'junior';
  if (q.includes('senior')) return 'senior';
  if (q.includes('pharmacy') || q.includes('pharma')) return 'pharmacy';
  return null;
}

function extractStatus(q: string): ProfileStatus | null {
  if (q.includes('pending') || q.includes('waiting') || q.includes('not approved')) return 'pending';
  if (q.includes('approved') || q.includes('active')) return 'approved';
  if (q.includes('rejected')) return 'rejected';
  return null;
}

function extractProfileRole(q: string): ProfileRoleFilter | null {
  if (q.includes('staff') || q.includes('employee') || q.includes('employees')) return 'staff';
  if (q.includes('principal')) return 'principal';
  if (q.includes(' uh') || q.endsWith('uh') || q.includes('unit head') || q.includes('head')) return 'uh';
  if (q.includes('admin') || q.includes('principal/uh') || q.includes('principal uh')) return 'admin';
  return null;
}

function isLeaveQuestion(q: string) {
  return q.includes('leave') || q.includes('application') || q.includes('request') || q.includes('on leave') || q.includes('balance');
}

function isRegistrationQuestion(q: string) {
  return q.includes('register') || q.includes('registration') || q.includes('account') || q.includes('user') || q.includes('employee') || q.includes('staff') || q.includes('principal') || q.includes('uh');
}

function shouldList(q: string) {
  return q.includes('show') || q.includes('list') || q.includes('who') || q.includes('which') || q.includes('details') || q.includes('names');
}

function matchesProfileRole(profile: ProfileRow, role: ProfileRoleFilter | null) {
  if (!role) return true;
  const normalizedRole = String(profile.role ?? '').toLowerCase();
  const designation = String(profile.admin_designation ?? '').toLowerCase();

  if (role === 'staff') return normalizedRole === 'staff';
  if (role === 'principal') return ['admin', 'principal'].includes(normalizedRole) && designation === 'principal';
  if (role === 'uh') return ['admin', 'principal'].includes(normalizedRole) && designation === 'uh';
  if (role === 'admin') return ['admin', 'principal'].includes(normalizedRole);
  return true;
}

function matchesLeaveRole(leave: LeaveRow, role: ProfileRoleFilter | null) {
  return matchesProfileRole((leave.staff ?? {}) as ProfileRow, role);
}

function listProfiles(profiles: ProfileRow[]) {
  return profiles.slice(0, 12).map((profile) => {
    const department = profile.department?.name ? `, ${profile.department.name}` : '';
    return `${profile.full_name} - ${formatCollegeUnit(profile.college_unit)}, ${roleLabel(profile)}${department} (${profile.approval_status ?? 'unknown'})`;
  });
}

function listLeaves(leaves: LeaveRow[]) {
  return leaves.slice(0, 12).map((leave) => {
    const start = format(parseISO(leave.start_date), 'dd MMM');
    const end = format(parseISO(leave.end_date), 'dd MMM');
    return `${formatPerson(leave.staff)} - ${leave.leave_type?.name ?? 'Leave'} from ${start} to ${end} (${leave.status ?? 'unknown'})`;
  });
}

function buildSpecificProfileAnswer(q: string, snapshot: AiSnapshot) {
  const unit = extractUnit(q);
  const status = extractStatus(q);
  const role = extractProfileRole(q);

  let profiles = snapshot.profiles.filter(isActive);
  if (unit) profiles = profiles.filter((profile) => profile.college_unit === unit);
  if (status) profiles = profiles.filter((profile) => profile.approval_status === status);
  if (role) profiles = profiles.filter((profile) => matchesProfileRole(profile, role));

  const statusText = status ? `${status} ` : '';
  const roleText = role ? `${role === 'admin' ? 'Principal / UH' : role.toUpperCase() === 'UH' ? 'UH' : role} ` : 'user ';
  const unitText = unit ? `in ${formatCollegeUnit(unit)}` : 'across all units';

  const lines = [`${formatCollegeUnit(unit)} ${statusText}${roleText}registrations/users: ${profiles.length}`.replace('Unit Not Assigned ', '').trim()];

  if (!unit) {
    lines.push(
      ...countByUnit(profiles, (profile) => profile.college_unit).map(
        ({ unit: unitKey, count }) => `${formatCollegeUnit(unitKey)}: ${count}`
      )
    );
  }

  if (shouldList(q)) {
    lines.push('', `Matching ${roleText.trim()} records ${unitText}:`, bullet(listProfiles(profiles)));
  }

  return lines.join('\n');
}

function buildSpecificLeaveAnswer(q: string, snapshot: AiSnapshot) {
  const unit = extractUnit(q);
  const status = extractStatus(q);
  const role = extractProfileRole(q);
  const today = new Date();
  const weekFrom = startOfWeek(today, { weekStartsOn: 1 });
  const weekTo = endOfWeek(today, { weekStartsOn: 1 });
  const monthFrom = startOfMonth(today);

  let leaves = snapshot.leaves;
  if (unit) leaves = leaves.filter((leave) => getUnit(leave.staff) === unit);
  if (status) leaves = leaves.filter((leave) => leave.status === status);
  if (role) leaves = leaves.filter((leave) => matchesLeaveRole(leave, role));
  if (q.includes('today')) {
    leaves = leaves.filter((leave) => !isAfter(parseISO(leave.start_date), today) && !isBefore(parseISO(leave.end_date), today));
  } else if (q.includes('week')) {
    leaves = leaves.filter((leave) => inDateRange(leave.start_date, weekFrom, weekTo) || inDateRange(leave.end_date, weekFrom, weekTo));
  } else if (q.includes('month')) {
    leaves = leaves.filter((leave) => !isBefore(parseISO(leave.created_at), monthFrom));
  }

  const statusText = status ? `${status} ` : '';
  const roleText = role ? `${role === 'admin' ? 'Principal / UH' : role.toUpperCase() === 'UH' ? 'UH' : role} ` : '';
  const unitText = unit ? `in ${formatCollegeUnit(unit)}` : 'across all units';

  const lines = [`${statusText}${roleText}leave applications ${unitText}: ${leaves.length}`];
  if (!unit) {
    lines.push(
      ...countByUnit(leaves, (leave) => getUnit(leave.staff)).map(
        ({ unit: unitKey, count }) => `${formatCollegeUnit(unitKey)}: ${count}`
      )
    );
  }

  if (shouldList(q) || leaves.length <= 8) {
    lines.push('', 'Matching leave records:', bullet(listLeaves(leaves)));
  }

  return lines.join('\n');
}

function buildUnitUsers(snapshot: AiSnapshot) {
  const activeApproved = snapshot.profiles.filter((p) => isActive(p) && isApproved(p) && ['staff', 'admin', 'principal'].includes(String(p.role)));
  return units.map((unit) => {
    const unitUsers = activeApproved.filter((p) => p.college_unit === unit);
    const staff = unitUsers.filter((p) => p.role === 'staff').length;
    const principal = unitUsers.filter((p) => p.admin_designation === 'principal').length;
    const uh = unitUsers.filter((p) => p.admin_designation === 'uh').length;
    return `${formatCollegeUnit(unit)}: ${unitUsers.length} total (${staff} staff, ${principal} principal, ${uh} UH)`;
  });
}

function buildPendingSummary(snapshot: AiSnapshot) {
  const pendingLeaves = snapshot.leaves.filter((leave) => leave.status === 'pending');
  const pendingUsers = snapshot.profiles.filter((p) => p.approval_status === 'pending' && isActive(p));

  const leaveLines = countByUnit(pendingLeaves, (leave) => getUnit(leave.staff)).map(
    ({ unit, count }) => `${formatCollegeUnit(unit)} pending leaves: ${count}`
  );
  const userLines = countByUnit(pendingUsers, (profile) => profile.college_unit).map(
    ({ unit, count }) => `${formatCollegeUnit(unit)} pending registrations: ${count}`
  );

  const oldest = [...pendingLeaves]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 5)
    .map((leave) => {
      const created = format(parseISO(leave.created_at), 'dd MMM, hh:mm a');
      return `${formatPerson(leave.staff)} - ${leave.leave_type?.name ?? 'Leave'} requested on ${created}`;
    });

  return [
    `Pending leave applications: ${pendingLeaves.length}`,
    ...leaveLines,
    '',
    `Pending registrations: ${pendingUsers.length}`,
    ...userLines,
    '',
    'Oldest pending leave requests:',
    bullet(oldest),
  ].join('\n');
}

function buildTodaySummary(snapshot: AiSnapshot) {
  const today = new Date();
  const todayLeaves = snapshot.leaves.filter((leave) =>
    leave.status === 'approved' &&
    !isAfter(parseISO(leave.start_date), today) &&
    !isBefore(parseISO(leave.end_date), today)
  );

  const pendingLeaves = snapshot.leaves.filter((leave) => leave.status === 'pending');
  const lines = todayLeaves.map((leave) => `${formatPerson(leave.staff)} - ${leave.leave_type?.name ?? 'Leave'} (${leave.leave_days ?? 0} day)`);
  const unitSummary = countByUnit(todayLeaves, (leave) => getUnit(leave.staff)).map(
    ({ unit, count }) => `${formatCollegeUnit(unit)}: ${count}`
  );

  return [
    `Today, ${todayLeaves.length} approved user(s) are on leave.`,
    ...unitSummary,
    '',
    'On leave today:',
    bullet(lines),
    '',
    `Pending leave requests needing review: ${pendingLeaves.length}`,
  ].join('\n');
}

function buildWeekSummary(snapshot: AiSnapshot) {
  const now = new Date();
  const from = startOfWeek(now, { weekStartsOn: 1 });
  const to = endOfWeek(now, { weekStartsOn: 1 });

  const weekLeaves = snapshot.leaves.filter((leave) =>
    leave.status === 'approved' &&
    (inDateRange(leave.start_date, from, to) || inDateRange(leave.end_date, from, to))
  );

  const lines = weekLeaves.slice(0, 10).map((leave) =>
    `${formatPerson(leave.staff)} - ${leave.leave_type?.name ?? 'Leave'} from ${format(parseISO(leave.start_date), 'dd MMM')} to ${format(parseISO(leave.end_date), 'dd MMM')}`
  );

  return [
    `This week has ${weekLeaves.length} approved leave record(s).`,
    ...countByUnit(weekLeaves, (leave) => getUnit(leave.staff)).map(({ unit, count }) => `${formatCollegeUnit(unit)}: ${count}`),
    '',
    'Upcoming/active this week:',
    bullet(lines),
  ].join('\n');
}

function buildMonthSummary(snapshot: AiSnapshot) {
  const from = startOfMonth(new Date());
  const monthLeaves = snapshot.leaves.filter((leave) => !isBefore(parseISO(leave.created_at), from));
  const approved = monthLeaves.filter((leave) => leave.status === 'approved').length;
  const pending = monthLeaves.filter((leave) => leave.status === 'pending').length;
  const rejected = monthLeaves.filter((leave) => leave.status === 'rejected').length;

  return [
    `This month summary: ${monthLeaves.length} total leave application(s).`,
    `Approved: ${approved}`,
    `Pending: ${pending}`,
    `Rejected: ${rejected}`,
    '',
    ...countByUnit(monthLeaves, (leave) => getUnit(leave.staff)).map(({ unit, count }) => `${formatCollegeUnit(unit)}: ${count}`),
  ].join('\n');
}

function buildLowBalance(snapshot: AiSnapshot) {
  const currentYear = new Date().getFullYear();
  const low = snapshot.allocations
    .filter((allocation) => allocation.year === currentYear)
    .filter((allocation) => Number(allocation.remaining ?? 0) <= 2)
    .sort((a, b) => Number(a.remaining ?? 0) - Number(b.remaining ?? 0))
    .slice(0, 12);

  const lines = low.map((allocation) =>
    `${formatPerson(allocation.staff)} - ${allocation.leave_type?.name ?? 'Leave'} remaining: ${allocation.remaining ?? 0}`
  );

  return [
    `Low leave balance users for ${currentYear}: ${low.length}`,
    bullet(lines),
  ].join('\n');
}

function buildOlderThan24(snapshot: AiSnapshot) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const older = snapshot.leaves
    .filter((leave) => leave.status === 'pending')
    .filter((leave) => String(leave.staff?.role ?? '').toLowerCase() === 'staff')
    .filter((leave) => isBefore(parseISO(leave.created_at), cutoff));

  const lines = older.map((leave) =>
    `${formatPerson(leave.staff)} - ${leave.leave_type?.name ?? 'Leave'} pending since ${format(parseISO(leave.created_at), 'dd MMM, hh:mm a')}`
  );

  return [
    `${older.length} staff leave request(s) are pending for more than 24 hours and are ready for Director review.`,
    bullet(lines),
  ].join('\n');
}

function buildLeaveTypeUsage(snapshot: AiSnapshot) {
  const usage = new Map<string, number>();
  snapshot.leaves
    .filter((leave) => leave.status === 'approved')
    .forEach((leave) => {
      const name = leave.leave_type?.name ?? 'Unknown Leave';
      usage.set(name, (usage.get(name) ?? 0) + Number(leave.leave_days ?? 0));
    });

  const lines = [...usage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, days]) => `${name}: ${days} day(s)`);

  return ['Approved leave type usage:', bullet(lines)].join('\n');
}

function buildDepartmentSummary(snapshot: AiSnapshot) {
  const lines = units.map((unit) => {
    const names = snapshot.departments.filter((d) => d.college_unit === unit).map((d) => d.name);
    return `${formatCollegeUnit(unit)}: ${names.length ? names.join(', ') : 'No departments created'}`;
  });

  return ['Department setup:', ...lines].join('\n');
}

function buildSmartAnswer(question: string, snapshot: AiSnapshot) {
  const q = normalize(question);
  const unit = extractUnit(q);
  const status = extractStatus(q);
  const role = extractProfileRole(q);

  // Specific questions should get specific answers, not broad summaries.
  // Example: "how many pending staff in pharmacy" -> only pending Pharmacy staff registrations.
  if (unit || status || role) {
    if (isLeaveQuestion(q) && (q.includes('leave') || q.includes('application') || q.includes('request') || q.includes('today') || q.includes('week') || q.includes('month'))) {
      return buildSpecificLeaveAnswer(q, snapshot);
    }

    if (isRegistrationQuestion(q)) {
      return buildSpecificProfileAnswer(q, snapshot);
    }
  }

  if (q.includes('today') || q.includes('current')) return buildTodaySummary(snapshot);
  if (q.includes('week')) return buildWeekSummary(snapshot);
  if (q.includes('month')) return buildMonthSummary(snapshot);
  if (q.includes('24') || q.includes('hour') || q.includes('director review')) return buildOlderThan24(snapshot);
  if (q.includes('low') || q.includes('balance') || q.includes('remaining')) return buildLowBalance(snapshot);
  if (q.includes('leave type') || q.includes('most used') || q.includes('usage')) return buildLeaveTypeUsage(snapshot);
  if (q.includes('department')) return buildDepartmentSummary(snapshot);
  if (q.includes('pending') || q.includes('approval') || q.includes('waiting')) return buildPendingSummary(snapshot);
  if (q.includes('user') || q.includes('staff') || q.includes('principal') || q.includes('uh') || q.includes('unit')) {
    return ['Overall active approved users by unit:', ...buildUnitUsers(snapshot)].join('\n');
  }

  return [
    'I can answer portal-specific questions using live LeaveSync data. Try asking like this:',
    '• How many pending staff in Pharmacy?',
    '• Show approved Principal/UH in Junior',
    '• How many pending leaves in Senior?',
    '• Which staff are on leave today?',
    '• Show low leave balance users',
  ].join('\n');
}

async function loadSnapshot(): Promise<AiSnapshot> {
  const [profilesResult, leavesResult, allocationsResult, departmentsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, username, email, phone, role, approval_status, college_unit, admin_designation, employment_status, department:departments(name)')
      .or('employment_status.is.null,employment_status.neq.past')
      .limit(1000),
    supabase
      .from('leave_applications')
      .select('id, status, leave_days, start_date, end_date, created_at, staff:profiles!leave_applications_staff_id_fkey(id, full_name, username, role, college_unit, admin_designation, employment_status, department:departments(name)), leave_type:leave_types(name)')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('staff_leave_allocations')
      .select('total_allocated, used, remaining, year, staff:profiles(id, full_name, username, role, college_unit, admin_designation, employment_status), leave_type:leave_types(name)')
      .limit(1500),
    supabase
      .from('departments')
      .select('id, name, college_unit')
      .order('college_unit', { ascending: true })
      .limit(500),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (leavesResult.error) throw leavesResult.error;
  if (allocationsResult.error) throw allocationsResult.error;
  if (departmentsResult.error) throw departmentsResult.error;

  return {
    profiles: (profilesResult.data ?? []) as ProfileRow[],
    leaves: (leavesResult.data ?? []) as LeaveRow[],
    allocations: (allocationsResult.data ?? []) as AllocationRow[],
    departments: (departmentsResult.data ?? []) as DepartmentRow[],
    generatedAt: new Date(),
  };
}

export default function DirectorAiAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi! I'm LeaveSync AI Insights. Ask me specific portal questions like: How many pending staff in Pharmacy? or Show approved Principal/UH in Junior.",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const lastUpdated = useMemo(() => {
    if (!snapshot) return 'Not loaded yet';
    return format(snapshot.generatedAt, 'dd MMM, hh:mm a');
  }, [snapshot]);

  const askQuestion = async (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || busy) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: cleanQuestion };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setBusy(true);

    try {
      const freshSnapshot = snapshot ?? await loadSnapshot();
      if (!snapshot) setSnapshot(freshSnapshot);
      const answer = buildSmartAnswer(cleanQuestion, freshSnapshot);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: answer }]);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `I could not load insights right now. ${error?.message ?? 'Please try again.'}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const refreshData = async () => {
    setBusy(true);
    try {
      const freshSnapshot = await loadSnapshot();
      setSnapshot(freshSnapshot);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `Data refreshed. Last updated: ${format(freshSnapshot.generatedAt, 'dd MMM, hh:mm a')}`,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: `Refresh failed. ${error?.message ?? 'Please try again.'}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMinimized(false);
          }}
          className="fixed bottom-5 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-primary to-purple-600 p-[3px] shadow-2xl transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:bottom-6 sm:right-6"
          aria-label="Open LeaveSync AI Insights"
        >
          <span className="relative flex h-full w-full items-center justify-center rounded-full bg-background">
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow">AI</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-inner">
              <Bot className="h-7 w-7 text-primary" />
            </span>
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-3 right-3 z-50 w-[calc(100vw-1.5rem)] max-w-[430px] overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl sm:bottom-5 sm:right-5">
          <div className="flex items-center justify-between border-b bg-card px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-primary to-purple-600 p-[2px]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">LeaveSync AI</p>
                  <Badge variant="secondary" className="text-[10px]">Free</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">Portal insights • {lastUpdated}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refreshData} disabled={busy} aria-label="Refresh AI data">
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMinimized((value) => !value)} aria-label="Minimize AI chat">
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Close AI chat">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!minimized && (
            <>
              <ScrollArea className="h-[410px] max-h-[60vh] bg-muted/20 px-3 py-3">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border/80 bg-background text-foreground'
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}
                  {busy && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-background px-3.5 py-2.5 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                        Reading portal insights...
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              <div className="border-t bg-card p-3">
                <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                  {quickPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 rounded-full px-3 text-xs"
                      onClick={() => askQuestion(prompt)}
                      disabled={busy}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>

                <form
                  className="flex items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    askQuestion(input);
                  }}
                >
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask: how many pending staff in Pharmacy?"
                    rows={1}
                    className="max-h-24 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        askQuestion(input);
                      }
                    }}
                  />
                  <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={busy || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Uses portal data only. No paid AI model or external API is used.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
