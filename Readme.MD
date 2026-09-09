# ⚡ GridFlow — Load Shedding & Power Outage Management System

GridFlow is a backend system for a power distribution authority to manage its infrastructure hierarchy, planned load-shedding schedules, unexpected outage reporting, technician dispatch, priority restoration payments, and customer/technician/staff communication — all through a role-based REST API.

Built as part of the **Assignment 6: Load Shedding & Power Outage Management Platform** (Level 2 curriculum).

---

## 🔗 Quick Links

| Resource | Link |
|---|---|
| 🚀 Live API | `<!-- TODO: paste your deployed URL, e.g. https://gridflow-backend.onrender.com -->` |
| 📮 Postman Collection | `<!-- TODO: paste your published Postman collection link -->` |
| 📂 Repository | `<!-- TODO: paste your GitHub repo link -->` |

---

## 🔑 Demo Credentials

> ⚠️ These are seeded demo accounts for evaluation only — do not use real credentials here or in a public repo.

| Role | Email | Password |
|---|---|---|
| Admin | `<!-- TODO: your ADMIN_EMAIL from .env -->` | `<!-- TODO: your ADMIN_PASSWORD -->` |
| Zone Manager | `zonemanager@gridflow.demo` | `Demo@1234` |
| Technician | `tech1@gridflow.demo` | `Demo@1234` |
| Customer | `customer@gridflow.demo` | `Demo@1234` |

---

## 📖 Overview

GridFlow models a real power-authority hierarchy — **Zone → Substation → Feeder → Area** — and layers the full operational lifecycle on top of it:

- Customers report outages, which are automatically deduplicated and merged into a single incident per feeder.
- Zone Managers and Admins verify outages and dispatch technicians, who accept, work, log repair progress, and close out jobs.
- Zone Managers plan load-shedding schedules; Admins approve them, with automatic conflict detection and time-based status transitions (via a cron job).
- Customers can pay a real **bKash** fee to prioritize restoration of their own outage.
- Admins post technician job openings; candidates apply with a resume, and approval automatically promotes their account to a Technician role.
- Every major event (verification, restoration, schedule approval, announcements, account changes) triggers a tracked email notification.

---

## ✨ Core Features

