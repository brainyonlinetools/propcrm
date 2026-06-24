# Anand Prime CRM — Cursor Composer Build Prompt

## Project Overview

Build a **mobile-first CRM web app** for Anand Prime, a premium real estate brand operating in Gurugram, Delhi NCR. This is a single-user app (no login/auth required for now). It is a **web app only** — no React Native, no Expo. Hosted on Vercel.

The app manages **leads** (prospective buyers) and **inventory** (residential units in projects). Both data models are **fully customisable by the user** — field definitions are stored in the database and editable from a Settings screen, not hardcoded in the UI.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database + Backend:** Supabase (Postgres, Mumbai region)
  - Use the Supabase JS client (`@supabase/supabase-js`)
  - All DB operations via Supabase client (no separate API layer needed for v1)
- **State / Data fetching:** TanStack Query (React Query v5) for all server state
- **Forms:** React Hook Form + Zod
- **Deployment:** Vercel (use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars)
- **Design system:** Follow `design.md` in the project root for all visual decisions

---

## Design Direction

Pull all colours, typography, spacing, and component styles from `design.md`.

The aesthetic should feel like a **premium real estate brand tool** — confident, clean, and touch-friendly. Think muted warm neutrals, generous whitespace, and a single strong accent colour (as defined in design.md). No gradients everywhere. No card shadows stacked on card shadows. Every tap target minimum 48px height. The app will be used on a phone browser daily, so mobile UX is the primary concern.

Do not use generic SaaS blue. Do not use default shadcn grey themes. Map design.md tokens to Tailwind CSS variables in `tailwind.config.ts` before writing any component.

---

## App Structure

### Navigation (bottom tab bar, mobile-first)

```
[Leads] [Inventory] [Tasks] [Settings]
```

- Sticky bottom nav, always visible
- Active tab indicated by accent colour + label
- No top hamburger menus

### Screens

1. **Leads** — list view (default) + Kanban view toggle
2. **Lead Detail** — full lead card with notes, activity log, WhatsApp button, tasks
3. **Inventory** — list/grid of units across projects
4. **Unit Detail** — full unit card
5. **Tasks** — follow-up reminders across all leads
6. **Settings** — manage lead fields, inventory fields, pipeline stages, project list

---

## Data Architecture

### Core Concept: Dynamic Fields

Both `leads` and `inventory` have a fixed set of system columns plus a `custom_data JSONB` column. The user defines their own fields (name, type, options) in a `field_definitions` table. The UI renders inputs dynamically based on these definitions.

### Supabase Schema

```sql
-- Field definitions (drives dynamic forms)
create table field_definitions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'inventory')),
  field_key text not null,
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'select', 'multiselect', 'date', 'phone', 'url', 'textarea', 'boolean')),
  options jsonb,           -- for select/multiselect: array of strings
  is_required boolean default false,
  show_in_card boolean default true,   -- show on list card preview
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Pipeline stages
create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  color text not null,     -- hex colour for Kanban column header
  sort_order int default 0
);

-- Projects (Anand Prime's real estate projects)
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  created_at timestamptz default now()
);

-- Leads
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  stage_id uuid references pipeline_stages(id),
  source text,             -- e.g. Meta, Google, Reference, Walk-in
  project_interest uuid references projects(id),
  custom_data jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Inventory
create table inventory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  unit_number text not null,
  unit_type text,          -- e.g. 3BHK, 4BHK
  area_sqft numeric,
  price numeric,
  status text default 'available' check (status in ('available', 'blocked', 'booked', 'sold')),
  custom_data jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Notes / Activity log
create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  content text not null,
  note_type text default 'note' check (note_type in ('note', 'call', 'visit', 'whatsapp')),
  created_at timestamptz default now()
);

-- Tasks / Follow-up reminders
create table tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  title text not null,
  due_date date,
  is_done boolean default false,
  created_at timestamptz default now()
);
```

### Seed Data

Insert these default pipeline stages on first run:
```
New → Contacted → Site Visit → Negotiation → Closed (Won) → Lost
```

Insert these default `field_definitions` for `lead`:
- `budget` / Number / "Budget (₹ Cr)"
- `configuration` / Select / options: ["2BHK", "3BHK", "4BHK", "Penthouse"]
- `possession_preference` / Select / options: ["Ready to Move", "Under Construction", "2025", "2026", "2027+"]
- `remarks` / Textarea / "Remarks"

Insert these default `field_definitions` for `inventory`:
- `floor` / Number / "Floor"
- `facing` / Select / options: ["East", "West", "North", "South", "Corner"]
- `car_parking` / Number / "Car Parking Slots"
- `remarks` / Textarea / "Remarks"

