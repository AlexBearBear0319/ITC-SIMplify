# SIMplify — Team Handover Guide

> **For:** UI designers and frontend teammates joining the hackathon codebase.
> **Stack:** Next.js 16 (App Router) · Supabase (Auth + PostgreSQL) · Tailwind v4 · Framer Motion · TypeScript

---

## Section 1 — App Architecture

### Route Tiers

The app has three access levels, enforced at the **Edge** by `src/middleware.ts` before any page component ever renders.

| Tier | Who can access | Routes |
|---|---|---|
| **Guest-only** | Unauthenticated users only | `/auth/login` |
| **User** | Any logged-in user | `/` `/finder` `/events` `/rewards` `/leaderboard` `/profile` `/settings` `/location/[id]` |
| **Admin** | Users with `is_admin = true` in `profiles` table | `/admin` |

**Redirect rules enforced by middleware:**

```
Guest  →  /auth/login          ← lands here naturally
Guest  →  any user route       → redirect to /auth/login
Guest  →  /admin               → redirect to /auth/login
User   →  /auth/login          → redirect to /  (already logged in)
User   →  /admin (not admin)   → redirect to /
Admin  →  /admin               ← access granted
```

### Supabase Connection

```
Browser / Server Component
        │
        ▼
src/utils/supabase/
  client.ts   ←  createBrowserClient()  — used in "use client" components
  server.ts   ←  createServerClient()   — used in Server Components & API routes
        │
        ▼
  Supabase Project  (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)
        │
        ├── auth.users           — managed by Supabase Auth
        ├── profiles             — id (FK), username, avatar_url, full_name,
        │                          points_balance, total_points_earned, is_admin
        ├── locations            — id, name, category, current_status,
        │                          coordinates_x/y, images, location_text,
        │                          opening_time, total_seats, power_outlets, description
        ├── events               — id, title, description, event_date,
        │                          location_id, is_peak_alert
        ├── missions             — id, title, description, reward_points,
        │                          progress, target_count, location_hint, is_active
        ├── redemption_items     — id, name, description, points_cost,
        │                          stock_remaining, category, is_active
        ├── reviews              — id, location_id, comment, created_at,
        │                          profiles(username)  [joined]
        └── study_groups         — id, name, host_id, location_id, subject,
                                   member_count, max_size, is_active
```

### File Structure Overview

```
src/
├── app/                    ← Next.js App Router pages
│   ├── page.tsx            ← Dashboard (/)
│   ├── auth/login/         ← Login page
│   ├── admin/              ← Admin analytics panel (is_admin only)
│   ├── events/             ← Campus events calendar
│   ├── finder/             ← Study Buddy group finder
│   ├── leaderboard/        ← Points leaderboard
│   ├── location/[id]/      ← Individual location detail
│   ├── profile/            ← User profile
│   ├── rewards/            ← Rewards store
│   └── settings/           ← App settings
│
├── components/
│   ├── features/           ← Complex interactive components
│   ├── layout/             ← App shell (header, sidebar)
│   └── providers/          ← React context providers
│
├── middleware.ts           ← Edge route guard (auth enforcement)
├── utils/supabase/         ← Supabase client factories
└── types/                  ← Shared TypeScript types
```

---

## Section 2 — CSS Master List

### How the Design System Works

All colours live as CSS variables in **`src/app/globals.css`** — the single source of truth.

- The `@theme` block defines the **light-mode palette**.
- The `.dark {}` block overrides the same variables for **dark mode**.
- Tailwind v4 emits utilities like `bg-canvas` as `background-color: var(--color-canvas)`, so the `.dark` overrides cascade automatically across the entire UI when `<html class="dark">` is toggled.
- **No `dark:` utility classes are used anywhere in React components.** The CSS variables handle it.
- Dark mode is applied automatically by `ThemeProvider` based on Singapore Time (7 PM – 6 AM SGT → dark).

> **Designer workflow:** Edit `@theme` to retheme light mode. Edit `.dark {}` to retheme dark mode. You never need to touch a `.tsx` file.

---

### CSS Variable Reference

#### Background & Surface Tokens

| Variable | Light value | Dark value | Used for |
|---|---|---|---|
| `--color-canvas` | `#F1F1EE` | `#0f172a` | Page / screen background (the 60% base) |
| `--color-surface` | `#FFFFFF` | `#1e293b` | Card backgrounds, sidebar, modal panels |
| `--color-border` | `#E4E4E0` | `#334155` | Dividers, card outlines, input borders |

