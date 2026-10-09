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

## Connected Google Sheet sync

The CRM two-way syncs with one Google Sheet that has a `Leads` tab and an
`Inventory` tab:

- **Sheet → CRM:** new rows import as leads / inventory units (nightly, or any
  time via the Sync-now button on the Leads and Inventory headers). Matching
  rows (same phone/email for leads, same project + unit for inventory) are
  re-linked, never duplicated, and CRM edits are never overwritten.
- **CRM → sheet:** each night the CRM writes the pipeline stage back to the
  `Stage` column and the unit status back to the `Status` column (sheet-linked
  rows only).

### Server env vars (Vercel)

See [`.env.example`](.env.example) for the full list. Required for sync:

- `SUPABASE_SERVICE_ROLE_KEY` — server-side DB access
- `CRON_SECRET` — authenticates Vercel Cron → CRM
- `GOOGLE_SHEET_ID` — spreadsheet ID from the sheet URL
- `GOOGLE_SHEET_LEADS_TAB=Leads` — buyers tab name
- `GOOGLE_SHEET_INVENTORY_TAB=Inventory` — inventory tab name
- `GOOGLE_SERVICE_ACCOUNT_JSON` — service account key (single-line JSON)

Share the sheet with the service account email (Editor). No Apps Script setup
is needed.

### Leads tab columns

`Date, Name, Phone, Email, Stage, Source, Lead Type, Project Interest, Budget,
Last Date of Call, Notes`

- `Name` is required. `Stage` must match a pipeline stage label (else the lead
  lands in the first stage). `Budget` is in ₹ Cr (`2.5`, `2.5 Cr`, `50 L`, or
  full rupees all work). `Notes` becomes a lead note on import.

### Inventory tab columns

`Date, Unit Number, Project, Type, Area (sq.ft.), Price, Status, Floor, Facing,
Parking, Owner Name, Owner Phone, Remarks`

- `Unit Number` is required. `Project` must match a project name. `Status` is
  one of `available, blocked, booked, sold`. `Remarks` becomes a unit note on
  import.

### Manual sync from the terminal

```bash
node --import tsx scripts/sync-connected-sheet.ts            # both tabs
node --import tsx scripts/sync-connected-sheet.ts leads      # Leads tab only
node --import tsx scripts/sync-connected-sheet.ts inventory  # Inventory tab only
```

Requires `.env.local` with Google + Supabase vars.

### Cron schedule

Daily at **11:00 PM IST** (`vercel.json`). Manually test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/sync-sheet-status
```

### Retired: Meta leads sync

The old Meta-sheet Apps Script sync (`/api/webhooks/leads`,
`metaLeadMapper`, `backfill:sheet`) is retired and the webhook returns
`410 Gone`. The code is kept for reference; delete the Apps Script trigger on
the old Meta sheet if it still exists.
