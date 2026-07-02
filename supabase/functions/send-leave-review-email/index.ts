import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { buildProfessionalEmail, plainTextFromHtml } from '../_shared/emailTemplates.ts';

type ReviewBody = {
  applicationId: string;
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

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDuration(application: any) {
  if (application.leave_duration === 'half_day') {
    return application.half_day_period === 'second_half' ? 'Half Day — Second Half' : 'Half Day — First Half';
  }
  return 'Full Day';
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
    email_type: 'leave_review',
    recipient: to,
    subject,
    related_application_id: metadata.relatedApplicationId ?? null,
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
  applicationId: string;
  actorProfileId: string;
  actorRole: string;
  action: 'approve' | 'reject';
}) {
  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const { error } = await supabaseAdmin.from('email_action_tokens').insert({
    token_hash: tokenHash,
    request_type: 'leave_application',
    target_table: 'leave_applications',
    target_id: params.applicationId,
    actor_profile_id: params.actorProfileId,
    actor_role: params.actorRole,
    action_type: params.action,
    expires_at: expiresAt,
    metadata: { source: 'leave_review_email_phase1' },
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

  if (!body.applicationId) {
    return jsonResponse({ error: 'applicationId is required' }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: application, error: applicationError } = await supabaseAdmin
      .from('leave_applications')
      .select(`
        id,
        start_date,
        end_date,
        leave_days,
        leave_duration,
        half_day_period,
        reason,
        document_url,
        status,
        created_at,
        staff:profiles!leave_applications_staff_id_fkey(
          id,
          username,
          full_name,
          email,
          phone,
          role,
          department:departments(name)
        ),
        leave_type:leave_types(name)
      `)
      .eq('id', body.applicationId)
      .maybeSingle();

    if (applicationError) throw applicationError;
    if (!application) return jsonResponse({ error: 'Leave application not found' }, 404);

    const staff = (application as any).staff;
    const staffRole = String(staff?.role ?? '').toLowerCase();
    const isPrincipalLeave = ['principal', 'admin'].includes(staffRole);
    const reviewerRoles = isPrincipalLeave ? ['director', 'main_admin'] : ['principal', 'admin'];
    const reviewerRoleLabel = isPrincipalLeave ? 'Director' : 'Principal / UH';
    const applicantRoleLabel = isPrincipalLeave ? 'Principal / UH' : 'Staff';

    const { data: reviewers, error: reviewersError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, email, role')
      .in('role', reviewerRoles)
      .eq('approval_status', 'approved')
      .not('email', 'is', null);

    if (reviewersError) throw reviewersError;

    const recipients = (reviewers ?? []).filter((reviewer: any) => String(reviewer.email ?? '').includes('@'));
    if (recipients.length === 0) {
      return jsonResponse({ success: false, warning: `No approved ${reviewerRoleLabel} email recipients found.` }, 200);
    }

    const subject = isPrincipalLeave
      ? `New Principal / UH Leave Request — ${clean(staff?.full_name)}`
      : `New Staff Leave Request — ${clean(staff?.full_name)}`;

    const sentTo: string[] = [];
    const failed: string[] = [];

    for (const reviewer of recipients as any[]) {
      try {
        const approveUrl = await createActionUrl(supabaseAdmin, {
          applicationId: application.id,
          actorProfileId: reviewer.id,
          actorRole: reviewer.role,
          action: 'approve',
        });
        const rejectUrl = await createActionUrl(supabaseAdmin, {
          applicationId: application.id,
          actorProfileId: reviewer.id,
          actorRole: reviewer.role,
          action: 'reject',
        });

        const html = buildProfessionalEmail({
          title: `${applicantRoleLabel} Leave Request Review Required`,
          greeting: `Dear ${clean(reviewer.full_name || reviewer.username)},`,
          intro: `A new ${applicantRoleLabel.toLowerCase()} leave request is waiting for ${reviewerRoleLabel} review. You can approve or reject it directly from this email, or open the portal for more details.`,
          details: [
            { label: 'Applicant Name', value: staff?.full_name },
            { label: 'Username', value: staff?.username },
            { label: 'Role', value: applicantRoleLabel },
            { label: 'Department', value: staff?.department?.name ?? 'N/A' },
            { label: 'Leave Type', value: (application as any).leave_type?.name },
            { label: 'Start Date', value: formatDate(application.start_date) },
            { label: 'End Date', value: formatDate(application.end_date) },
            { label: 'Leave Days', value: application.leave_days },
            { label: 'Duration', value: formatDuration(application) },
            { label: 'Reason', value: application.reason },
            { label: 'Submitted On', value: application.created_at ? new Date(application.created_at).toLocaleString('en-IN') : '-' },
          ],
          note: `This action is for ${reviewerRoleLabel} only. The approve/reject buttons are secure one-time links and will expire in 7 days.`,
          buttons: [
            { label: 'Approve', url: approveUrl, variant: 'approve' },
            { label: 'Reject', url: rejectUrl, variant: 'reject' },
            { label: 'Open Admin Login', url: `${appBaseUrl()}/admin/login`, variant: 'default' },
          ],
        });

        await sendEmail(supabaseAdmin, resendApiKey, reviewer.email, subject, html, {
          relatedApplicationId: application.id,
          relatedProfileId: staff?.id ?? null,
          applicantRole: staffRole,
          reviewerRole: reviewerRoleLabel,
          reviewerId: reviewer.id,
        });
        sentTo.push(reviewer.email);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null
              ? JSON.stringify(error)
              : String(error);

        console.error('Leave review email failed for reviewer:', reviewer.email, errorMessage);
        failed.push(`${reviewer.email}: ${errorMessage}`);
      }
    }

    return jsonResponse({ success: sentTo.length > 0, sentTo, failed });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Leave review email failed' }, 500);
  }
});
