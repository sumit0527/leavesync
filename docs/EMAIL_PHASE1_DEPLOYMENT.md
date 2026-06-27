# leaveSYNC Email Phase 1 Deployment Guide

This phase only adds the secure foundation for email features. It does not yet automatically send registration or leave emails from the app UI.

## What Phase 1 adds

- `email_logs` table for tracking sent/failed emails.
- `email_action_tokens` table for one-time approve/reject links.
- `send-leavesync-email` Supabase Edge Function for sending email through Resend.
- `email-action` Supabase Edge Function for secure one-time approve/reject links.
- Professional reusable email template.

## Domain and sender

Website domain: `gsmleave.in`

Recommended sender after Resend verification:

```text
leaveSYNC <noreply@gsmleave.in>
```

If Resend asks you to use a subdomain, use:

```text
leaveSYNC <noreply@mail.gsmleave.in>
```

## Required Supabase secrets

Set these secrets in Supabase Edge Functions:

```bash
supabase secrets set RESEND_API_KEY="re_xxxxxxxxxxxxx"
supabase secrets set EMAIL_FROM="leaveSYNC <noreply@gsmleave.in>"
supabase secrets set APP_BASE_URL="https://gsmleave.in"
```

Supabase already provides `SUPABASE_URL` and service role secrets to Edge Functions in hosted projects, but if your function dashboard asks for them, set them there too.

## Deploy Edge Functions

From project root:

```bash
supabase functions deploy send-leavesync-email
supabase functions deploy email-action
```

## SQL setup

Run this file in Supabase SQL Editor:

```text
sql/leavesync_email_phase1_foundation.sql
```

## Test generic email sending

After Resend domain is verified and functions are deployed, test from Supabase Edge Function dashboard or with curl:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-leavesync-email" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to":"your-email@example.com",
    "subject":"leaveSYNC test email",
    "title":"Email Foundation Test",
    "intro":"This confirms that the leaveSYNC email foundation is working.",
    "details":[{"label":"Domain","value":"gsmleave.in"},{"label":"Phase","value":"Email Phase 1"}]
  }'
```

If it sends, Phase 1 is ready.

## Next phase

Phase 2 will connect real events:

- Staff registration → email to Principal.
- Principal registration → email to Director.
- Email approve/reject buttons → user status update + result email.
