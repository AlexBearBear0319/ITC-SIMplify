# SIMplify

SIMplify is a campus study companion web app for SIM students.
It helps students find available study zones, check in with QR, track points, unlock achievements, join study groups, view campus events, and redeem rewards.

Built with Next.js (App Router), Supabase, Tailwind CSS v4, and Vercel.

## Project Overview

SIMplify combines live occupancy data and gamification to improve how students use campus study spaces.

Core idea:
- make seat availability visible in real time
- reduce crowding and uncertainty when choosing a study spot
- reward useful student actions (check-ins, reviews, missions)
- give admins practical visibility into usage trends and status mismatches

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/AlexBearBear0319/ITC-SIMplify.git
cd ITC-SIMplify
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env.local` in the project root.

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
OPENAI_API_KEY=your-openai-api-key
```

Notes:
- `NEXT_PUBLIC_*` values are from Supabase Project Settings -> API.
- `SUPABASE_SERVICE_ROLE_KEY` is required for secure server-side routes (admin actions and events calendar API).
- `OPENAI_API_KEY` is required for AI chat, events AI suggestions, and admin insight generation.

### 4. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

### 5. Useful scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |

## Features Summary and Usage Guide

### Student Side

1. Dashboard Map and Live Zone Status
- Browse the interactive campus map.
- See status per zone: `empty`, `busy`, `full`.
- Tap a pin to open location details.

2. QR Check-in and Session Tracking
- Open a location and scan the QR code to check in.
- Session occupancy updates zone status automatically.
- End session to free seats and refresh status.

3. Events Calendar and Study Suggestions
- View monthly campus events.
- Select a date to see event details.
- AI suggests suitable study spots in readable point form.

4. Study Buddy / Group Study
- Create a study group with member limit and duration.
- Join or leave active groups.
- Group occupancy contributes to live zone status.

5. Profile, Level, Achievements, Missions
- Track points, level, streak, and recent activities.
- Complete missions and unlock achievements.
- Equip badge display from earned badges.

6. Rewards and Redemption
- Spend points on rewards.
- Track pending and claimed redemptions.

7. AI Campus Chat
- Ask for spot recommendations (quiet, power, group-friendly, etc.).
- Responses are concise, point form, and route-aware.

### Admin Side

1. Overview Analytics
- KPI cards, peak-hour chart, area usage breakdown.
- AI trend insight in actionable format.

2. Zone Status Debug Panel
- Compare derived status vs stored `current_status`.
- Quickly detect mismatches by zone.

3. Data Management
- Manage events, rewards, locations, users, reviews, points rules, schools/majors/subjects.
- Upload campus map and location images.

## Live Deployed Link (Vercel)

https://itc-simplify.vercel.app

## Known Limitations and Future Improvements

### Known Limitations

- Upload progress for location images is estimated UI progress, not exact byte-level transfer progress.
- Occupancy accuracy depends on session lifecycle integrity (`active_sessions.is_active` cleanup).
- Some AI outputs can still vary in style depending on model behavior.
- Full automated test coverage (unit/integration/e2e) is not complete yet.
- Some admin analytics are derived from table reads and may not reflect advanced BI-level metrics.

### Future Improvements

- Move uploads to signed direct-storage flow with true byte-level progress.
- Add scheduled cleanup/worker logic for stale sessions.
- Expand test coverage with integration and e2e tests.
- Add stronger observability for AI routes and Supabase errors.
- Improve analytics with materialized views or RPC endpoints for heavier reporting.

## Team Contribution Breakdown

| Member | Role | Contribution |
|---|---|---|
| Alex (Vun Kian Hiung) | Tech & Project Lead | Project architecture, Supabase schema planning, deployment pipeline, integration coordination, and code review. |
| Ameer | Backend Lead | Supabase data layer, server actions/API routes, session/points/achievement logic, and DB integrations. |
| Kimbery | UI/UX Lead | Product flows, interface direction, design system, and visual consistency guidance. |
| Helen | Frontend Developer | Feature page implementation, component integration, and responsive UI work. |
| Chris | Frontend Developer | Frontend feature implementation, page wiring, and interaction refinements. |

If your final submission requires exact per-feature ownership, replace this section with your latest final assignment split before submission.

---

For contributor workflow and standards, see [CONTRIBUTING.md](./CONTRIBUTING.md).  
For handover notes, see [TEAM_HANDOVER.md](./TEAM_HANDOVER.md).
