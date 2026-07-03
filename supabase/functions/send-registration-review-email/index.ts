import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { buildProfessionalEmail, plainTextFromHtml } from '../_shared/emailTemplates.ts';

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: string | null;
  college_unit?: string | null;
  admin_designation?: string | null;
  department_id: string | null;
  approval_status: string | null;
  created_at: string | null;
  department?: { name?: string | null } | null;
};

type ReviewBody = {
  applicantUsername: string;
  applicantRole: 'staff' | 'principal';
};

const appBaseUrl = () => (Deno.env.get('APP_BASE_URL') ?? 'https://gsmleave.in').replace(/\/$/, '');

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatCollegeUnit(unit: unknown) {
  const value = String(unit ?? '').toLowerCase();
  if (value === 'junior') return 'Junior College';
  if (value === 'senior') return 'Senior College';
  if (value === 'pharmacy') return 'Pharmacy College';
  return 'Unit Not Assigned';
}

function formatDesignation(value: unknown) {
  const designation = String(value ?? '').toLowerCase();
  if (designation === 'uh') return 'UH';
  if (designation === 'principal') return 'Principal';
  return 'Principal / UH';
}

async function findApplicant(supabaseAdmin: ReturnType<typeof createClient>, username: string, role: 'staff' | 'principal') {
  const normalized = username.trim().toLowerCase();
  const roleFilter = role === 'principal' ? ['principal', 'admin'] : ['staff'];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*, department:departments(name)')
      .eq('username', normalized)
      .in('role', roleFilter)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as Profile;

    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return null;
}

async function insertEmailLog(supabaseAdmin: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const { data } = await supabaseAdmin
    .from('email_logs')
    .insert({ status: 'pending', ...payload })
    .select('id')
    .maybeSingle();
  return data?.id ?? null;
}

async function updateEmailLog(supabaseAdmin: ReturnType<typeof createClient>, logId: string | null, values: Record<string, unknown>) {
  if (!logId) return;
  await supabaseAdmin
    .from('email_logs')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', logId);
}

async function sendEmail(supabaseAdmin: ReturnType<typeof createClient>, resendApiKey: string, to: string, subject: string, html: string, metadata: Record<string, unknown>) {
  const logId = await insertEmailLog(supabaseAdmin, {
    email_type: 'registration_review',
    recipient: to,
    subject,
    related_profile_id: metadata.relatedProfileId ?? null,
    metadata,
  });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') ?? 'leaveSYNC <noreply@gsmleave.in>',
      to,
      subject,
      html,
      text: plainTextFromHtml(html),
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    await updateEmailLog(supabaseAdmin, logId, { status: 'failed', error_message: JSON.stringify(result) });
    throw new Error(`Email failed for ${to}: ${JSON.stringify(result)}`);
  }

  await updateEmailLog(supabaseAdmin, logId, {
    status: 'sent',
    provider_message_id: result?.id ?? null,
    sent_at: new Date().toISOString(),
  });
}

