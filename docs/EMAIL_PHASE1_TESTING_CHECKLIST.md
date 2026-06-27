# Email Phase 1 Testing Checklist

## Before testing

- [ ] Resend domain verified for `gsmleave.in` or `mail.gsmleave.in`.
- [ ] Supabase secrets added: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`.
- [ ] SQL file executed successfully.
- [ ] Edge Functions deployed.

## Test 1: Email logs table

Run in Supabase:

```sql
select * from public.email_logs order by created_at desc limit 10;
```

Expected: table exists, no error.

## Test 2: Token table

Run:

```sql
select id, request_type, target_table, action_type, expires_at, used_at
from public.email_action_tokens
order by created_at desc
limit 10;
```

Expected: table exists, no error.

## Test 3: Send test email

Invoke `send-leavesync-email` with your own email address.

Expected:

- Email received.
- `email_logs.status = sent`.

## Test 4: Confirm frontend is unchanged

Expected:

- Staff login still works.
- Principal login still works.
- Director login still works.
- Viewer login still works.

This phase should not change portal behavior yet.
