# LeaveSync — G.D. Sawant College
## Staff Leave Management System
### Project Overview & Workflow Documentation

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [System Architecture](#2-system-architecture)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Feature Walkthrough](#4-feature-walkthrough)
   - 4.1 [Authentication Flow](#41-authentication-flow)
   - 4.2 [Staff Features](#42-staff-features)
   - 4.3 [Admin Features](#43-admin-features)
5. [Database Schema](#5-database-schema)
6. [Business Logic & Automation](#6-business-logic--automation)
7. [Security Model](#7-security-model)
8. [Technology Stack](#8-technology-stack)

---

## 1. Project Summary

**LeaveSync** is a full-stack, web-based Leave Management System developed for G.D. Sawant College. It digitises the entire leave application workflow — from staff submission through admin review to final approval — eliminating paper-based processes and providing transparent, real-time leave tracking for every stakeholder.

### Key Capabilities at a Glance

| Capability | Details |
|---|---|
| Staff registration & login | Username/password with department selection |
| Admin registration & login | Username/password + secret key validation |
| Leave application | Multi-step form with document upload support |
| Leave approval workflow | Admin reviews, responds (manually or AI-assisted), approves/rejects |
| Leave balance tracking | Per-type allocations, auto-deducted on approval |
| Analytics dashboard | Department-wise, status, and leave-type distribution charts |
| Annual auto-reset | Leave allocations reset to 0 used on 1 January every year |
| PDF report export | All reports exported as professionally formatted PDFs |
| Notifications | Real-time in-app notifications for staff and admin |
| Holiday calendar | College holidays excluded from leave day counts |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       BROWSER (React SPA)                       │
│  Staff Portal        Admin Portal        Public Auth Pages      │
│  /staff/*            /admin/*            /staff/login, etc.     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE CLOUD BACKEND                       │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Auth       │  │  PostgreSQL  │  │  Storage           │    │
│  │  (JWT-based)│  │  (+ RLS)     │  │  leave-documents   │    │
│  └─────────────┘  └──────────────┘  └────────────────────┘    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Edge Functions (Deno)                                   │  │
│  │  • generate-ai-response  (Gemini 2.5 Flash via gateway)  │  │
│  │  • reset-user-password   (service-role admin API)        │  │
│  │  • send-leave-notification                               │  │
│  │  • send-approval-notification                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  pg_cron Scheduler                                       │  │
│  │  • 'yearly-leave-reset' runs at 00:00 UTC on Jan 1      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow — Leave Application

```
Staff submits leave form
        │
        ▼
Validate: dates, balance, document upload (if required)
        │
        ▼
INSERT leave_applications (status = 'pending')
        │
        ▼
Notification sent to all admins
        │
        ▼
Admin reviews in Pending Applications page
        │
        ├── AI Response button → Edge Function → Gemini 2.5 Flash → response text pre-filled
        │
        ▼
Admin sets response text + clicks Approve / Reject
        │
        ▼
UPDATE leave_applications (status = 'approved'/'rejected')
UPDATE staff_leave_allocations (used += leave_days)   [on approve only]
Notification sent to staff member
        │
        ▼
Staff sees updated status in Leave History
Leave balance reflected in Profile / Allocations page
```

---

## 3. User Roles & Permissions

### Staff Role

| Action | Permitted |
|---|---|
| Register with department selection | ✅ |
| Login with username + password | ✅ |
| Apply for leave (with optional document) | ✅ (must be approved by admin first) |
| View own leave history | ✅ |
| View leave calendar (own leaves + holidays) | ✅ |
| View own leave balance/allocations | ✅ |
| View own notifications | ✅ |
| Edit own profile (name, email, phone, address) | ✅ |
| Change own password | ✅ |
| Recover forgotten username/password | ✅ |
| View other staff data | ❌ |
| Approve/reject leaves | ❌ |

### Admin Role

| Action | Permitted |
|---|---|
| Register with username + password + **admin secret key** | ✅ |
| Login with username + password + **admin secret key** | ✅ |
| Approve/reject staff registrations | ✅ |
| View all leave applications | ✅ |
| Approve/reject leave applications | ✅ |
| Use AI to generate approval/rejection responses | ✅ |
| View analytics and department-wise reports | ✅ |
| Manage departments (create/edit/delete) | ✅ |
| Manage leave types and annual allocations | ✅ |
| Manage holidays | ✅ |
| View/download documents submitted by staff | ✅ |
| Reset any staff member's password | ✅ |
| Change the admin secret key | ✅ |
| Export PDF reports for all applications | ✅ |

### Admin Secret Key

The admin secret key is a shared passphrase required at admin registration **and** at every admin login. Its purpose is to prevent unauthorised users from self-registering as admins. The key is stored in the `admin_settings` database table and can be changed at any time from **Admin Profile → Change Admin Secret Key**.

> **Default key on first deployment:** `GDS2026ADMIN`  
> **Recommendation:** Change this immediately after the first admin registers.

---

## 4. Feature Walkthrough

### 4.1 Authentication Flow

#### Staff Registration
1. Navigate to `/staff/register`
2. Fill in: Full Name, Username, Password, Phone, Email (optional), Address, Department
3. Account is created with `approval_status = 'pending'`
4. Admin must approve the account from **Employee Approval** before the staff member can log in and apply for leave

#### Admin Registration
1. Navigate to `/admin/register`
2. Fill in: Full Name, Username, Password, Phone, Email (optional), Address, Department, **Admin Secret Key**
3. If the secret key matches the stored value in `admin_settings`, the account is created with role `admin` and `approval_status = 'approved'` immediately

#### Login
- Staff: `/staff/login` → Username + Password
- Admin: `/admin/login` → Username + Password + Admin Secret Key

#### Forgot Password
- Staff: `/staff/forgot-password` → Enter username + phone → New password is set via `reset-user-password` edge function
- Admin: `/admin/forgot-password` → Same flow

#### Forgot Username
- Staff: `/staff/forgot-username` → Enter registered phone number → Username is displayed
- Admin: `/admin/forgot-username` → Same flow

---

### 4.2 Staff Features

#### Apply for Leave (`/staff/apply-leave`)
- Select leave type from admin-configured list
- Pick start date and end date
- System auto-calculates working days (excluding weekends and college holidays)
- Validates available balance for selected leave type
- Optional document upload (PDF, image) — required for leave types marked `requires_document = true`
- Document stored in Supabase Storage bucket `leave-documents`

#### Leave History (`/staff/history`)
- List of all leave applications with status badges (Pending / Approved / Rejected)
- Filter by status
- **View Document** button for applications with uploaded files
- Download full history as **PDF report**

#### Leave Calendar (`/staff/calendar`)
- Monthly calendar view showing own approved leaves (green) and college holidays (orange)

#### Profile (`/staff/profile`)
- View and edit personal information
- View leave balance per type (remaining/used/allocated)
- Change password
- Download **profile PDF report** (includes personal info + leave stats + allocations table)

#### Notifications (`/staff/notifications`)
- In-app notifications when application is submitted, approved, or rejected
- Mark as read individually or all at once

---

### 4.3 Admin Features

#### Dashboard (`/admin/dashboard`)
- Summary cards: Total Applications, Pending, Approved, Rejected
- Pending count that links directly to the pending queue
- Recent Applications list with scrollable card (shows latest 10, scrolls within fixed height)

#### Pending Applications (`/admin/pending`)
- Search by employee name, filter by department or leave type
- Expandable cards showing full application details + uploaded document link
- **AI Generate Response** button: sends application context to Gemini 2.5 Flash → pre-fills the response text box with a professional approval/rejection message
- Manual response text editing
- Approve / Reject buttons; confirmation required before final action

#### All Applications (`/admin/applications`)
- Full table of every application in the system
- Filters: employee name, department, leave type, status, date range
- Download **PDF report** — landscape orientation with all columns correctly mapped

#### Analytics (`/admin/analytics`)
- **Department-wise Leave Distribution** (bar chart, full-width, wider bars, legend below heading)
- **Leave Type Distribution** (donut chart)
- Leave volume summary cards

#### Employee Approval (`/admin/employees`)
- List of all registered staff members
- Approve / Reject registration; rejected users cannot log in
- View each staff member's leave summary

#### View Leave (`/admin/view-leave`)
- Detailed view of a single application
- Document viewer (signed URL from Supabase Storage)
- Approve / Reject with optional response text

#### Departments (`/admin/departments`)
- Create, edit, delete departments
- Departments are linked to staff profiles

#### Leave Types (`/admin/leave-types`)
- Create, edit, delete leave types
- Set annual allocation (days per year) and whether document upload is required
- Allocations are auto-assigned to all active staff when a leave type is created or updated

#### Admin Profile (`/admin/profile`)
- Edit personal information
- **Change Password**
- **Change Admin Secret Key** — requires entering the current key, then a new key twice to confirm

---

## 5. Database Schema

### `profiles`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Matches `auth.users.id` |
| username | text UNIQUE | Login identifier |
| email | text | Optional contact email |
| full_name | text | Display name |
| role | user_role ENUM | `'staff'` or `'admin'` |
| phone | text | Phone number (used for username recovery) |
| address | text | Home address |
| department_id | uuid FK → departments | Staff's department |
| approval_status | approval_status ENUM | `'pending'` / `'approved'` / `'rejected'` |
| leave_balance | integer | Legacy field (kept for compatibility) |
| created_at / updated_at | timestamptz | Auto-managed |

### `leave_applications`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| staff_id | uuid FK → profiles | Applicant |
| leave_type_id | uuid FK → leave_types | Type of leave |
| start_date / end_date | date | Duration |
| leave_days | integer | Working days (auto-calculated, excl. weekends/holidays) |
| reason | text | Staff's reason |
| document_url | text | Supabase Storage path |
| status | leave_status ENUM | `'pending'` / `'approved'` / `'rejected'` |
| admin_response | text | Admin's formal response |
| reviewed_by | uuid FK → profiles | Admin who acted |
| reviewed_at | timestamptz | When action was taken |

### `staff_leave_allocations`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| staff_id | uuid FK → profiles | |
| leave_type_id | uuid FK → leave_types | |
| total_allocated | integer | Days allocated for the year |
| used | integer | Days consumed (approved leaves) |
| remaining | integer GENERATED | `total_allocated - used` (auto-computed) |
| year | integer | Calendar year (e.g. 2026) |

Unique constraint: `(staff_id, leave_type_id, year)`

### `departments`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| name | text UNIQUE | Department name |
| description | text | Optional description |

### `leave_types`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| name | text UNIQUE | E.g. "Sick Leave", "Casual Leave" |
| annual_allocation | integer | Default days/year assigned to all staff |
| requires_document | boolean | Whether file upload is mandatory |

### `notifications`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | Recipient |
| title | text | Short title |
| message | text | Full message |
| type | text | `'leave_submitted'` / `'leave_approved'` / etc. |
| related_application_id | uuid FK → leave_applications | |
| is_read | boolean | Read/unread state |

### `holidays`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| date | date UNIQUE | Holiday date |
| name | text | Holiday name |

### `admin_settings`
| Column | Type | Description |
|---|---|---|
| key | text PK | Setting identifier |
| value | text | Setting value |
| updated_at | timestamptz | Last changed |

Currently stores: `admin_secret_key`

---

## 6. Business Logic & Automation

### Leave Day Calculation
The PostgreSQL function `calculate_leave_days(start_date, end_date)` counts only working days:
- Excludes **Saturday** and **Sunday**
- Excludes any date in the `holidays` table

### Leave Balance Deduction
When an admin **approves** a leave application:
1. `leave_applications.status` is set to `'approved'`
2. `staff_leave_allocations.used` is incremented by `leave_days` for the matching `(staff_id, leave_type_id, year)`
3. `remaining` (a generated column) updates automatically

### Yearly Leave Reset — Automated (1 January)
A **pg_cron** job runs at `00:00 UTC on 1 January` every year, calling `reset_yearly_leave_allocations()`. This function:
- Reads all allocation records from the previous year
- Inserts new records for the new year (copying `total_allocated`, setting `used = 0`)
- If a record for the new year already exists, it resets `used` to 0

Staff do **not** lose their allocation count — only the `used` counter resets. New allocations are carried over automatically.

### AI Response Generation
When an admin clicks **Generate AI Response**:
1. The frontend calls the `generate-ai-response` Supabase Edge Function via `supabase.functions.invoke`
2. The edge function sends a detailed prompt (staff name, leave type, duration, reason, action intent) to **Gemini 2.5 Flash** via the platform AI gateway
3. The SSE stream is consumed, the full text is assembled, and returned as JSON
4. The admin's response text box is pre-filled with the result — the admin can edit before saving

### Document Upload & Retrieval
- Documents are uploaded to the `leave-documents` Supabase Storage bucket
- Files are stored at path: `{staff_user_id}/{filename}`
- RLS policies ensure:
  - Staff can only upload and view **their own** files
  - Admins can view **all** files
- Document URLs in the database are **signed/public storage URLs** that browser can open directly

---

## 7. Security Model

### Authentication
- All users authenticate via **Supabase Auth** (email/password internally; email is generated as `{username}@miaoda.com`)
- JWT tokens are issued and managed by Supabase; the frontend never handles raw passwords after login

### Row-Level Security (RLS)
Every table has RLS enabled. Key policies:

| Table | Staff Access | Admin Access |
|---|---|---|
| profiles | Read & update own row only | Full access |
| leave_applications | Read & insert own rows only | Full read + update |
| staff_leave_allocations | Read own rows only | Full access |
| departments / leave_types / holidays | Read only | Full access |
| admin_settings | None | Read + update only |
| notifications | Read & update own rows | N/A |
| storage: leave-documents | Upload + read own files | Read all files |

### Admin Secret Key
- Stored in `admin_settings` table (not in environment variables)
- Verified server-side via Supabase RLS-protected query before any admin account creation or login
- Can be rotated at any time by any logged-in admin from **Admin Profile → Change Admin Secret Key**

### Edge Function Security
- `generate-ai-response`: Uses `INTEGRATIONS_API_KEY` (platform-injected, never exposed to frontend)
- `reset-user-password`: Uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never in browser)
- Both functions validate inputs and handle CORS properly

---

## 8. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend Framework | React 18 + TypeScript | Component-based SPA |
| Build Tool | Vite | Fast bundling and HMR |
| UI Components | shadcn/ui + Radix UI | Accessible component primitives |
| Styling | Tailwind CSS | Utility-first CSS |
| Routing | React Router v6 | Client-side routing |
| State Management | React Context + Hooks | Auth state, profile |
| Data Fetching | Supabase JS Client v2 | Real-time queries + mutations |
| Charts | Recharts | Analytics visualisations |
| PDF Export | jsPDF | Client-side PDF generation |
| Date Handling | date-fns | Date formatting and calculations |
| Form Handling | react-hook-form + zod | Validated forms |
| Notifications (UI) | Sonner | Toast notifications |
| Database | Supabase (PostgreSQL) | Primary data store + RLS |
| Auth | Supabase Auth | JWT-based user authentication |
| Storage | Supabase Storage | Document file storage |
| Edge Functions | Supabase Edge Functions (Deno) | Server-side logic + AI calls |
| AI | Google Gemini 2.5 Flash | AI response generation |
| Scheduler | pg_cron (PostgreSQL extension) | Yearly leave reset automation |

---

*Documentation prepared for G.D. Sawant College — LeaveSync v14*  
*Generated: May 2026*