#### Typography Tokens

| Variable | Light value | Dark value | Used for |
|---|---|---|---|
| `--color-ink` | `#2C3E50` | `#e2e8f0` | Primary text, headings, strong labels |
| `--color-ink-muted` | `#6B7C8D` | `#94a3b8` | Secondary text, body copy, field labels |
| `--color-ink-faint` | `#A8B8C8` | `#64748b` | Placeholder text, disabled / hint states |

#### Brand Tokens (primary interactive colour)

| Variable | Light value | Dark value | Used for |
|---|---|---|---|
| `--color-brand` | `#B3D2D5` | `#2B7A80` | Active nav items, primary buttons, selected calendar days |
| `--color-brand-dark` | `#8FBDC1` | `#236870` | Button hover/pressed, active link colour |
| `--color-brand-light` | `#D4E9EB` | `#1a3045` | Avatar backgrounds, subtle fills |
| `--color-brand-faint` | `#EDF5F6` | `#112030` | Hover row background, near-transparent tint |

> **Dark note:** Brand colours are darkened in dark mode so that light ink text (`#e2e8f0`) meets WCAG AA contrast (~3.5:1) on brand-coloured buttons.

#### Status Tokens

| Variable | Light value | Dark value | Used for |
|---|---|---|---|
| `--color-alert` | `#E5989B` | *(unchanged)* | Busy/full location status, destructive actions, error text |
| `--color-alert-light` | `#FAEAEA` | `#450a0a` | Alert badge backgrounds, warning panels |
| `--color-gold` | `#E2C044` | *(unchanged)* | Points balance, rewards, level badges, mission rewards |
| `--color-gold-light` | `#FBF3D0` | `#422006` | Gold-tinted card backgrounds, mission card bg |
| `--color-success` | `#7BC99A` | *(unchanged)* | Available/empty location status, check-in confirmation |
| `--color-success-light` | `#E8F6EE` | `#052e16` | Success badge backgrounds, check-in banner bg |

#### Special Tokens

| Variable | Light value | Dark value | Used for |
|---|---|---|---|
| `--color-overlay` | `#000000` | `#000000` *(never overridden)* | Modal backdrops (`bg-overlay/50`), QR scanner bg (`bg-overlay/95`) |
| `--font-sans` | `Inter, system-ui` | *(same)* | All body and UI text across the app |

> **Why `--color-overlay` never changes:** In dark mode, `--color-ink` flips to a light colour (`#e2e8f0`). If modal backdrops used `bg-ink/50`, they would become a semi-transparent *white* overlay — broken. `--color-overlay` is a permanently dark token for anything that must stay near-black regardless of theme.

---

### Quick Cheat Sheet — Tailwind Utility → Variable

```
bg-canvas         → var(--color-canvas)
bg-surface        → var(--color-surface)
bg-brand          → var(--color-brand)
bg-brand-faint    → var(--color-brand-faint)
bg-alert-light    → var(--color-alert-light)
bg-gold-light     → var(--color-gold-light)
bg-success-light  → var(--color-success-light)
bg-overlay        → var(--color-overlay)

text-ink          → var(--color-ink)
text-ink-muted    → var(--color-ink-muted)
text-ink-faint    → var(--color-ink-faint)
text-brand-dark   → var(--color-brand-dark)
text-alert        → var(--color-alert)
text-gold         → var(--color-gold)
text-success      → var(--color-success)

border-border     → var(--color-border)
border-brand      → var(--color-brand)
```

---

## Section 3 — Component Master List

### Layout — `src/components/layout/`

#### `Header.tsx`
The sticky top bar present on every authenticated page.

- **Profile dropdown** — fetches `username`, `avatar_url`, `points_balance`, and `is_admin` from Supabase `profiles` on mount. Displays real avatar or initials + live points.
- **Admin Panel link** — conditionally rendered only when `profile.is_admin === true`. Links to `/admin`.
- **Log Out** — calls `supabase.auth.signOut()` then redirects to `/auth/login`.
- **Page title** — auto-resolves from the current pathname via `PAGE_TITLES` map (supports dynamic route prefixes like `/location/[id]`).

#### `Sidebar.tsx`
The left-rail navigation. Collapsible on mobile (hamburger → overlay drawer).

