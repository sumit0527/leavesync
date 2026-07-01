import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, htmlResponse, jsonResponse } from '../_shared/cors.ts';

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function statusPage(title: string, message: string, ok = true) {
  const color = ok ? '#15803d' : '#b91c1c';
  return `<!doctype html><html><body style="margin:0;background:#f8f4ea;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:620px;margin:60px auto;padding:24px;"><div style="background:#fff;border:1px solid #eadfca;border-radius:18px;padding:28px;box-shadow:0 8px 24px rgba(80,60,20,.08);"><div style="font-size:13px;color:#a16207;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">leaveSYNC</div><h1 style="color:${color};margin:10px 0 12px;">${title}</h1><p style="color:#374151;line-height:1.6;">${message}</p></div></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const action = (url.searchParams.get('action') || '').toLowerCase();

  if (!token || !['approve', 'reject'].includes(action)) {
    return htmlResponse(statusPage('Invalid action link', 'This email action link is missing required information.', false), 400);
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
    return htmlResponse(statusPage('Action link not found', 'This action link is invalid or has already been removed.', false), 404);
  }

  if (tokenRow.used_at) {
    return htmlResponse(statusPage('Already handled', 'This request was already handled earlier. No further action is needed.', false), 409);
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return htmlResponse(statusPage('Link expired', 'This approval link has expired. Please handle the request from the portal.', false), 410);
  }

  if (tokenRow.action_type && tokenRow.action_type !== action) {
    return htmlResponse(statusPage('Wrong action link', 'This link is not valid for the selected action.', false), 400);
  }

  const now = new Date().toISOString();
  const actorProfileId = tokenRow.actor_profile_id ?? null;
  const reviewerNote = action === 'approve' ? 'Approved from email action link.' : 'Rejected from email action link.';

  try {
    if (tokenRow.target_table === 'profiles') {
const newStatus = action === 'approve' ? 'approved' : 'rejected';

const { error } = await supabaseAdmin
  .from('profiles')
  .update({
    approval_status: newStatus,
    approved_by: actorProfileId,
    approved_at: now,
    updated_at: now
  })
  .eq('id', tokenRow.target_id);

if (error) throw error;

// Send registration decision email to applicant after email-button approval/rejection
const decisionResponse = await fetch(
  `${supabaseUrl}/functions/v1/send-registration-decision-email`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      applicantProfileId: tokenRow.target_id,
      status: newStatus,
      reviewerRoleLabel: tokenRow.actor_role === 'main_admin' ? 'Director' : 'Principal'
    })
  }
);

if (!decisionResponse.ok) {
  const decisionError = await decisionResponse.text().catch(() => '');
  console.error('Registration decision email failed after email action:', decisionError);
}
    } else if (tokenRow.target_table === 'leave_applications') {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
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
      .eq('id', tokenRow.id);

    return htmlResponse(statusPage('Request handled successfully', `The request was ${action === 'approve' ? 'approved' : 'rejected'} successfully.`));
  } catch (error) {
    return htmlResponse(statusPage('Action failed', error instanceof Error ? error.message : 'Something went wrong while handling this request.', false), 500);
  }
});
