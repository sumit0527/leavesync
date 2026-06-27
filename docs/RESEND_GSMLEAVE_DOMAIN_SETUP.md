# Resend Domain Setup for gsmleave.in

1. Open Resend Dashboard.
2. Go to Domains.
3. Add domain:

```text
gsmleave.in
```

If Resend recommends a subdomain, use:

```text
mail.gsmleave.in
```

4. Copy the DNS records shown by Resend.
5. Open your domain DNS provider for `gsmleave.in`.
6. Add the DNS records exactly as Resend shows.
7. Go back to Resend and click verify/check DNS.
8. Wait until the domain status becomes verified.
9. Create or use sender:

```text
leaveSYNC <noreply@gsmleave.in>
```

or, if using mail subdomain:

```text
leaveSYNC <noreply@mail.gsmleave.in>
```

Do not put the Resend API key in Vercel or React frontend. Store it only in Supabase Edge Function secrets.
