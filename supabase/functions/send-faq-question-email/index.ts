import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY')!;
    const from = Deno.env.get('EMAIL_FROM') || 'leaveSYNC <noreply@gsmleave.in>';

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Unauthorized');

    const { questionId } = await req.json();
    if (!questionId) throw new Error('questionId is required');
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: question, error: qError } = await admin.from('faq_questions')
      .select('id,category,question,created_at,submitted_by,profiles!faq_questions_submitted_by_fkey(full_name,username,role,college_unit)')
      .eq('id', questionId).single();
    if (qError || !question) throw qError || new Error('Question not found');
    if (question.submitted_by !== userData.user.id) throw new Error('You can only notify for your own question');

    const { data: directors, error: dError } = await admin.from('profiles').select('email')
      .eq('role', 'main_admin').eq('approval_status', 'approved').not('email', 'is', null);
    if (dError) throw dError;
    const recipients = [...new Set((directors || []).map((d) => d.email).filter(Boolean))] as string[];
    if (!recipients.length) throw new Error('No approved Director email is configured');

    const profile = Array.isArray(question.profiles) ? question.profiles[0] : question.profiles;
    const escapeHtml = (value: string) => value.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>New leaveSYNC FAQ Question</h2>
      <p><strong>Submitted by:</strong> ${escapeHtml(profile?.full_name || 'Portal user')} (@${escapeHtml(profile?.username || '-')})</p>
      <p><strong>Role:</strong> ${escapeHtml(profile?.role || '-')} &nbsp; <strong>Unit:</strong> ${escapeHtml(profile?.college_unit || 'All / N/A')}</p>
      <p><strong>Category:</strong> ${escapeHtml(question.category)}</p>
      <div style="padding:12px;border-left:4px solid #d4a017;background:#f8fafc">${escapeHtml(question.question)}</div>
      <p style="color:#6b7280">Open the portal to review and respond through the appropriate communication channel.</p>
    </div>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: recipients, subject: `leaveSYNC FAQ: ${question.category}`, html }),
    });
    if (!response.ok) throw new Error(`Email provider error: ${await response.text()}`);
    return new Response(JSON.stringify({ success: true, recipients: recipients.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
