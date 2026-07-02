import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function adminLoginUrl() {
  const baseUrl = (Deno.env.get('APP_BASE_URL') ?? 'https://gsmleave.in').replace(/\/$/, '');
  return `${baseUrl}/admin/login`;
}

function pageResponse(html: string, status = 200) {
  const headers = new Headers(corsHeaders);

  // Force browser to render HTML, not show raw text
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  return new Response(html, {
    status,
    headers,
  });
}

function statusPage(params: {
  title: string;
  message: string;
  ok?: boolean;
  tone?: 'success' | 'danger' | 'warning';
  details?: Array<{ label: string; value: unknown }>;
  showPortalButton?: boolean;
}) {
  const tone = params.tone ?? (params.ok === false ? 'danger' : 'success');
  const palette = {
    success: { color: '#15803d', bg: '#dcfce7', icon: '✓' },
    danger: { color: '#b91c1c', bg: '#fee2e2', icon: '!' },
    warning: { color: '#a16207', bg: '#fef3c7', icon: 'i' },
  }[tone];

  const detailsHtml = params.details?.length
    ? `<div style="margin:22px 0;text-align:left;border:1px solid #f1e7d0;border-radius:14px;overflow:hidden;">
        ${params.details.map((item) => `
          <div style="display:flex;gap:12px;padding:12px 14px;border-bottom:1px solid #f1e7d0;">
            <div style="min-width:120px;color:#92400e;font-size:13px;font-weight:700;">${escapeHtml(item.label)}</div>
            <div style="color:#374151;font-size:14px;line-height:1.5;">${escapeHtml(item.value)}</div>
          </div>`).join('')}
      </div>`
    : '';

  const portalButton = params.showPortalButton !== false
    ? `<a href="${adminLoginUrl()}" style="display:inline-block;background:#a16207;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;">Open Admin Login</a>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>leaveSYNC - ${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;background:#f8f4ea;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:720px;margin:46px auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #eadfca;border-radius:20px;padding:34px;box-shadow:0 10px 28px rgba(80,60,20,.10);text-align:center;">
        <div style="font-size:13px;color:#a16207;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">leaveSYNC</div>
        <div style="width:72px;height:72px;border-radius:50%;background:${palette.bg};margin:0 auto 18px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:36px;color:${palette.color};font-weight:bold;line-height:1;">${palette.icon}</span>
        </div>
        <h1 style="color:${palette.color};margin:8px 0 12px;font-size:26px;line-height:1.25;">${escapeHtml(params.title)}</h1>
        <p style="color:#374151;line-height:1.7;font-size:16px;margin:0 auto 8px;max-width:560px;">${escapeHtml(params.message)}</p>
        ${detailsHtml}
        ${portalButton}
        <div style="margin-top:26px;padding-top:18px;border-top:1px solid #f1e7d0;color:#9ca3af;font-size:12px;line-height:1.5;">
          G.D. Sawant College Leave Management Portal<br />You can safely close this page after reviewing the message, or open the Admin Login page to check the portal.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function actionPastTense(action: string) {
  return action === 'approve' ? 'approved' : 'rejected';
}

function statusPastTense(status: string | null | undefined) {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return status ?? 'handled';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const action = (url.searchParams.get('action') || '').toLowerCase();

  if (!token || !['approve', 'reject'].includes(action)) {
    return pageResponse(statusPage({
      title: 'Invalid Action Link',
      message: 'This email action link is missing required information. Please open the portal and review the request from there.',
      ok: false,
      tone: 'danger',
    }), 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Missing Supabase function secrets' }, 500);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tokenHash = await sha256Hex(token);

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('email_action_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return pageResponse(statusPage({
      title: 'Action Link Not Found',
      message: 'This action link is invalid, expired, or already removed. Please open the portal to check the latest request status.',
      ok: false,
      tone: 'danger',
    }), 404);
  }

  if (tokenRow.used_at) {
    return pageResponse(statusPage({
      title: 'Request Already Handled',
      message: `This request was already ${actionPastTense(String(tokenRow.used_action ?? action))}. No further action is needed.`,
      ok: true,
      tone: 'warning',
      details: [
        { label: 'Handled Action', value: actionPastTense(String(tokenRow.used_action ?? action)) },
        { label: 'Handled On', value: tokenRow.used_at ? new Date(tokenRow.used_at).toLocaleString('en-IN') : '-' },
      ],
    }), 200);
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return pageResponse(statusPage({
      title: 'Link Expired',
      message: 'This approval link has expired. Please open the portal and handle the request from there.',
      ok: false,
      tone: 'warning',
    }), 410);
  }

  if (tokenRow.action_type && tokenRow.action_type !== action) {
    return pageResponse(statusPage({
      title: 'Wrong Action Link',
      message: 'This link is not valid for the selected action. Please use the correct Approve or Reject button from the email.',
      ok: false,
      tone: 'danger',
    }), 400);
  }

  const now = new Date().toISOString();
  const actorProfileId = tokenRow.actor_profile_id ?? null;
  const reviewerNote = action === 'approve' ? 'Approved from email action link.' : 'Rejected from email action link.';
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  let applicantEmailSent = false;

  try {
    if (tokenRow.target_table === 'profiles') {
      const { data: applicant, error: applicantError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, email, role, approval_status')
        .eq('id', tokenRow.target_id)
        .maybeSingle();

      if (applicantError) throw applicantError;
      if (!applicant) throw new Error('Applicant profile was not found.');

      if (applicant.approval_status && applicant.approval_status !== 'pending') {
        await supabaseAdmin
          .from('email_action_tokens')
          .update({ used_at: now, used_action: applicant.approval_status === 'approved' ? 'approve' : 'reject', used_by: actorProfileId, updated_at: now })
          .eq('id', tokenRow.id);

        return pageResponse(statusPage({
          title: 'Request Already Handled',
          message: `This registration request was already ${statusPastTense(applicant.approval_status)}. No further action is needed.`,
          ok: true,
          tone: 'warning',
          details: [
            { label: 'Applicant', value: applicant.full_name ?? applicant.username },
            { label: 'Current Status', value: statusPastTense(applicant.approval_status) },
          ],
        }), 200);
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ approval_status: newStatus, approved_by: actorProfileId, approved_at: now, updated_at: now })
        .eq('id', tokenRow.target_id);
      if (error) throw error;

      const reviewerRoleLabel = ['main_admin', 'director'].includes(String(tokenRow.actor_role)) ? 'Director' : 'Principal / UH';
      const decisionResponse = await fetch(`${supabaseUrl}/functions/v1/send-registration-decision-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicantProfileId: tokenRow.target_id,
          status: newStatus,
          reviewerRoleLabel,
        }),
      });

      if (decisionResponse.ok) {
        applicantEmailSent = true;
      } else {
        const decisionError = await decisionResponse.text().catch(() => '');
        console.error('Registration decision email failed after email action:', decisionError);
      }
    } else if (tokenRow.target_table === 'leave_applications') {
      const { data: leaveApplication, error: leaveCheckError } = await supabaseAdmin
        .from('leave_applications')
        .select('id, status')
        .eq('id', tokenRow.target_id)
        .maybeSingle();

      if (leaveCheckError) throw leaveCheckError;
      if (!leaveApplication) throw new Error('Leave application was not found.');

      if (leaveApplication.status && leaveApplication.status !== 'pending') {
        await supabaseAdmin
          .from('email_action_tokens')
          .update({ used_at: now, used_action: leaveApplication.status === 'approved' ? 'approve' : 'reject', used_by: actorProfileId, updated_at: now })
          .eq('id', tokenRow.id);

        return pageResponse(statusPage({
          title: 'Request Already Handled',
          message: `This leave application was already ${statusPastTense(leaveApplication.status)}. No further action is needed.`,
          ok: true,
          tone: 'warning',
          details: [
            { label: 'Current Status', value: statusPastTense(leaveApplication.status) },
          ],
        }), 200);
      }

      const { error } = await supabaseAdmin
        .from('leave_applications')
        .update({ status: newStatus, admin_response: reviewerNote, reviewed_by: actorProfileId, reviewed_at: now, updated_at: now })
        .eq('id', tokenRow.target_id);
      if (error) throw error;
    } else {
      throw new Error('Unsupported target table');
    }

    await supabaseAdmin
      .from('email_action_tokens')
      .update({ used_at: now, used_action: action, used_by: actorProfileId, updated_at: now })
      .eq('target_table', tokenRow.target_table)
      .eq('target_id', tokenRow.target_id)
      .eq('request_type', tokenRow.request_type);

    const handledText = action === 'approve' ? 'approved' : 'rejected';
    const targetText = tokenRow.target_table === 'profiles' ? 'registration request' : 'leave application';
    const notificationText = tokenRow.target_table === 'profiles'
      ? applicantEmailSent
        ? 'The applicant has also been notified by email.'
        : 'The request was handled, but applicant notification email could not be confirmed. Please check email logs if needed.'
      : 'You can review the updated status from the portal.';

    return pageResponse(statusPage({
      title: action === 'approve' ? 'Request Approved Successfully' : 'Request Rejected Successfully',
      message: `The ${targetText} was ${handledText} successfully. ${notificationText}`,
      ok: true,
      tone: action === 'approve' ? 'success' : 'danger',
      details: [
        { label: 'Action', value: handledText },
        { label: 'Handled On', value: new Date(now).toLocaleString('en-IN') },
        { label: 'Applicant Email', value: tokenRow.target_table === 'profiles' ? (applicantEmailSent ? 'Sent' : 'Not confirmed') : 'Not applicable' },
      ],
    }));
  } catch (error) {
    return pageResponse(statusPage({
      title: 'Action Failed',
      message: error instanceof Error ? error.message : 'Something went wrong while handling this request.',
      ok: false,
      tone: 'danger',
    }), 500);
  }
});