### Infrastructure Management
- Full CRUD for PowerZone → Substation → Feeder → Area, with soft deletes and dependent-record protection (e.g. can't delete a zone with active substations).

### Authentication & Authorization
- Email/password registration with OTP email verification
- Google Social Login (with post-login profile completion for area selection)
- JWT access + refresh tokens (httpOnly cookies), with Redis-backed refresh-token blacklisting on logout
- Forgot/reset password via OTP
- Strict role-based middleware for 4 roles: `CUSTOMER`, `TECHNICIAN`, `ZONE_MANAGER`, `ADMIN`
- Admin-initiated Admin/Zone Manager account creation (auto-generated temp password, emailed)

### Outage Management
- Customer outage reporting with automatic **merge logic** — multiple reports for the same live incident collapse into a single `Outage` record instead of creating duplicates
- Full state machine: `REPORTED → VERIFIED → ASSIGNED → IN_PROGRESS → RESTORED → CLOSED`
- Zone-scoped visibility and actions for Zone Managers

### Technician Assignment & Repair Tracking
- Assign → Accept/Reject → Start → Log repair updates → Complete workflow
- Technician-zone matching validation
- A completed assignment requires at least one logged repair update (no "empty" completions)
- Rejected assignments automatically reopen the outage for reassignment

### Load Shedding Scheduling
- Draft-free creation (`PENDING` → `APPROVED` → `ACTIVE` → `COMPLETED`, or `CANCELLED`)
- Conflict detection at approval time (overlapping time + shared area)
- Automated `APPROVED → ACTIVE → COMPLETED` transitions via a background cron job
- Affected customers notified by email on approval and cancellation

### Priority Restoration & Payments (bKash)
- Real bKash Tokenized Checkout integration (grant/refresh token, create payment, execute payment)
- Server-side payment verification (never trusts client-supplied status)
- Idempotent callback handling
- Successful payment automatically flags the outage's active assignment as priority

### Technician Recruitment
- Admin-managed Job Postings (`DRAFT → PUBLISHED → CLOSED`)
- Public job listing + resume upload (Cloudinary) application flow
- Admin approval **automatically promotes** the applicant's existing Customer account to Technician — no duplicate accounts

### Announcements
- Zone-scoped or global announcements (`DRAFT → PUBLISHED`)
- Publishing triggers a bulk email to affected/all active customers

### Dashboards & Analytics
- Single role-aware `GET /dashboard` endpoint returning tailored statistics for each of the 4 roles (infrastructure counts, outage/restoration metrics, revenue, technician workload, personal history, etc.)

### Platform-wide Practices
- Soft deletes (`deletedAt`) across all deletable resources
- Audit logging for critical state changes
- Consistent `{ success, message, data }` / `{ success, message, errors }` response shape
- Centralized error handling (Prisma, Zod, and custom `AppError` cases)
- Rate limiting, Helmet security headers, CORS configuration
- Every outbound email is tracked in an `EmailLog` (sent/failed status)

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Runtime & Framework | Node.js, TypeScript, Express.js |
| Database & ORM | PostgreSQL, Prisma ORM (multi-file schema) |
| Validation | Zod |
| Caching / Ephemeral State | Redis (OTP storage, bKash token cache, refresh-token blacklist) |
| Authentication | Custom JWT (access + refresh) + Google Identity Services |
| Email | Nodemailer + EJS templates |
| File Storage | Multer (memory storage) + Cloudinary |
| Payments | bKash Tokenized Checkout |
| Scheduling | node-cron |
| API Documentation | Postman |
| Deployment | `<!-- TODO: Render / Vercel -->` |

---

## 👥 User Roles

| Role | Description |
|---|---|
| **Customer** | Reports outages, requests priority restoration, applies for technician jobs, views announcements |
| **Technician** | Accepts/executes repair assignments, logs progress |
| **Zone Manager** | Manages a single assigned zone's outages, schedules, and announcements |
| **Admin** | Full system access — infrastructure setup, user management, approvals, analytics |

---

## 📡 API Overview

All endpoints are versioned under `/api/v1`. Full request/response details are documented in the Postman collection linked above.

| Module | Base Path | Highlights |
|---|---|---|
| Auth | `/auth` | Register + OTP verify, login, Google login, forgot/reset password, logout, refresh token |
| Users | `/users` | Profile update, profile image upload |
| Zones | `/zones` | CRUD |
| Substations | `/substations` | CRUD |
| Feeders | `/feeders` | CRUD |
| Areas | `/areas` | CRUD (list/detail public — used for registration) |
| Admin User Mgmt | `/admin/users` | Create Admin / Zone Manager accounts |
| Outages | `/outages`, `/my-reports` | Report, verify, close, list, manual creation |
| Assignments | `/assignments`, `/my-assignments` | Assign, accept/reject, start, repair updates, complete |
| Load Shedding | `/load-shedding-schedules` | CRUD, approve, cancel |
| Priority Restoration | `/priority-restoration` | Create payment, bKash callback, my requests, payment status |
| Job Posts | `/job-posts`, `/admin/job-posts` | CRUD, publish, close |
| Technician Applications | `/job-posts/:id/applications`, `/my-applications`, `/admin/technician-applications` | Apply, review, approve/reject |
| Announcements | `/announcements` | CRUD, publish |
| Dashboard | `/dashboard` | Role-aware analytics |

**Total: 80+ documented endpoints**, including pagination, filtering, sorting, and search on relevant list endpoints.

---

## ⚙️ Local Setup

### 1. Clone & Install
```bash
git clone <repo-url>
cd GridFlow-Backend
npm install
```

### 2. Environment Variables
Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL="postgres://..."
FRONTEND_URL=http://localhost:3000
APP_URL=http://localhost:5000

# JWT
JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10

# Google OAuth
GOOGLE_CLIENT_ID=

# Redis
REDIS_URL=

# Email (Nodemailer SMTP)
EMAIL_SENDER=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# bKash (Sandbox)
BKASH_BASE_URL=
BKASH_USERNAME=
BKASH_PASSWORD=
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_CALLBACK_URL=

# Seed — Admin
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=

# Seed — Demo accounts
DEMO_ZONE_MANAGER_EMAIL=
DEMO_TECHNICIAN_ONE_EMAIL=
DEMO_TECHNICIAN_TWO_EMAIL=
DEMO_CUSTOMER_EMAIL=
DEMO_USER_PASSWORD=

# Business config
PRIORITY_RESTORATION_FEE=200
```

### 3. Database
```bash
npx prisma format
npx prisma migrate dev --name init
```

### 4. Run
```bash
npm run dev
```
The seed scripts (`seedAdmin`, `seedInfrastructure`, `seedDemoUsers`) run automatically on server start and are idempotent — safe to restart without duplicating data.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── config/          # Environment config
│   ├── lib/             # Prisma, Redis, Cloudinary, Mailer, bKash clients
│   ├── middleware/      # auth, validateRequest, error handlers, multer
│   ├── module/          # Feature modules (auth, outage, assignment, ...)
│   │   └── <feature>/
│   │       ├── *.route.ts
│   │       ├── *.controller.ts
│   │       ├── *.service.ts
│   │       ├── *.validation.ts
│   │       └── *.interface.ts
│   ├── templates/       # EJS email templates
│   └── utils/           # AppError, catchAsync, sendResponse, jwt
├── seed/                # Seed scripts
└── server.ts
prisma/
└── schema/              # Multi-file Prisma schema (17 models)
```

---

## 🎥 Video Walkthrough

`<!-- TODO: brief note on what the video covers, plus the link from Quick Links above -->`

---

## 📝 License

`<!-- TODO: e.g. MIT, or "Academic project — not licensed for reuse" -->`

---

## 👤 Author

**Abir Hasan**
Software Engineering, Daffodil International University
`<!-- TODO: add your GitHub/LinkedIn/email if you want -->`