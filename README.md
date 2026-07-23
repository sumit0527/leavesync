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

LeaveSync includes a free AI-powered, read-only portal assistant for the **Director** and **Viewer** portals. The assistant answers natural language questions using live portal data from Supabase. It does not approve, reject, delete, or edit anything.

### Availability

| Portal | AI Assistant |
|---|---|
| Director | Enabled |
| Viewer | Enabled, read-only |
| Principal / UH | Not enabled by default |
| Staff | Not enabled by default |

### AI provider

The assistant uses a free Google AI Studio / Gemini key through the Supabase Edge Function:

```bash
supabase functions deploy ai-portal-insights --project-ref ygndxtfgmbakemlvgtai
supabase secrets set GEMINI_API_KEY=YOUR_FREE_GEMINI_API_KEY --project-ref ygndxtfgmbakemlvgtai
supabase functions deploy ai-portal-insights --project-ref ygndxtfgmbakemlvgtai
```

No paid OpenAI/Gemini billing is required for the intended free-tier setup, but the project owner should still monitor API quota limits in Google AI Studio.

### Chat history behavior

- Chat messages are stored only in the browser component state.
- Refreshing the page clears the chat automatically.
- The chatbot clear/refresh button also resets the conversation.
- No chat history table is created in Supabase.

### Voice support

The chatbot supports optional browser-based voice features:

- Voice input uses the browser Web Speech API where supported.
- Voice reply uses browser speech synthesis when enabled.
- Unsupported browsers fall back to normal typed input.
- No extra paid service is required for voice input/output.

### List and privacy behavior

To avoid long, confusing, scroll-heavy answers:

- Count questions return counts first.
- List questions show a maximum of 12 records.
- If more records exist, the assistant says how many more and suggests narrowing by unit, status, role, or person.
- The assistant should not dump every staff member unless the user explicitly asks and the list is small.

### Example questions the assistant can answer

#### Overall portal

- Give me today’s portal summary.
- What is the overall status of the portal?
- How many active users are there?
- How many approved users are there?
- How many pending registrations are there?
- Which unit has the most users?
- Which unit has the most pending work?
- Show user count unit-wise.
- Show staff, Principal, and UH count unit-wise.

#### Unit-wise people

- How many pending staff are in Pharmacy?
- How many approved staff are in Senior?
- How many Junior Principal/UH accounts are approved?
- Show pending UH in Pharmacy.
- Show approved Principal in Junior.
- List Senior staff.
- List Pharmacy approved staff.
- How many users are in Junior College?
- How many staff are pending in each unit?
- Which units have no approved UH?
- Which units have no approved Principal?

#### Registration and approvals

- Show pending registrations.
- Show pending staff registrations.
- Show pending Principal/UH registrations.
- Show pending registrations in Senior.
- How many Pharmacy registrations are pending?
- Which registration requests are waiting for Director approval?
- Which staff registrations are waiting for Principal/UH approval?
- Show rejected registrations.
- Show approved registrations today.

#### Leave applications

- How many leave applications are pending?
- Show pending leaves in Senior.
- Show approved leaves in Pharmacy.
- Show rejected leaves in Junior.
- Which leave applications are pending for more than 24 hours?
- Show staff leave requests ready for Director review.
- Show Principal/UH leave requests.
- How many leave requests were approved this month?
- Which unit has the most leave applications?
- Which leave type is used most?
- Show leave applications by unit.
- Show leave applications by status.
- Show leave applications by leave type.

#### Calendar and date questions

- Who is on leave today?
- Who is on leave tomorrow?
- Who is on leave this week?
- Show today’s leave summary.
- Show upcoming leaves.
- Which unit has people on leave today?
- Show approved leaves between two dates.
- How many staff are absent today because of approved leave?

#### Leave balance and allocation

- Show low leave balance users.
- Which staff have low Casual Leave balance?
- Show leave balance for Senior staff.
- Show Pharmacy leave allocation summary.
- Which users have used the most leave?
- Which leave type has the lowest remaining balance?
- Show users with zero remaining leave.
- Show leave balance by leave type.
- Show this year’s leave allocation status.

#### Departments

- How many departments are in Senior?
- Show departments in Junior.
- Show Pharmacy departments.
- Which unit has the most departments?
- Show department-wise staff count.
- Which departments have pending staff?
- Show leave applications department-wise.

#### Reports and analytics

- Give me unit-wise analytics.
- Show leave trend by unit.
- Which unit has the highest leave usage?
- Show approved versus pending leave count.
- Show registration summary by unit.
- Show staff count and leave count together.
- Show high-level Director summary.
- Give me a quick report for today.
- Give me a monthly leave summary.
- Give me a summary for Pharmacy College.

#### Safety and scope

The assistant should politely refuse non-portal questions, for example:

- Tell me a movie recommendation.
- Write my homework.
- Tell me cricket score.

It should respond that it can only answer LeaveSync portal-related questions.
