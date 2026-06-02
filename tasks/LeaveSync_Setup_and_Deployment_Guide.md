# LeaveSync — G.D. Sawant College
## Setup, Deployment & Integration Guide

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Machine Setup](#2-local-machine-setup)
3. [Supabase Cloud Setup](#3-supabase-cloud-setup)
4. [Environment Configuration](#4-environment-configuration)
5. [Database Initialization](#5-database-initialization)
6. [Storage Bucket Setup](#6-storage-bucket-setup)
7. [Edge Function Deployment](#7-edge-function-deployment)
8. [Running the Application Locally](#8-running-the-application-locally)
9. [Production Deployment (Vercel)](#9-production-deployment-vercel)
10. [Production Deployment (Netlify — Alternative)](#10-production-deployment-netlify--alternative)
11. [First-Time Application Setup](#11-first-time-application-setup)
12. [Maintenance & Operations](#12-maintenance--operations)
13. [Troubleshooting](#13-troubleshooting)
14. [Environment Variables Reference](#14-environment-variables-reference)

---

## 1. Prerequisites

Ensure the following are installed on your machine before starting:

| Tool | Version | Download |
|---|---|---|
| Node.js | v18 or newer | https://nodejs.org |
| pnpm | v8 or newer | `npm install -g pnpm` |
| Supabase CLI | Latest | https://supabase.com/docs/guides/cli |
| Git | Any modern version | https://git-scm.com |

Verify installations:
```bash
node --version     # Should print v18.x.x or higher
pnpm --version     # Should print 8.x.x or higher
supabase --version # Should print 1.x.x or higher
git --version
```

You will also need:
- A **Supabase account** — free tier is sufficient: https://supabase.com
- A **Vercel** or **Netlify** account for hosting — both have free tiers
- A modern web browser (Chrome, Firefox, Edge, Safari)

---

## 2. Local Machine Setup

### Step 1: Clone / Download the Project

If you received the project as a ZIP file, extract it. If you have a Git repository:

```bash
git clone <your-repository-url>
cd app-bmt0l5ltqby9
```

Or if you are working directly in the project folder:
```bash
cd /path/to/your/project-folder
```

### Step 2: Install Dependencies

```bash
pnpm install
```

This installs all required packages including React, Supabase JS client, jsPDF, Recharts, and all UI components. The first install may take 1–2 minutes.

### Step 3: Verify Project Structure

```
project-folder/
├── src/
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React context (auth, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── pages/
│   │   ├── admin/        # Admin portal pages
│   │   ├── auth/         # Login, Register, Forgot pages
│   │   └── staff/        # Staff portal pages
│   ├── routes.tsx         # All app routes
│   └── main.tsx           # App entry point
├── supabase/
│   ├── functions/        # Edge functions (Deno)
│   └── migrations/       # SQL migrations
├── .env                  # Environment variables (create this — see Section 4)
├── package.json
└── vite.config.ts
```

---

## 3. Supabase Cloud Setup

### Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click **New Project**
3. Fill in:
   - **Name:** `leavesync-gd-sawant` (or any name you prefer)
   - **Database Password:** Choose a strong password and **save it securely**
   - **Region:** Select the region closest to India (e.g. `ap-south-1` — Mumbai, or `ap-southeast-1` — Singapore)
4. Click **Create new project**
5. Wait 1–2 minutes for the project to finish provisioning

### Step 2: Get Your Project Credentials

Once the project is ready:

1. In the Supabase dashboard, go to **Settings → API**
2. Copy the following values — you will need them in the next step:

| Value | Location in Dashboard | Used For |
|---|---|---|
| **Project URL** | Settings → API → Project URL | `VITE_SUPABASE_URL` |
| **anon / public key** | Settings → API → Project API keys | `VITE_SUPABASE_ANON_KEY` |
| **service_role key** | Settings → API → Project API keys → service_role (click reveal) | `SUPABASE_SERVICE_KEY` |

> ⚠️ **Important:** The `service_role` key has full database access. **Never** put it in your frontend code or commit it to a public Git repository.

### Step 3: Link Supabase CLI to Your Project

```bash
supabase login
# This opens a browser — sign in to your Supabase account

supabase link --project-ref <your-project-ref>
# Your project-ref is in the URL: https://supabase.com/dashboard/project/<project-ref>
```

---

## 4. Environment Configuration

Create a file named `.env` in the project root folder (same level as `package.json`):

```bash
# Navigate to your project folder, then:
touch .env
```

Open `.env` in any text editor and add:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
VITE_APP_ID=leavesync-gds
```

Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference (e.g. `abcdefghijklmnop`)
- `YOUR_ANON_KEY_HERE` with the `anon` public key from Settings → API
- `YOUR_SERVICE_ROLE_KEY_HERE` with the `service_role` key from Settings → API

> ℹ️ Variables starting with `VITE_` are available in the frontend code.  
> Variables without `VITE_` prefix are only used server-side (edge functions, migrations).

---

## 5. Database Initialization

The project includes all SQL migrations in `supabase/migrations/`. Run them in order:

### Option A: Using Supabase CLI (Recommended)

```bash
# Make sure you are in the project root and have linked your project (Section 3, Step 3)
supabase db push
```

This automatically applies all pending migrations. You should see output confirming each migration ran successfully.

### Option B: Manual via Supabase SQL Editor

If the CLI method does not work, run each migration file manually:

1. Go to your Supabase dashboard → **SQL Editor**
2. Open each file in `supabase/migrations/` in **numerical order**:
   - `00001_create_initial_schema.sql`
   - `00002_add_departments_and_leave_types.sql`
   - `00003_update_handle_new_user_trigger.sql`
   - `00004_add_helper_functions.sql`
   - `00005_allow_anon_read_departments.sql`
   - `00006_notify_admins_on_new_staff_registration.sql`
   - `00007_trigger_update_leave_allocations_on_approval.sql`
   - `00008_fix_trigger_and_backfill_used.sql`
   - `00009_yearly_leave_reset_and_admin_secret.sql`
   - `00010_create_leave_documents_bucket.sql`
3. Copy the content of each file, paste it into the SQL Editor, and click **Run**
4. Verify each runs without errors before proceeding to the next

### Verify the Database

After running all migrations, check in **Table Editor** that these tables exist:
- `profiles`
- `leave_applications`
- `leave_types`
- `departments`
- `staff_leave_allocations`
- `notifications`
- `holidays`
- `admin_settings`

### Seed Initial Data (Required)

After migrations, add the data your system needs to function. Run this in the **SQL Editor**:

```sql
-- Add sample departments (customize these to match real college departments)
INSERT INTO departments (name, description) VALUES
  ('Computer Science', 'CS & IT Department'),
  ('Mathematics', 'Mathematics Department'),
  ('Physics', 'Physics Department'),
  ('Chemistry', 'Chemistry Department'),
  ('English', 'English & Literature Department'),
  ('Administration', 'Administrative Staff'),
  ('Library', 'Library Department')
ON CONFLICT (name) DO NOTHING;

-- Add leave types (customize allocations to college policy)
INSERT INTO leave_types (name, description, annual_allocation, requires_document) VALUES
  ('Casual Leave', 'For personal and family matters', 12, false),
  ('Sick Leave', 'For medical illness or injury', 10, true),
  ('Earned Leave', 'Earned through service, can be carried forward', 15, false),
  ('Maternity Leave', 'For new mothers', 180, true),
  ('Paternity Leave', 'For new fathers', 15, true),
  ('Study Leave', 'For academic development', 5, true),
  ('Duty Leave', 'For official duties outside college', 10, false)
ON CONFLICT (name) DO NOTHING;

-- Add college holidays for 2026 (customize to actual college calendar)
INSERT INTO holidays (date, name) VALUES
  ('2026-01-01', 'New Year Day'),
  ('2026-01-26', 'Republic Day'),
  ('2026-03-10', 'Holi'),
  ('2026-04-02', 'Ram Navami'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-14', 'Ambedkar Jayanti'),
  ('2026-04-30', 'Maharashtra Day'),
  ('2026-05-01', 'Labour Day'),
  ('2026-08-15', 'Independence Day'),
  ('2026-08-25', 'Ganesh Chaturthi'),
  ('2026-10-02', 'Gandhi Jayanti'),
  ('2026-10-24', 'Dussehra'),
  ('2026-11-14', 'Diwali'),
  ('2026-12-25', 'Christmas Day')
ON CONFLICT (date) DO NOTHING;
```

---

## 6. Storage Bucket Setup

Migration `00010` already creates the `leave-documents` bucket with RLS policies. Verify it exists:

1. Go to Supabase dashboard → **Storage**
2. You should see a bucket named **leave-documents**
3. If it is missing, run this SQL in the SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('leave-documents', 'leave-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow staff to upload their own documents
CREATE POLICY IF NOT EXISTS "staff_upload_documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'leave-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow staff to read their own documents
CREATE POLICY IF NOT EXISTS "staff_read_own_documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'leave-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow admins to read all documents
CREATE POLICY IF NOT EXISTS "admin_read_all_documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'leave-documents' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## 7. Edge Function Deployment

The project has four edge functions. Deploy them using the Supabase CLI:

```bash
# Deploy all edge functions
supabase functions deploy generate-ai-response
supabase functions deploy reset-user-password
supabase functions deploy send-leave-notification
supabase functions deploy send-approval-notification
```

### Set Edge Function Secrets

The edge functions need environment secrets. Set them using the CLI:

```bash
# The INTEGRATIONS_API_KEY is platform-managed — only needed if you are
# running outside the Miaoda/Appmedo platform. If deploying on your own
# Supabase project, this secret handles AI calls through your own API key.

supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
```

> ℹ️ `SUPABASE_URL` and `SUPABASE_ANON_KEY` are automatically injected into edge functions by Supabase.  
> `SUPABASE_SERVICE_ROLE_KEY` must be set manually for the `reset-user-password` function to work.

To verify secrets are set:
```bash
supabase secrets list
```

---

## 8. Running the Application Locally

Once everything is set up:

```bash
# Start the development server
pnpm dev
```

Open your browser and navigate to: **http://localhost:5173**

The application should load with the staff login page. 

### First Steps After Local Launch

1. **Register the first admin account:**
   - Go to http://localhost:5173/admin/register
   - The default admin secret key is: `GDS2026ADMIN`
   - Fill in all required fields and register

2. **Change the admin secret key immediately:**
   - Log in as admin
   - Go to Admin Profile → **Change Admin Secret Key**
   - Set a strong, unique key

3. **Register a test staff account:**
   - Go to http://localhost:5173/staff/register
   - Register with a test username
   - Log in as admin → Employee Approval → approve the account

4. **Test the full workflow:**
   - Log in as the staff member → Apply Leave → submit an application
   - Log in as admin → Pending Applications → approve/reject

---

## 9. Production Deployment (Vercel)

Vercel is the recommended deployment platform — it is free for this type of project and optimised for React/Vite apps.

### Step 1: Prepare Your Project

Make sure your project is in a Git repository (GitHub, GitLab, or Bitbucket):

```bash
git add .
git commit -m "Initial LeaveSync deployment"
git push origin main
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com and sign in (use your GitHub account for easiest setup)
2. Click **Add New → Project**
3. Select your Git repository
4. Vercel will auto-detect it as a Vite project
5. Under **Build & Output Settings**, verify:
   - **Framework Preset:** Vite
   - **Build Command:** `pnpm run build`
   - **Output Directory:** `dist`
6. Under **Environment Variables**, add each variable from your `.env` file:

| Variable Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_APP_ID` | `leavesync-gds` (or your chosen ID) |

> ⚠️ Do **not** add `SUPABASE_SERVICE_KEY` to Vercel environment variables — it is only used by edge functions which run on Supabase servers, not on Vercel.

7. Click **Deploy**
8. Wait 1–3 minutes — Vercel will show a live URL when done (e.g. `https://leavesync-gds.vercel.app`)

### Step 3: Configure SPA Routing

React Router requires all routes to return `index.html`. Add a `vercel.json` file to your project root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

Commit and push this file — Vercel will auto-redeploy.

### Step 4: Add Your Domain (Optional)

1. In Vercel dashboard → your project → **Settings → Domains**
2. Add your custom domain (e.g. `leavesync.gdscollege.edu.in`)
3. Follow Vercel's instructions to update your domain's DNS records

---

## 10. Production Deployment (Netlify — Alternative)

If you prefer Netlify over Vercel:

### Step 1: Build the Project

```bash
pnpm run build
```

This creates a `dist/` folder with the compiled application.

### Step 2: Deploy via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

Or drag and drop the `dist/` folder at https://app.netlify.com/drop

### Step 3: Set Environment Variables

In Netlify dashboard → your site → **Site Settings → Environment variables**, add the same variables as in Section 9, Step 6.

### Step 4: Configure SPA Routing

Create a file `public/_redirects` with this content:
```
/*    /index.html   200
```

This must be in the `public/` folder so Vite copies it to `dist/` during build.

---

## 11. First-Time Application Setup

After deployment, follow these steps to set up the live application:

### 1. Register the College Administrator

Go to `https://your-app-url/admin/register`

Use the default admin secret key: **`GDS2026ADMIN`**

Fill in the admin's real name, choose a strong username and password.

### 2. Change the Admin Secret Key

Immediately after registration:
- Log in as admin
- Go to **Admin Profile** (top-right menu or sidebar)
- Click **Change Admin Secret Key**
- Enter the current key (`GDS2026ADMIN`) and set a new, strong key
- Inform all future admins of the new key through a secure channel

### 3. Add College Departments

- Go to **Admin → Departments**
- Create all departments that exist in the college
- These will appear in the staff registration form's department dropdown

### 4. Configure Leave Types

- Go to **Admin → Leave Types**
- Review and adjust the seeded leave types (or delete and create fresh ones)
- Set accurate `Annual Allocation` days as per college policy
- Enable `Requires Document` for leave types that need medical certificates, etc.

### 5. Add College Holidays

- Go to **Admin → Calendar** (or update via SQL Editor)
- Add all official college holidays for the current academic year
- These dates will be excluded from leave day calculations

### 6. Staff Registration Process

Share the registration URL with all staff: `https://your-app-url/staff/register`

Staff register themselves → Admin approves from **Employee Approval** page → Staff can then apply for leave.

---

## 12. Maintenance & Operations

### Yearly Leave Reset

Leave allocations (days used) are automatically reset to 0 on **1 January at 00:00 UTC** by a scheduled `pg_cron` job. No manual action is required.

If you need to manually trigger the reset (e.g. for testing):
```sql
-- Run in Supabase SQL Editor
SELECT reset_yearly_leave_allocations();
```

### Adding New Staff After Deployment

Staff self-register via the registration page. Admins then approve accounts from the **Employee Approval** section. Leave allocations for new staff are automatically created when a new leave type is assigned.

### Rotating the Admin Secret Key

From **Admin Profile → Change Admin Secret Key**. The old key immediately stops working for new admin registrations. Ensure all admins with legitimate access are informed of the new key.

### Database Backups

Supabase automatically backs up your database on paid plans. On the free tier, take manual backups periodically:
- Supabase dashboard → **Database → Backups**
- Or export via: `supabase db dump > backup_$(date +%Y%m%d).sql`

### Monitoring Edge Functions

View edge function logs in real-time:
```bash
supabase functions logs generate-ai-response --tail
supabase functions logs reset-user-password --tail
```

Or in the Supabase dashboard → **Edge Functions → your function → Logs**.

---

## 13. Troubleshooting

### "Bucket not found" when viewing/uploading documents

**Cause:** The `leave-documents` storage bucket was not created.  
**Fix:** Run the SQL in Section 6 to create the bucket and its RLS policies.

### "Invalid admin secret key" at admin login

**Cause:** The key entered doesn't match the value in `admin_settings.value` where `key = 'admin_secret_key'`.  
**Fix:** Check the current key via SQL Editor:
```sql
SELECT value FROM admin_settings WHERE key = 'admin_secret_key';
```

### "Failed to generate AI response"

**Cause:** The `INTEGRATIONS_API_KEY` secret is not set in the edge function environment.  
**Fix:** This key is platform-managed on Miaoda/Appmedo. If deploying independently, you need to integrate your own Gemini API key:
1. Get a Gemini API key from https://aistudio.google.com
2. Set it as a secret: `supabase secrets set GEMINI_API_KEY=your_key_here`
3. Update `supabase/functions/generate-ai-response/index.ts` to use `Deno.env.get('GEMINI_API_KEY')` and point to the standard Gemini endpoint

### Pages show blank after deployment

**Cause:** The server is not redirecting all requests to `index.html` (required for React Router).  
**Fix:** Add `vercel.json` (for Vercel) or `public/_redirects` (for Netlify) as described in Sections 9 and 10.

### Staff cannot submit leave applications

**Cause:** Staff account `approval_status` is still `'pending'`.  
**Fix:** Admin must approve the account from **Employee Approval** page. Or check directly:
```sql
SELECT username, approval_status FROM profiles WHERE role = 'staff';
UPDATE profiles SET approval_status = 'approved' WHERE username = 'problematic_username';
```

### Leave days calculating incorrectly

**Cause:** Holidays table may be empty or missing entries for the current year.  
**Fix:** Add holidays via the Admin Calendar page or with the SQL from Section 5.

### PDF reports not downloading

**Cause:** Browser popup blocker may be blocking the download.  
**Fix:** Allow popups/downloads from your application domain in browser settings.

---

## 14. Environment Variables Reference

| Variable | Required | Exposed To | Description |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ Yes | Frontend (browser) | Supabase project API URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Frontend (browser) | Supabase public anon key for RLS-gated queries |
| `SUPABASE_SERVICE_KEY` | ✅ Yes | Backend / Edge functions only | Full service role key — **never expose in frontend** |
| `VITE_APP_ID` | Optional | Frontend | Application identifier |
| `INTEGRATIONS_API_KEY` | Auto-injected | Edge functions only | Platform AI gateway key — **do not register manually** |

---

## Quick Reference — Important URLs

After deployment, bookmark these URLs:

| Page | URL |
|---|---|
| Staff Login | `https://your-domain/staff/login` |
| Staff Register | `https://your-domain/staff/register` |
| Admin Login | `https://your-domain/admin/login` |
| Admin Register | `https://your-domain/admin/register` |
| Staff Dashboard | `https://your-domain/staff/dashboard` |
| Admin Dashboard | `https://your-domain/admin/dashboard` |
| Analytics | `https://your-domain/admin/analytics` |

---

*Setup guide prepared for G.D. Sawant College — LeaveSync v14*  
*For technical support, refer to the project documentation or contact the development team.*
