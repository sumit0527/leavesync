import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { buildProfessionalEmail, plainTextFromHtml } from '../_shared/emailTemplates.ts';

type DecisionBody = {
  applicantProfileId: string;
  status: 'approved' | 'rejected';
  reviewerRoleLabel?: 'Principal' | 'Principal / UH' | 'Director';
  reviewerName?: string | null;
};

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

async function sendEmail(supabaseAdmin: ReturnType<typeof createClient>, params: {
  to: string;
  subject: string;
  html: string;
  relatedProfileId: string;
  metadata: Record<string, unknown>;
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!resendApiKey) throw new Error('Missing RESEND_API_KEY secret');

  const { data: logRow } = await supabaseAdmin
    .from('email_logs')
    .insert({
      email_type: 'registration_decision',
      recipient: params.to,
      subject: params.subject,
      status: 'pending',
      related_profile_id: params.relatedProfileId,
      metadata: params.metadata,
    })
    .select('id')
    .maybeSingle();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') ?? 'leaveSYNC <noreply@gsmleave.in>',
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: plainTextFromHtml(params.html),
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (logRow?.id) {
      await supabaseAdmin
        .from('email_logs')
        .update({ status: 'failed', error_message: JSON.stringify(result), updated_at: new Date().toISOString() })
        .eq('id', logRow.id);
    }
    throw new Error(JSON.stringify(result));
  }

  if (logRow?.id) {
    await supabaseAdmin
      .from('email_logs')
      .update({ status: 'sent', provider_message_id: result?.id ?? null, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', logRow.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'POST method required' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Missing Supabase function secrets' }, 500);

  let body: DecisionBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.applicantProfileId || !['approved', 'rejected'].includes(body.status)) {
    return jsonResponse({ error: 'applicantProfileId and status are required' }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: applicant, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, email, phone, role, approval_status, approved_at, college_unit, admin_designation')
      .eq('id', body.applicantProfileId)
      .maybeSingle();

    if (error) throw error;
    if (!applicant) return jsonResponse({ error: 'Applicant not found' }, 404);
    if (!applicant.email || !String(applicant.email).includes('@')) {
      return jsonResponse({ success: false, warning: 'Applicant has no email address.' }, 200);
    }

    const isApproved = body.status === 'approved';
    const isPrincipal = ['principal', 'admin'].includes(applicant.role);
    const isDirector = ['director', 'main_admin'].includes(applicant.role);
    const applicantRoleLabel = isPrincipal ? `${formatCollegeUnit((applicant as any).college_unit)} ${formatDesignation((applicant as any).admin_designation)}` : isDirector ? 'Director' : 'Staff';
    const reviewerRoleLabel = body.reviewerRoleLabel ?? (isPrincipal ? 'Director' : 'Principal / UH');
    const reviewerName = clean(body.reviewerName);
    const reviewerDisplay = reviewerName !== '-' ? `${reviewerName} (${reviewerRoleLabel})` : reviewerRoleLabel;

    const subject = isApproved
      ? `${applicantRoleLabel} Account Approved — leaveSYNC`
      : `${applicantRoleLabel} Account Registration Update — leaveSYNC`;

    const html = buildProfessionalEmail({
      title: isApproved ? 'Account Approved' : 'Account Registration Rejected',
      greeting: `Dear ${clean(applicant.full_name)},`,
      intro: isApproved
        ? `Your ${applicantRoleLabel.toLowerCase()} account has been approved by ${reviewerDisplay}. You can now log in to leaveSYNC.`
        : `Your ${applicantRoleLabel.toLowerCase()} account registration has been rejected by ${reviewerDisplay}. Please contact the ${reviewerRoleLabel} office for more information.`,
      details: [
        { label: 'Name', value: applicant.full_name },
        { label: 'Username', value: applicant.username },
        { label: 'Role', value: applicantRoleLabel },
        { label: 'College Unit', value: formatCollegeUnit((applicant as any).college_unit) },
        { label: 'Status', value: isApproved ? 'Approved' : 'Rejected' },
        { label: 'Reviewed By', value: reviewerDisplay },
        { label: 'Reviewed On', value: applicant.approved_at ? new Date(applicant.approved_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN') },
      ],
      note: isApproved
        ? 'Please use the same username and password you used during registration.'
        : `If you believe this was a mistake, please contact the ${reviewerRoleLabel} office.`,
      buttons: [
        { label: 'Open leaveSYNC Login', url: `${(Deno.env.get('APP_BASE_URL') ?? 'https://gsmleave.in').replace(/\/$/, '')}${isPrincipal ? '/admin/login' : '/staff/login'}`, variant: 'default' },
      ],
    });

    await sendEmail(supabaseAdmin, {
      to: applicant.email,
      subject,
      html,
      relatedProfileId: applicant.id,
      metadata: { status: body.status, applicantRole: applicant.role, reviewerRoleLabel, reviewerName: body.reviewerName ?? null },
    });

    return jsonResponse({ success: true, sentTo: applicant.email });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Decision email failed' }, 500);
  }
});
