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

## Google Sheets ↔ Meta Leads sync

New Meta leads in your connected Google Sheet auto-import into the CRM. Each night, the CRM writes pipeline stage back to the existing `lead_status` column (sheet-imported leads only).

### Server env vars (Vercel)

See [`.env.example`](.env.example) for the full list. Required for sync:

- `SUPABASE_SERVICE_ROLE_KEY` — server-side DB access
- `WEBHOOK_SECRET` — authenticates Apps Script → CRM
- `CRON_SECRET` — authenticates Vercel Cron → CRM
- `GOOGLE_SHEET_ID` — spreadsheet ID from the sheet URL
- `GOOGLE_SERVICE_ACCOUNT_JSON` — service account key (single-line JSON)
- `GOOGLE_SHEET_STATUS_COLUMN=lead_status`

Share the Meta leads sheet with the service account email (Editor).

### Google Apps Script setup

1. Open your Meta leads Google Sheet → **Extensions → Apps Script**
2. Paste [`scripts/google-sheets-meta-sync.gs`](scripts/google-sheets-meta-sync.gs)
3. Set `WEBHOOK_URL` to your deployed app + `/api/webhooks/leads`
4. Set `WEBHOOK_SECRET` to match Vercel env
5. Run `installTrigger()` once (creates onChange trigger for new rows)
6. Optionally run `testSyncLastRow()` to test the last row

### Backfill existing sheet rows

**Option A — from your computer (recommended for many rows):**

```bash
npm run backfill:sheet          # import all rows
npm run backfill:sheet -- --dry-run   # preview without importing
```

Requires `.env.local` with Google + Supabase vars. Duplicates are skipped; existing leads get `sheet_row` updated for nightly status sync.

**Option B — from Google Apps Script:**

1. Update `WEBHOOK_URL`, `WEBHOOK_SECRET`, and `SHEET_TAB_NAME` in the script
2. Run `backfillAllRows()` once (under ~300 rows)
3. For larger sheets, run `backfillBatch()` repeatedly until it says complete
4. Use `resetBackfillCursor()` to start a batch backfill over

### Cron schedule

Daily at **11:00 PM IST** (`vercel.json`). Manually test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/sync-sheet-status
```

### Test webhook locally

```bash
curl -X POST http://localhost:3000/api/webhooks/leads \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"sheet_row":2,"row":{"id":"l:1180939454183866","full_name":"Mukesh Thakur","phone_number":"p:+916209590793","email":"mukeshthakor6209590793@gmail.com","created_time":"2026-06-22T21:28:44+05:30","form_name":"Fresh 2026 (Emaar & SS)","what_is_your_budget_for_investment?":"2.0_cr_-_2.5_cr","what_is_your_preferred_size?":"4bhk","lead_status":"CREATED"}}'
```