- **`NAV_MAIN`** — primary links (Dashboard, Locations, Study Buddy, Events, Rewards).
- **`NAV_SECONDARY`** — secondary links (Leaderboard, Profile, Settings).
- Active state is driven by `usePathname()`. All colours use design tokens — no hardcoded hex.
- Mobile backdrop uses `bg-overlay/20` (stays dark in both themes).

#### `Footer.tsx`
Simple static footer. **Note:** still uses legacy hardcoded Tailwind classes (`bg-white`, `border-gray-200`) — not yet migrated to design tokens. Low priority unless it appears in the final design.

---

### Features — `src/components/features/`

#### `InteractiveMap.tsx`
An SVG-based library floor-plan with draggable/zoomable pins.

- Renders a `<svg>` campus map with coloured pins per `current_status` (`empty` → green, `busy` → yellow, `full` → red).
- Accepts `locations: DashboardLocation[]` and an `onSelectLocation` callback.
- Clicking a pin calls `onSelectLocation`, which opens the `LocationDrawer` in the parent page.
- Pan and zoom are handled via pointer events on the SVG viewport.

#### `CheckInModal.tsx`
A Radix `Dialog` for recording a study session.

- **Fields:** seats needed (stepper), activity type (Study / Eating), module name (text), session duration (preset chips: 30 min, 1 h, 2 h, 3 h+).
- Opened from the `LocationDrawer` "Check In" button, *after* QR verification succeeds.
- On submit, calls `onSubmit(CheckInData)` in the parent, which sets `activeSession` state.
- **z-index:** `z-60` — sits above the LocationDrawer (`z-50`) but below the QR scanner.

#### `FeedbackModal.tsx`
A Radix `Dialog` for checking out and leaving a crowd-status update.

- **Fields:** crowd rating (5-star), crowd status (Open / Busy / Full), optional comment.
- Opened from the `LocationDrawer` "Leave Spot" button or the active-session banner.
- On submit, calls `onSubmit(FeedbackData)` which clears `activeSession`, updates the location pin, and closes the drawer.
- **z-index:** `z-60`.

#### `QRScannerModal.tsx`
A fullscreen overlay that simulates physical presence verification via QR scan.

- **Dark overlay** (`bg-overlay/95`) with animated scanning line and corner markers — intentionally theatrical for the hackathon demo.
- **"Auto-Verify (Demo)"** button skips the real scan for judging purposes and calls `onSuccess()` after 900 ms.
- Must be opened *before* `CheckInModal` — the flow is: tap "Check In" → QR scanner opens → success → `CheckInModal` opens.
- **z-index:** `z-70` — topmost layer, above everything.

#### `SearchBar.tsx`
A simple controlled text input with clear button and an optional search-results dropdown.

- **Note:** still uses legacy hardcoded Tailwind classes (`bg-white`, `ring-sky-200`, `text-gray-*`). **Needs migration to design tokens** before it appears in production UI.
- Currently unused in main pages — available for future integration.

---

### Providers — `src/components/providers/`

#### `ThemeProvider.tsx`
A `"use client"` wrapper that automatically switches the app between light and dark mode.

- On mount, reads the current hour in **Singapore Time (SGT)** via `Intl.DateTimeFormat`.
- **Dark mode:** 7:00 PM – 5:59 AM SGT (`hour >= 19 || hour < 6`)
- **Light mode:** 6:00 AM – 6:59 PM SGT
- Toggles `class="dark"` on `<html>` via `document.documentElement.classList.toggle("dark", isDark)`.
- Re-checks every 60 seconds so a student studying past 7 PM sees the theme switch live.
- **To change the dark-mode threshold** — edit the `isDark` condition inside `applyTheme()`.
- Wraps the entire app in `src/app/layout.tsx`.

---

## Quick Reference — Adding a New Page

1. Create `src/app/your-route/page.tsx`.
2. Add the route title to `PAGE_TITLES` in `src/components/layout/Header.tsx`.
3. Add a nav link to `NAV_MAIN` or `NAV_SECONDARY` in `src/components/layout/Sidebar.tsx`.
4. If the route needs auth protection, add it to the `PROTECTED` array in `src/middleware.ts`. If it should be admin-only, add it to the admin path check block.
5. Use only design tokens (`text-ink`, `bg-surface`, `border-border`, etc.) — never hardcode hex values or `dark:` utility classes in components.
