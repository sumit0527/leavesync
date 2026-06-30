# Email Phase 2 Testing Checklist

## Before testing

- Resend domain status is Verified.
- Supabase secrets exist:
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `APP_BASE_URL`
- Functions deployed:
  - `send-leavesync-email`
  - `email-action`
  - `send-registration-review-email`
  - `send-registration-decision-email`

## Staff registration test

1. Register a new staff account with a real email.
2. Check Principal email inbox.
3. Email subject should mention new staff registration.
4. Email should show:
   - Name
   - Username
   - Role
   - Department
   - Email
   - Phone
   - Address
   - Submitted date
5. Click Approve or Reject.
6. Applicant should receive result email.
7. Portal status should update.
8. Other old email action link should show already handled.

## Principal registration test

1. Register a new Principal account with a real email.
2. Check Director email inbox.
3. Email subject should mention new Principal registration.
4. Click Approve or Reject.
5. Principal applicant should receive result email.
6. Portal status should update.

## Supabase checks

```sql
select * from public.email_logs order by created_at desc limit 20;
select * from public.email_action_tokens order by created_at desc limit 20;
```

Expected:

- `email_logs.status = sent`
- Used email action tokens should have `used_at` filled after clicking Approve/Reject.
