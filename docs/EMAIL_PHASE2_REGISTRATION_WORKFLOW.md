# leaveSYNC Email Phase 2 — Registration Email Workflow

Phase 2 connects real registration events to your working Resend + Supabase Edge Function email foundation.

## Added in this phase

1. Staff registration email
   - Staff registers from Staff Register page.
   - Email goes to every approved Principal account with an email address.
   - Email includes complete applicant details and secure Approve / Reject buttons.

2. Principal registration email
   - Principal registers from Principal Registration page.
   - Email goes to every approved Director account with an email address.
   - Email includes complete applicant details and secure Approve / Reject buttons.

3. Decision email
   - If Principal/Director approves or rejects from portal, applicant gets email result.
   - If Principal/Director approves or rejects from email button, applicant also gets email result.

4. Email action safety
   - Approve/Reject links are one-time secure tokens.
   - Links expire after 7 days.
   - If one reviewer handles the request, other links for the same request are closed.
   - If the request is already handled, old links show an Already handled page.

## Files added

- `src/lib/email-notifications.ts`
- `supabase/functions/send-registration-review-email/index.ts`
- `supabase/functions/send-registration-decision-email/index.ts`

## Files updated

- `src/pages/auth/StaffRegister.tsx`
- `src/features/auth/pages/StaffRegister.tsx`
- `src/pages/auth/AdminRegister.tsx`
- `src/features/auth/pages/AdminRegister.tsx`
- `src/pages/admin/EmployeeApproval.tsx`
- `src/features/admin/pages/EmployeeApproval.tsx`
- `supabase/functions/email-action/index.ts`

## Deploy commands

Run these after replacing files:

```bash
npx supabase functions deploy send-registration-review-email
npx supabase functions deploy send-registration-decision-email
npx supabase functions deploy email-action
```

## Test order

1. Create a new staff account using a real email.
2. Confirm Principal receives registration review email.
3. Approve from portal first.
4. Confirm staff receives account approved email.
5. Create another staff test account.
6. Approve/reject using email button.
7. Confirm applicant receives result email and portal status changes.
8. Repeat same flow for Principal registration → Director email.

## Important

For emails to be delivered, the reviewer accounts must have real emails in `profiles.email`:

- Approved Principal profiles need email addresses for staff registration emails.
- Approved Director profiles need email addresses for Principal registration emails.
