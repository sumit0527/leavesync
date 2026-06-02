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
