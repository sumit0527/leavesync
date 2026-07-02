import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function appBaseUrl() {
  return (Deno.env.get('APP_BASE_URL') ?? 'https://gsmleave.in').replace(/\/$/, '');
}

function redirectToResult(params: {
  result: 'success' | 'already-handled' | 'expired' | 'invalid' | 'error';
  title: string;
  message: string;
  tone?: 'success' | 'danger' | 'warning';
  action?: string;
  requestType?: string;
  applicant?: string;
  currentStatus?: string;
  applicantEmail?: string;
  handledOn?: string;
}) {
  const redirectUrl = new URL(`${appBaseUrl()}/email-action-result`);

  redirectUrl.searchParams.set('result', params.result);
  redirectUrl.searchParams.set('title', params.title);
  redirectUrl.searchParams.set('message', params.message);

  if (params.tone) redirectUrl.searchParams.set('tone', params.tone);
  if (params.action) redirectUrl.searchParams.set('action', params.action);
  if (params.requestType) redirectUrl.searchParams.set('type', params.requestType);
  if (params.applicant) redirectUrl.searchParams.set('applicant', params.applicant);
  if (params.currentStatus) redirectUrl.searchParams.set('currentStatus', params.currentStatus);
  if (params.applicantEmail) redirectUrl.searchParams.set('applicantEmail', params.applicantEmail);
  if (params.handledOn) redirectUrl.searchParams.set('handledOn', params.handledOn);

  return Response.redirect(redirectUrl.toString(), 303);
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
    return redirectToResult({
      result: 'invalid',
      title: 'Invalid Action Link',
      message: 'This email action link is missing required information. Please open the portal and review the request from there.',
      tone: 'danger',
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectToResult({
      result: 'error',
      title: 'Configuration Error',
      message: 'Required email action settings are missing. Please open the portal and contact the administrator.',
      tone: 'danger',
    });
  }

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
    return redirectToResult({
      result: 'invalid',
      title: 'Action Link Not Found',
      message: 'This action link is invalid, expired, or already removed. Please open the portal to check the latest request status.',
      tone: 'danger',
    });
  }

  if (tokenRow.used_at) {
    return redirectToResult({
      result: 'already-handled',
      title: 'Request Already Handled',
      message: `This request was already ${actionPastTense(String(tokenRow.used_action ?? action))}. No further action is needed.`,
      tone: 'warning',
      action: actionPastTense(String(tokenRow.used_action ?? action)),
      handledOn: tokenRow.used_at ? new Date(tokenRow.used_at).toLocaleString('en-IN') : '-',
    });
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return redirectToResult({
      result: 'expired',
      title: 'Link Expired',
      message: 'This approval link has expired. Please open the portal and handle the request from there.',
      tone: 'warning',
    });
  }

  if (tokenRow.action_type && tokenRow.action_type !== action) {
    return redirectToResult({
      result: 'invalid',
      title: 'Wrong Action Link',
      message: 'This link is not valid for the selected action. Please use the correct Approve or Reject button from the email.',
      tone: 'danger',
    });
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
          .update({
            used_at: now,
            used_action: applicant.approval_status === 'approved' ? 'approve' : 'reject',
            used_by: actorProfileId,
            updated_at: now,
          })
          .eq('id', tokenRow.id);

        return redirectToResult({
          result: 'already-handled',
          title: 'Request Already Handled',
          message: `This registration request was already ${statusPastTense(applicant.approval_status)}. No further action is needed.`,
          tone: 'warning',
          requestType: 'registration request',
          applicant: applicant.full_name ?? applicant.username,
          currentStatus: statusPastTense(applicant.approval_status),
        });
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          approval_status: newStatus,
          approved_by: actorProfileId,
          approved_at: now,
          updated_at: now,
        })
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
          .update({
            used_at: now,
            used_action: leaveApplication.status === 'approved' ? 'approve' : 'reject',
            used_by: actorProfileId,
            updated_at: now,
          })
          .eq('id', tokenRow.id);

        return redirectToResult({
          result: 'already-handled',
          title: 'Request Already Handled',
          message: `This leave application was already ${statusPastTense(leaveApplication.status)}. No further action is needed.`,
          tone: 'warning',
          requestType: 'leave application',
          currentStatus: statusPastTense(leaveApplication.status),
        });
      }

      const { error } = await supabaseAdmin
        .from('leave_applications')
        .update({
          status: newStatus,
          admin_response: reviewerNote,
          reviewed_by: actorProfileId,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', tokenRow.target_id);
      if (error) throw error;
    } else {
      throw new Error('Unsupported target table');
    }

    await supabaseAdmin
      .from('email_action_tokens')
      .update({
        used_at: now,
        used_action: action,
        used_by: actorProfileId,
        updated_at: now,
      })
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

    return redirectToResult({
      result: 'success',
      title: action === 'approve' ? 'Request Approved Successfully' : 'Request Rejected Successfully',
      message: `The ${targetText} was ${handledText} successfully. ${notificationText}`,
      tone: action === 'approve' ? 'success' : 'danger',
      action: handledText,
      requestType: targetText,
      handledOn: new Date(now).toLocaleString('en-IN'),
      applicantEmail: tokenRow.target_table === 'profiles' ? (applicantEmailSent ? 'Sent' : 'Not confirmed') : 'Not applicable',
    });
  } catch (error) {
    return redirectToResult({
      result: 'error',
      title: 'Action Failed',
      message: error instanceof Error ? error.message : 'Something went wrong while handling this request.',
      tone: 'danger',
    });
  }
});
