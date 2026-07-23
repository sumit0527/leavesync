# LeaveSync — Enterprise Leave Management System

> A full-stack leave management platform built with React + Vite (frontend) and Supabase (backend).

---

## 📁 Project Structure

```
LeaveSync/
│
├── src/                          # Frontend source (React + Vite + TypeScript)
│   ├── app/
│   │   ├── layouts/              # AdminLayout, StaffLayout
│   │   └── providers/            # Theme, Auth providers
│   │
│   ├── features/                 # Feature modules (co-located pages + hooks)
│   │   ├── auth/                 # Login, Register, ForgotPassword
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   └── index.ts          # barrel export
│   │   ├── leave/                # Apply, History, Calendar, Profile
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   ├── admin/                # Dashboard, Analytics, Approvals, Settings
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── index.ts
│   │   └── notifications/
│   │       ├── pages/
│   │       ├── hooks/
│   │       └── index.ts
│   │
│   ├── components/               # Shared UI components
│   │   ├── ui/                   # shadcn/ui (do not edit)
│   │   ├── common/               # RouteGuard, PageMeta
│   │   └── layouts/              # Legacy layout location (kept for compat)
│   │
│   ├── hooks/                    # Global reusable hooks
│   ├── contexts/                 # Auth + Theme context (singleton pattern)
│   ├── services/                 # supabase.ts client
│   ├── db/                       # supabase.ts (legacy, kept for compat)
│   ├── types/                    # Shared TypeScript types
│   ├── lib/                      # Utility functions (cn, formatDate, etc.)
│   ├── routes.tsx                # Route definitions
│   ├── App.tsx                   # Root component
│   └── main.tsx                  # Entry point
│
├── supabase/                     # Backend (Supabase)
│   ├── functions/                # Deno Edge Functions
│   │   ├── _shared/              # Shared utilities (cors, auth, response)
│   │   ├── send-approval-notification/
│   │   ├── ai-chat/
│   │   └── ...
│   └── migrations/               # SQL migrations (managed by platform)
│
├── public/                       # Static assets
├── docs/                         # Documentation & PRD
├── scripts/                      # Utility scripts (create-admin, etc.)
│
├── vercel.json                   # Vercel SPA rewrite rules
├── vite.config.ts                # Vite build config
├── tailwind.config.js            # Tailwind design tokens
├── tsconfig.json                 # TypeScript config
├── components.json               # shadcn/ui config
└── package.json
```

---

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect repo** to Vercel dashboard
2. **Framework preset**: Vite
3. **Build command**: `pnpm build`
4. **Output directory**: `dist`
5. **Environment variables** — add all from `.env`:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |

> `vercel.json` at the root already handles SPA routing (all paths → `/index.html`).

### Supabase Edge Functions

Deploy edge functions from the `supabase/functions/` directory:
```bash
supabase functions deploy send-approval-notification
supabase functions deploy ai-chat
```

Set secrets:
```bash
supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set GEMINI_API_KEY=AIza_xxxx
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 👥 Roles

| Role | Access |
|---|---|
| **Admin** | Full dashboard — approve/reject leaves, manage staff, analytics |
| **Staff** | Apply for leave, view history, check allocation balance |

---

## 📧 Email Notifications (Resend)

1. Sign up at [resend.com](https://resend.com)
2. Add & verify your sending domain
3. Create an API key
4. Add to Supabase secrets: `supabase secrets set RESEND_API_KEY=re_xxxx`
5. Emails are sent automatically on approve/reject via the `send-approval-notification` edge function

---

## 🤖 LeaveSync AI Insights Chatbot

LeaveSync AI is a **read-only Director/Viewer assistant** for portal data. It now uses a deterministic portal query engine first, then Gemini only polishes the wording.

### Correct answer flow

```text
Director/Viewer question
→ ai-portal-insights Edge Function
→ detect unit / role / status / topic / date
→ run exact safe Supabase query logic
→ Gemini rewrites only the exact result
→ final answer shown in chatbot
```

This avoids the old problem where AI guessed from broad data. Counts and lists come from exact portal records.

### Safe data scope

The chatbot can answer from the same safe information available in Director/Viewer portal sections:

- users: Staff, Principal, UH, Director, Viewer
- registration status: pending, approved, rejected
- college units: Junior, Senior, Pharmacy
- departments and department-wise summaries
- leave applications by unit, department, role, type, status, date
- analytics/report style summaries
- leave balance/allocation summaries
- calendar-style leave info: today, tomorrow, week, month, upcoming
- holidays and recent notifications

The chatbot must not expose sensitive details: passwords, tokens, API keys, emails, phone numbers, personal addresses, bank details, health/medical details, or detailed leave reasons. It also cannot approve, reject, edit, delete, or create records.

### Example questions

```text
How many pending staff in Pharmacy?
Show approved staff in Senior College.
Show Principal and UH status unit-wise.
Give me overall analytics report.
Give me analytics report unit-wise.
Show department-wise staff summary.
Show department-wise leave applications.
How many departments are in Junior College?
Which unit has the most pending leaves?
Show pending leaves older than 24 hours.
Who is on leave today?
Show this week approved leaves.
Which leave type is used most?
Show low leave balance users.
Show pending applications unit-wise.
What about Senior?
```

### Chat behavior

- Welcome message is short.
- Quick insight buttons are available above the messages.
- Follow-up memory works only inside the current open chat.
- Browser refresh clears the chat.
- Long lists are limited to a preview with a message to narrow by unit, role, status, department, or name.

### Deploy AI function

```bash
supabase functions deploy ai-portal-insights --project-ref ygndxtfgmbakemlvgtai
```

Set the free Gemini key:

```bash
supabase secrets set GEMINI_API_KEY=YOUR_FREE_GEMINI_API_KEY --project-ref ygndxtfgmbakemlvgtai
```

Optional model override:

```bash
supabase secrets set FREE_AI_MODEL=gemini-1.5-flash-latest --project-ref ygndxtfgmbakemlvgtai
```

Redeploy after setting secrets:

```bash
supabase functions deploy ai-portal-insights --project-ref ygndxtfgmbakemlvgtai
```
