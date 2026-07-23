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

LeaveSync AI is a **read-only Director/Viewer assistant**. It answers natural-language questions using live Supabase portal data and a free Gemini key when configured.

### What it can answer

The assistant is designed for portal questions about:

- Junior / Senior / Pharmacy unit-wise users
- Staff, Principal, UH, Director, and Viewer counts
- Pending / approved / rejected registrations
- Leave applications by status, unit, role, person, leave type, and date range
- People on leave today / tomorrow / this week / this month
- Leave balances and low-balance users
- Departments by unit
- Notifications summary
- 24-hour pending staff leaves ready for Director review
- Unit-wise analytics-style summaries

### Example questions for demo

Use these during testing:

- How many pending staff in Pharmacy?
- Show approved staff in Senior.
- Show Junior Principal and UH status.
- Which unit has the most pending registrations?
- Show pending leave requests older than 24 hours.
- Who is on leave today?
- Show Pharmacy leave applications.
- Which leave type is used most?
- Show low leave balance users.
- How many departments are in Senior?
- Give me today’s Director summary.
- Compare users unit-wise.
- Show leave applications by status.

### Answer behavior

- Count questions return short count-first answers.
- List questions show only a safe preview, not every record.
- If many records match, it shows a limited list and asks the user to narrow by unit, status, role, leave type, department, or person.
- The AI does not approve, reject, delete, edit, or update portal records.
- Non-portal questions are refused politely.

### Chat memory

- The current chat context is sent to the Edge Function for follow-up questions.
- Example: after asking “pending staff in Pharmacy”, the user can ask “what about Senior?” and it understands the previous topic.
- Chat is stored only in React component state.
- Refreshing the browser clears the chat completely.

### Voice support

- Voice input uses the free browser/device speech capability where supported.
- Voice output uses browser speech synthesis where supported.
- Unsupported devices hide unavailable voice buttons or show a typing fallback.
- No paid voice API is required.

### Setup

Deploy the Edge Function:

```bash
supabase functions deploy ai-portal-insights --project-ref ygndxtfgmbakemlvgtai
```

Set the free AI key:

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

If the key/quota is unavailable, the assistant falls back to deterministic portal answers from live Supabase data.
