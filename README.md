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

LeaveSync AI is a **read-only Director/Viewer chatbot** for portal insights. It uses live Supabase data plus the configured free Gemini key to understand natural questions and answer from the same information visible in the Director/Viewer portal.

### Safe access rules

The chatbot can read and summarize portal data for:

- users: Staff, Principal, UH, Director, Viewer
- college units: Junior, Senior, Pharmacy
- departments and department-wise staff/application counts
- registrations: pending, approved, rejected
- leave applications: status, unit, role, department, leave type, dates, duration
- analytics/report summaries: total, approved, pending, rejected, unit-wise, department-wise, leave type usage
- leave balances and low-balance users
- calendar-style insights such as today, tomorrow, this week, this month
- notifications and 24-hour pending staff leaves for Director review

The chatbot must **not** expose sensitive data such as passwords, tokens, API keys, phone numbers, email addresses, personal addresses, bank details, health/medical details, or detailed leave reasons. It also cannot approve, reject, edit, delete, or create records.

### Demo questions

- How many pending staff are in Pharmacy?
- Show approved staff in Senior College.
- Show Principal and UH status unit-wise.
- Give me an analytics report unit-wise.
- Show department-wise staff summary.
- Show department-wise applications.
- Which unit has the most pending leaves?
- Which leave type is used most this year?
- Who is on leave today?
- Show pending leaves older than 24 hours.
- Show low leave balance users.
- How many departments are in Junior College?
- Compare registrations unit-wise.
- Show pending applications by unit and role.
- What about Senior? *(works as a follow-up question in the current chat)*

### Chat behavior

- Welcome message is short and clean.
- Quick insight buttons appear above the messages for fast Director/Viewer questions.
- Answers are focused on the question and should not dump unrelated data.
- Large lists are limited to a safe preview. The bot tells the user how many more records exist and asks them to narrow the question.
- Current chat memory is passed to the Edge Function for follow-up questions only.
- Browser refresh clears the chat completely.

### Voice input

Voice input records audio in the browser and sends it to the `ai-portal-insights` Edge Function. Gemini transcribes the audio and then answers using portal data.

Requirements:

- `GEMINI_API_KEY` must be set in Supabase secrets.
- The browser/device must allow microphone permission.
- If a mobile browser does not support audio recording or permission is blocked, the user can still type the question.
- There is no speaker/read-aloud icon because the portal needs question input, not noisy voice output.

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
