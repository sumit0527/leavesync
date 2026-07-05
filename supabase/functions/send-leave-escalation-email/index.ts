import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { buildProfessionalEmail, plainTextFromHtml } from '../_shared/emailTemplates.ts';

type RequestBody = {
  applicationId?: string;
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
    email_type: 'leave_director_review_24h',
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
    metadata: { source: 'director_review_after_24h' },
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

  let body: RequestBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let query = supabaseAdmin
      .from('leave_applications')
      .select(`
        id,
        start_date,
        end_date,
        leave_days,
        leave_duration,
        half_day_period,
        reason,
        status,
        created_at,
        director_notified_at,
        staff:profiles!leave_applications_staff_id_fkey(
          id,
          username,
          full_name,
          email,
          phone,
          role,
          college_unit,
          admin_designation,
          department:departments(name)
        ),
        leave_type:leave_types(name)
      `)
      .eq('status', 'pending')
      .is('director_notified_at', null);

    if (body.applicationId) {
      query = query.eq('id', body.applicationId);
    } else {
      query = query.lte('created_at', cutoffIso);
    }

    const { data: applications, error: applicationError } = await query;
    if (applicationError) throw applicationError;

    const staffApplications = (applications ?? []).filter((application: any) => {
      const role = String(application?.staff?.role ?? '').toLowerCase();
      const createdAtOk = body.applicationId || new Date(application?.created_at ?? 0).getTime() <= Date.now() - 24 * 60 * 60 * 1000;
      return role === 'staff' && application.status === 'pending' && createdAtOk;
    });

    if (staffApplications.length === 0) {
      return jsonResponse({ success: true, processed: 0, message: 'No pending staff leave requests are waiting over 24 hours.' });
    }

    const { data: directors, error: directorsError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, email, role')
      .in('role', ['main_admin', 'director'])
      .eq('approval_status', 'approved')
      .not('email', 'is', null);

    if (directorsError) throw directorsError;

    const recipients = (directors ?? []).filter((director: any) => String(director.email ?? '').includes('@'));
    if (recipients.length === 0) {
      return jsonResponse({ success: false, warning: 'No approved Director email recipients found.' }, 200);
    }

    const results: Array<Record<string, unknown>> = [];

    for (const application of staffApplications as any[]) {
      const staff = application.staff;
      const subject = `Director Review Required — ${formatCollegeUnit(staff?.college_unit)} Staff Leave — ${clean(staff?.full_name)}`;
      const sentTo: string[] = [];
      const failed: string[] = [];

      for (const director of recipients as any[]) {
        try {
          const approveUrl = await createActionUrl(supabaseAdmin, {
            applicationId: application.id,
            actorProfileId: director.id,
            actorRole: director.role,
            action: 'approve',
          });
          const rejectUrl = await createActionUrl(supabaseAdmin, {
            applicationId: application.id,
            actorProfileId: director.id,
            actorRole: director.role,
            action: 'reject',
          });

          const html = buildProfessionalEmail({
            title: 'Director Review Required',
            greeting: `Dear ${clean(director.full_name || director.username)},`,
            intro: 'A staff leave request is still pending after 24 hours. To avoid delay for the applicant, Director review is now available from this email or from the portal.',
            details: [
              { label: 'Applicant Name', value: staff?.full_name },
              { label: 'Username', value: staff?.username },
              { label: 'Role', value: 'Staff' },
              { label: 'College Unit', value: formatCollegeUnit(staff?.college_unit) },
              { label: 'Department', value: staff?.department?.name ?? 'N/A' },
              { label: 'Leave Type', value: application.leave_type?.name },
              { label: 'Start Date', value: formatDate(application.start_date) },
              { label: 'End Date', value: formatDate(application.end_date) },
              { label: 'Leave Days', value: application.leave_days },
              { label: 'Duration', value: formatDuration(application) },
              { label: 'Reason', value: application.reason },
              { label: 'Submitted On', value: application.created_at ? new Date(application.created_at).toLocaleString('en-IN') : '-' },
            ],
            note: 'This Director action is available because the staff leave request has remained pending for more than 24 hours. The approve/reject buttons are secure one-time links.',
            buttons: [
              { label: 'Approve', url: approveUrl, variant: 'approve' },
              { label: 'Reject', url: rejectUrl, variant: 'reject' },
              { label: 'Open Admin Login', url: `${appBaseUrl()}/admin/login`, variant: 'default' },
            ],
          });

          await sendEmail(supabaseAdmin, resendApiKey, director.email, subject, html, {
            relatedApplicationId: application.id,
            relatedProfileId: staff?.id ?? null,
            reviewerId: director.id,
            collegeUnit: staff?.college_unit,
            source: 'director_review_after_24h',
          });
          sentTo.push(director.email);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error);
          console.error('Director review email failed:', director.email, errorMessage);
          failed.push(`${director.email}: ${errorMessage}`);
        }
      }

      if (sentTo.length > 0) {
        await supabaseAdmin
          .from('leave_applications')
          .update({ director_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', application.id);
      }

      results.push({ applicationId: application.id, sentTo, failed });
    }

    return jsonResponse({ success: true, processed: results.length, results });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Director review email failed' }, 500);
  }
});