async function createActionUrl(supabaseAdmin: ReturnType<typeof createClient>, params: {
  targetId: string;
  actorProfileId: string;
  actorRole: string;
  action: 'approve' | 'reject';
}) {
  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const { error } = await supabaseAdmin.from('email_action_tokens').insert({
    token_hash: tokenHash,
    request_type: 'registration_review',
    target_table: 'profiles',
    target_id: params.targetId,
    actor_profile_id: params.actorProfileId,
    actor_role: params.actorRole,
    action_type: params.action,
    expires_at: expiresAt,
    metadata: { source: 'registration_review_email_phase2' },
  });

  if (error) throw error;

  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/email-action?token=${encodeURIComponent(token)}&action=${params.action}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'POST method required' }, 405);

  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!resendApiKey) return jsonResponse({ error: 'Missing RESEND_API_KEY secret' }, 500);
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Missing Supabase function secrets' }, 500);

  let body: ReviewBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.applicantUsername || !['staff', 'principal'].includes(body.applicantRole)) {
    return jsonResponse({ error: 'applicantUsername and applicantRole are required' }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const applicant = await findApplicant(supabaseAdmin, body.applicantUsername, body.applicantRole);
    if (!applicant) return jsonResponse({ error: 'Applicant profile not found yet. Try again in a few seconds.' }, 404);

    const reviewerRoles = body.applicantRole === 'staff' ? ['principal', 'admin'] : ['director', 'main_admin'];
    const reviewerRoleLabel = body.applicantRole === 'staff' ? `${formatCollegeUnit(applicant.college_unit)} Principal / UH` : 'Director';
    const applicantRoleLabel = body.applicantRole === 'staff'
      ? 'Staff'
      : `${formatCollegeUnit(applicant.college_unit)} ${formatDesignation(applicant.admin_designation)}`;
    const portalPath = '/admin/login';

    let reviewerQuery = supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, email, role, college_unit, admin_designation')
      .in('role', reviewerRoles)
      .eq('approval_status', 'approved')
      .not('email', 'is', null);

    // Staff registration goes only to Principal/UH from the same college unit.
    // Principal/UH registration goes to all Directors.
    if (body.applicantRole === 'staff') {
      reviewerQuery = reviewerQuery.eq('college_unit', applicant.college_unit);
    }

    const { data: reviewers, error: reviewersError } = await reviewerQuery;

    if (reviewersError) throw reviewersError;

    const recipients = (reviewers ?? []).filter((reviewer: any) => String(reviewer.email ?? '').includes('@'));
    if (recipients.length === 0) {
      return jsonResponse({ success: false, warning: `No approved ${reviewerRoleLabel} email recipients found.` }, 200);
    }

    const subject = body.applicantRole === 'staff'
      ? `New ${formatCollegeUnit(applicant.college_unit)} Staff Registration Pending — ${clean(applicant.full_name)}`
      : `New ${formatCollegeUnit(applicant.college_unit)} ${formatDesignation(applicant.admin_designation)} Registration Pending — ${clean(applicant.full_name)}`;

    const sentTo: string[] = [];
    const failed: string[] = [];

    for (const reviewer of recipients as any[]) {
      try {
        const approveUrl = await createActionUrl(supabaseAdmin, { targetId: applicant.id, actorProfileId: reviewer.id, actorRole: reviewer.role, action: 'approve' });
        const rejectUrl = await createActionUrl(supabaseAdmin, { targetId: applicant.id, actorProfileId: reviewer.id, actorRole: reviewer.role, action: 'reject' });

        const html = buildProfessionalEmail({
          title: `${applicantRoleLabel} Registration Review Required`,
          greeting: `Dear ${clean(reviewer.full_name || reviewer.username)},`,
          intro: `A new ${applicantRoleLabel.toLowerCase()} account registration is waiting for ${reviewerRoleLabel} review. You can approve or reject it directly from this email, or open the portal for more details.`,
          details: [
            { label: 'Applicant Name', value: applicant.full_name },
            { label: 'Username', value: applicant.username },
            { label: 'Role', value: applicantRoleLabel },
            { label: 'College Unit', value: formatCollegeUnit(applicant.college_unit) },
            { label: 'Designation', value: body.applicantRole === 'staff' ? 'Staff' : formatDesignation(applicant.admin_designation) },
            { label: 'Department', value: body.applicantRole === 'staff' ? applicant.department?.name : 'Not applicable' },
            { label: 'Email', value: applicant.email },
            { label: 'Phone', value: applicant.phone },
            { label: 'Address', value: applicant.address },
            { label: 'Submitted On', value: applicant.created_at ? new Date(applicant.created_at).toLocaleString('en-IN') : '-' },
          ],
          note: `This action is for ${reviewerRoleLabel} only. The approve/reject buttons are secure one-time links and will expire in 7 days.`,
          buttons: [
            { label: 'Approve', url: approveUrl, variant: 'approve' },
            { label: 'Reject', url: rejectUrl, variant: 'reject' },
            { label: 'Open Admin Login', url: `${appBaseUrl()}${portalPath}`, variant: 'default' },
          ],
        });

        await sendEmail(supabaseAdmin, resendApiKey, reviewer.email, subject, html, {
          relatedProfileId: applicant.id,
          applicantRole: body.applicantRole,
          reviewerRole: reviewerRoleLabel,
          reviewerId: reviewer.id,
          collegeUnit: applicant.college_unit,
          adminDesignation: applicant.admin_designation,
        });
        sentTo.push(reviewer.email);
      }  catch (error) {
          const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null
              ? JSON.stringify(error)
              : String(error);

  console.error('Registration review email failed for reviewer:', reviewer.email, errorMessage);

  failed.push(`${reviewer.email}: ${errorMessage}`);
}
    }

    return jsonResponse({ success: sentTo.length > 0, sentTo, failed });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Registration email failed' }, 500);
  }
});