---

## Feature Specifications

### 1. Leads List Screen

- Default view: scrollable card list, sorted by `updated_at` DESC
- Each card shows: Name, phone, stage badge (colour from pipeline_stages), source tag, project interest, and any `show_in_card: true` custom fields
- **Kanban toggle** in top-right: switches to horizontal scrollable columns, one per pipeline stage. Cards are draggable between columns (use `@dnd-kit/core`). Drag updates `stage_id` in Supabase instantly.
- **Search bar** at top: filters by name, phone, email (client-side on loaded data)
- **Filter chips** below search: filter by stage, source, project
- **FAB (+)** bottom-right: opens Add Lead sheet
- Pull-to-refresh

### 2. Lead Detail Screen

Accessed by tapping a lead card. Full-page view with:

- **Header:** Name, phone (tappable — copies to clipboard), stage badge (tappable dropdown to change stage), edit button
- **WhatsApp Button:** prominent CTA. Opens `https://wa.me/91{phone}` with a pre-filled message: `"Hi {name}, this is [Agent Name] from Anand Prime. Following up regarding your enquiry about {project_interest}."`
- **Custom Fields section:** renders all `field_definitions` for `lead`, reading/writing `custom_data`
- **Notes / Activity Log:**
  - Reverse-chronological list of `lead_notes`
  - Each note shows: type icon (📝 note, 📞 call, 🏠 visit, 💬 WhatsApp), content, timestamp
  - Quick-add note bar at bottom: type selector + text input + save
- **Tasks section:**
  - List of tasks for this lead, checkbox to mark done
  - Add task inline (title + due date picker)
- **Linked Unit:** optionally link an inventory unit to this lead (search + select)

### 3. Inventory List Screen

- Grid view (2 columns on mobile) of unit cards
- Each card: unit number, type, floor, area, price (₹ formatted), status badge (colour-coded: green=available, amber=blocked, orange=booked, red=sold)
- Filter by: project, status, unit type
- FAB (+): Add Unit sheet
- Tap card → Unit Detail

### 4. Unit Detail Screen

- All fields editable inline (save on blur or explicit Save button)
- Custom fields rendered dynamically from `field_definitions` where `entity_type = 'inventory'`
- Status change: prominent status selector at top
- Linked leads: show any leads linked to this unit

### 5. Tasks Screen

- Flat list of all incomplete tasks across all leads, sorted by `due_date` ASC
- Overdue tasks highlighted in red
- Each task shows: title, lead name (tappable → lead detail), due date, checkbox
- Toggle to show completed tasks
- No FAB here — tasks are added from Lead Detail only

### 6. Settings Screen

Tabbed layout with three tabs:

#### Tab A: Lead Fields
- Table/list of all `field_definitions` where `entity_type = 'lead'`
- Each row: drag handle (reorder `sort_order`), label, field type, required toggle, show-in-card toggle, delete button
- "Add Field" button → inline form: label, field_key (auto-slugified from label), type selector, options (if select/multiselect, comma-separated input), required toggle
- Field types supported: Text, Number, Select, Multi-select, Date, Phone, URL, Textarea, Yes/No

#### Tab B: Inventory Fields
- Same UI as Lead Fields but for `entity_type = 'inventory'`

#### Tab C: Pipeline & Projects
- **Pipeline Stages:** list with drag-to-reorder, colour picker per stage, rename, delete (warn if leads exist in stage), add new stage
- **Projects:** simple list — add/edit/delete project names and locations
- **Agent Name:** single text input, saved to `localStorage`, used in WhatsApp pre-fill message

---

## Dynamic Form Renderer

Build a reusable `<DynamicFieldRenderer>` component that:

```typescript
// Props
interface DynamicFieldRendererProps {
  entityType: 'lead' | 'inventory'
  value: Record<string, unknown>           // current custom_data
  onChange: (key: string, val: unknown) => void
  mode: 'edit' | 'view'
}
```

- Fetches `field_definitions` for the entity type (cached via React Query)
- Renders the correct input per `field_type`:
  - `text` / `phone` / `url` → `<Input>`
  - `textarea` → `<Textarea>`
  - `number` → `<Input type="number">`
  - `date` → `<Input type="date">`
  - `boolean` → `<Switch>`
  - `select` → `<Select>` with options from `field_definitions.options`
  - `multiselect` → multi-checkbox group or tag input
- In `view` mode: renders as labelled read-only text rows

---

## Component Architecture

