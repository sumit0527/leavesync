import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { buildProfessionalEmail, plainTextFromHtml } from '../_shared/emailTemplates.ts';

/**
 * Expiry email worker only.
 *
 * Urgent reminders remain portal notifications and are intentionally NOT emailed.
 * Each expired leave application can send at most one successful email.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'POST method required' }, 405);

  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const suppliedSecret = req.headers.get('x-cron-secret') ?? '';

  if (!cronSecret || suppliedSecret !== cronSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const fromEmail = Deno.env.get('EMAIL_FROM') ?? 'leaveSYNC <noreply@gsmleave.in>';

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return jsonResponse({ error: 'Required function secrets are missing' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: applications, error: applicationsError } = await admin
    .from('leave_applications')
    .select('id, staff_id, leave_type_id, start_date, end_date, expired_at, expiry_reason')
    .not('expired_at', 'is', null)
    .order('expired_at', { ascending: true })
    .limit(100);

  if (applicationsError) {
    console.error('Failed to load expired applications:', applicationsError);
    return jsonResponse({ error: 'Unable to load expired applications' }, 500);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const application of applications ?? []) {
    const { data: applicant, error: applicantError } = await admin
      .from('profiles')
      .select('id, full_name, username, email, role')
      .eq('id', application.staff_id)
      .maybeSingle();

    if (applicantError || !applicant) {
      console.error('Applicant lookup failed:', application.id, applicantError);
      skipped += 1;
      continue;
    }

    const recipientEmail = String(applicant.email ?? '').trim().toLowerCase();

    const { data: claimed, error: claimError } = await admin.rpc('claim_leave_expiry_email', {
      p_application_id: application.id,
      p_recipient_id: applicant.id,
      p_recipient_email: recipientEmail || null,
    });

    if (claimError) {
      console.error('Expiry email claim failed:', application.id, claimError);
      failed += 1;
      continue;
    }

    if (!claimed) {
      skipped += 1;
      continue;
    }

    if (!recipientEmail) {
      await admin
        .from('leave_expiry_email_deliveries')
        .update({
          status: 'skipped',
          error_message: 'Applicant profile has no email address',
          updated_at: new Date().toISOString(),
        })
        .eq('application_id', application.id);
      skipped += 1;
      continue;
    }

    let leaveTypeName = 'Leave';
    if (application.leave_type_id) {
      const { data: leaveType } = await admin
        .from('leave_types')
        .select('name')
        .eq('id', application.leave_type_id)
        .maybeSingle();
      leaveTypeName = String(leaveType?.name ?? 'Leave');
    }

    const applicantName = String(applicant.full_name || applicant.username || 'User');
    const subject = `Leave Application Expired — ${leaveTypeName}`;
    const expiryReason = String(
      application.expiry_reason ||
        'No approval decision was taken before the leave period ended.',
    );

    const html = buildProfessionalEmail({
      title: 'Leave Application Expired',
      greeting: `Dear ${applicantName},`,
      intro:
        'Your leave application has been automatically closed because its leave period ended without an approval decision.',
      details: [
        { label: 'Leave Type', value: leaveTypeName },
        { label: 'Start Date', value: application.start_date },
        { label: 'End Date', value: application.end_date },
        { label: 'Status', value: 'Expired' },
      ],
      note: `${expiryReason} No leave balance was deducted. The application remains available in Leave History for record purposes.`,
    });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipientEmail,
        subject,
        html,
        text: plainTextFromHtml(html),
      }),
    });

    const resendResult = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      console.error('Expiry email failed:', application.id, resendResult);
      await admin
        .from('leave_expiry_email_deliveries')
        .update({
          status: 'failed',
          error_message: JSON.stringify(resendResult),
          updated_at: new Date().toISOString(),
        })
        .eq('application_id', application.id);
      failed += 1;
      continue;
    }

    await admin
      .from('leave_expiry_email_deliveries')
      .update({
        status: 'sent',
        provider_message_id: resendResult?.id ?? null,
        sent_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('application_id', application.id);

    sent += 1;
  }

  return jsonResponse({
    success: true,
    mode: 'expiry-email-only',
    sent,
    skipped,
    failed,
  });
});
