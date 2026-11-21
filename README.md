# Anand Prime CRM

Mobile-first CRM for Anand Prime — premium real estate in Gurugram, Delhi NCR.

## Tech Stack

- Next.js 15 (App Router)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Mumbai region)
- TanStack Query v5

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project in **Mumbai (ap-south-1)**
2. Copy your **Project URL** and **anon/public key** from Settings → API

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Run database migration

Apply the migration via Supabase SQL Editor or CLI:

```bash
# Option A: Paste contents of supabase/migrations/001_initial_schema.sql into SQL Editor

# Option B: Supabase CLI
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### 5. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — optimized for 375px mobile viewport.

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars
4. Deploy

## Features

- **Leads** — list + Kanban views, search, filters, dynamic custom fields
- **Lead Detail** — WhatsApp CTA, notes, tasks, linked units
- **Inventory** — grid of units across projects with status badges
- **Tasks** — global follow-up reminders sorted by due date, with optional reminder time (default 9:00 AM IST) and phone notifications

## Task reminders (phone notifications)

When you add a follow-up task on a lead with a due date, you can optionally set a reminder time (defaults to **9:00 AM IST**). At that time, the app sends a push notification to your phone.

### Setup

1. Apply migration `supabase/migrations/008_task_reminders_and_push.sql`
2. Generate VAPID keys: `npx web-push generate-vapid-keys`
3. Add to `.env.local` / Vercel:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (e.g. `mailto:you@example.com`)
4. On your phone: open the CRM, allow notifications when prompted, then **Add to Home Screen** (required on iOS for background push)
5. **Background reminders (when app is closed):** Vercel Hobby only allows **once-per-day** cron jobs, so minute-level reminders cannot use `vercel.json` crons. Options:
   - **Hobby:** use [cron-job.org](https://cron-job.org) to call `GET https://your-app.vercel.app/api/cron/task-reminders` every minute with header `Authorization: Bearer <CRON_SECRET>`
   - **Pro:** add a cron in `vercel.json` with schedule `* * * * *` for `/api/cron/task-reminders`

When the app is open, reminders also fire via a client-side poller without waiting for cron.

- **Settings** — manage field definitions, pipeline stages, projects, agent name
