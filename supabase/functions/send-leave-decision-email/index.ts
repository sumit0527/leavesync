import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { buildProfessionalEmail, plainTextFromHtml } from '../_shared/emailTemplates.ts';

type SendBody = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  title?: string;
  greeting?: string;
  intro?: string;
  details?: Array<{ label: string; value: string | number | null }>;
  note?: string;
  buttons?: Array<{ label: string; url: string; variant?: 'approve' | 'reject' | 'default' }>;
  emailType?: string;
  relatedProfileId?: string | null;
  relatedApplicationId?: string | null;
  metadata?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'POST method required' }, 405);

  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const fromEmail = Deno.env.get('EMAIL_FROM') ?? 'leaveSYNC <noreply@gsmleave.in>';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!resendApiKey) return jsonResponse({ error: 'Missing RESEND_API_KEY secret' }, 500);
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Missing Supabase function secrets' }, 500);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const recipients = Array.isArray(body.to) ? body.to : [body.to];
  const cleanRecipients = recipients.map((email) => String(email).trim()).filter(Boolean);

  if (cleanRecipients.length === 0 || !body.subject) {
    return jsonResponse({ error: 'to and subject are required' }, 400);
  }

  const html = body.html || buildProfessionalEmail({
    title: body.title || body.subject,
    greeting: body.greeting,
    intro: body.intro || 'A leaveSYNC notification requires your attention.',
    details: body.details,
    note: body.note,
    buttons: body.buttons,
  });
  const text = body.text || plainTextFromHtml(html);

  const logPayload = {
    email_type: body.emailType || 'manual_phase1',
    recipient: cleanRecipients.join(', '),
    subject: body.subject,
    status: 'pending',
    related_profile_id: body.relatedProfileId ?? null,
    related_application_id: body.relatedApplicationId ?? null,
    metadata: body.metadata ?? {},
  };

  const { data: logRow } = await supabaseAdmin
    .from('email_logs')
    .insert(logPayload)
    .select('id')
    .maybeSingle();

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: cleanRecipients,
      subject: body.subject,
      html,
      text,
    }),
  });

  const resendResult = await resendResponse.json().catch(() => ({}));

  if (!resendResponse.ok) {
    if (logRow?.id) {
      await supabaseAdmin
        .from('email_logs')
        .update({ status: 'failed', error_message: JSON.stringify(resendResult), updated_at: new Date().toISOString() })
        .eq('id', logRow.id);
    }
    return jsonResponse({ error: 'Email send failed', details: resendResult }, 502);
  }

  if (logRow?.id) {
    await supabaseAdmin
      .from('email_logs')
      .update({ status: 'sent', provider_message_id: resendResult?.id ?? null, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', logRow.id);
  }

  return jsonResponse({ success: true, providerMessageId: resendResult?.id ?? null });
});