```
src/
  app/
    layout.tsx              ← root layout with bottom nav
    leads/
      page.tsx              ← Leads list
      [id]/page.tsx         ← Lead detail
    inventory/
      page.tsx              ← Inventory list
      [id]/page.tsx         ← Unit detail
    tasks/
      page.tsx              ← Tasks list
    settings/
      page.tsx              ← Settings (tabbed)
  components/
    leads/
      LeadCard.tsx
      LeadKanban.tsx
      LeadForm.tsx
    inventory/
      UnitCard.tsx
      UnitForm.tsx
    tasks/
      TaskItem.tsx
    shared/
      DynamicFieldRenderer.tsx
      BottomNav.tsx
      StatusBadge.tsx
      WhatsAppButton.tsx
      PullToRefresh.tsx
  lib/
    supabase.ts             ← Supabase client singleton
    queries/
      leads.ts              ← TanStack Query hooks for leads
      inventory.ts
      tasks.ts
      fieldDefinitions.ts
      pipelineStages.ts
    utils.ts
  types/
    index.ts                ← All TypeScript types matching DB schema
```

---

## UX Rules

1. **Every list screen has a search bar** — filter on client side, no debounced API calls needed for v1
2. **Sheets over pages for forms** — use shadcn `<Sheet>` (slides up from bottom) for Add/Edit forms on mobile, not new routes
3. **Optimistic updates** — on stage change via Kanban drag, update UI immediately, then sync to Supabase. Roll back on error.
4. **Currency formatting** — all prices in ₹, formatted as `₹X.XX Cr` if ≥ 10,00,000 else `₹X,XX,XXX`
5. **Phone numbers** — stored as string, display formatted as `+91 XXXXX XXXXX`
6. **Empty states** — every list has a useful empty state with a CTA to add the first item
7. **Toast notifications** — use shadcn `<Sonner>` for success/error feedback on all mutations
8. **No confirmation modals for edits** — only for destructive deletes
9. **Date display** — relative for recent (e.g. "2 hours ago", "Yesterday") using `date-fns`, absolute for older
10. **Loading states** — skeleton cards, not spinners, for list screens

---

## Build Order

Build in this exact sequence. Do not jump ahead.

**Phase 1 — Foundation**
- Scaffold Next.js 15 + TypeScript + Tailwind + shadcn/ui
- Map design.md tokens to Tailwind config
- Build `<BottomNav>` with 4 tabs
- Set up Supabase client in `lib/supabase.ts`
- Set up TanStack Query provider in root layout
- Create all Supabase tables and seed data (provide SQL migration file)

**Phase 2 — Leads List + Kanban**
- `field_definitions` React Query hooks
- `pipeline_stages` React Query hooks
- Leads list page: card view + Kanban view toggle
- `<LeadCard>` with stage badge, WhatsApp button
- Add Lead sheet with form (system fields + dynamic fields)
- Search + filter chips

**Phase 3 — Lead Detail**
- Lead detail page with all sections
- `<DynamicFieldRenderer>` component
- Notes/activity log with quick-add
- Tasks section per lead
- WhatsApp pre-fill with agent name from localStorage
- Stage change dropdown

**Phase 4 — Inventory**
- Inventory list (grid)
- `<UnitCard>`
- Unit detail page
- Add/edit unit with dynamic fields

**Phase 5 — Tasks Screen**
- Global tasks list sorted by due date
- Overdue highlighting
- Done/undone toggle

**Phase 6 — Settings**
- Lead field management (add, reorder, delete)
- Inventory field management
- Pipeline stage management with colour picker
- Projects management
- Agent name setting

**Phase 7 — Polish**
- Pull-to-refresh on list screens
- Skeleton loaders
- Empty states for all lists
- Optimistic updates for Kanban drag
- Test on mobile viewport (375px)
- Vercel deployment config (vercel.json if needed, env var documentation)

---

## Do Not

- Do not add authentication or login screens
- Do not use `pages/` router — App Router only
- Do not hardcode lead or inventory fields in components — always read from `field_definitions`
- Do not use `any` TypeScript type
- Do not use inline styles — Tailwind classes only
- Do not install unnecessary dependencies — keep the bundle lean
- Do not write placeholder/lorem content — use realistic Anand Prime / Gurugram real estate data in seed files and empty states

---

## Environment Variables Needed

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Document these in `.env.example`.

---

*Start with Phase 1. Confirm completion of each phase before proceeding to the next. Output the SQL migration for Phase 1 as a file at `supabase/migrations/001_initial_schema.sql`.*
