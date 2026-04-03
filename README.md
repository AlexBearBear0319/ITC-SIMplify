# SIMplify

**SIMplify** is a web app built by the IT Club that helps students find available study spots on campus, check in using QR codes, and earn points for contributing crowd status updates. Students can also browse upcoming campus events, join study groups, and redeem points for rewards.

Tech stack:
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + Framer Motion
- Supabase (Auth, Postgres, Storage)
- OpenAI via AI SDK for campus assistant features

## Project Overview

SIMplify solves a common campus problem: students waste time searching for seats, power outlets, and suitable study environments.

The platform combines:
- Live location occupancy signals
- Solo and group study session flows
- Gamification (points, achievements, missions, leaderboard)
- Rewards redemption
- Admin controls and insights

---

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

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Get these values from the Supabase Dashboard under **Project Settings > API**.

### 4. Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Other scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Builds the app for production |
| `npm start` | Runs the production build |
| `npm run lint` | Runs ESLint |

---

## Features

### Study Spot Finder
The dashboard displays an interactive floor plan of the Tay Eng Soon Library. Each study zone shows its current crowd status (empty, busy, or full) as a colour-coded pin. Students can pan and zoom the map to find a spot, then tap a pin to view details.

### QR Code Check-In
On any location detail page, students scan a QR code to check in. A successful scan opens a form to record their activity type, module, number of seats needed, and how long they plan to stay.

### Crowd Status Updates
Students can report the current crowd level at any location directly from the location detail page. Each submitted update earns 10 points and appears in the live status log.

### Study Buddy 
Students can start a session to study together with their buddies or find new friends with the same goal. 

### Events Calendar
The Events page shows a monthly calendar with campus events marked on each date. Selecting a date displays that day's events along with a study spot recommendation based on expected foot traffic.

### Leaderboard
A live-updating leaderboard ranks students by total points. The top three positions are shown on a podium. Each student's rank, username, and point total are visible in the full list below.

### User Profile and Badges
The profile page shows a student's total points, check-in count, and study streak. Earned IT Club badges are displayed with their rarity tier (common, rare, or epic). Badges that are locked show progress toward unlocking them.

### Rewards Store
Students spend accumulated points in the Rewards store. Items are grouped into physical rewards, virtual rewards, and room or equipment bookings. Each item shows its points cost and remaining stock.

### Admin Panel
Users with admin access can view campus analytics including check-in counts, peak hour traffic charts, and a breakdown of location categories. Access is restricted at the routing level by the `is_admin` flag in Supabase.

### AI Chatbot 
Students are able to ask chatbot about any information regarding study spot in campus. The chatbot can help with finding a spot according to the students' preferences and finding the current available spot. 

### Automatic Dark Mode
The app switches to dark mode between 7:00 PM and 5:59 AM Singapore Time (SGT) without any user input. The theme is managed through CSS variables, so no Tailwind `dark:` classes are needed. SIMplify also provides a toggle for students to change between light mode and dark mode. 

---

## Live Deployment

The app is deployed on Vercel:

**[https://itc-simplify.vercel.app](https://itc-simplify.vercel.app)**

---

## Known Limitations and Future Improvements

### Current Limitations

- The **Statistics** and **Admin** pages display mock data. The Supabase RPC calls for KPI metrics, peak hour density, and category breakdown are not yet connected.
- The **Location Detail** page partially uses mock data. QR token validation against the database and point-awarding on check-in are not yet implemented.
- The **Rewards** redemption flow does not call the Supabase RPC function yet. Items can be selected but the transaction is not recorded in the database.
- The **Study Buddy Finder** page exists but displays mock study group slots instead of live data from Supabase.
- **Notification preferences** in Settings are UI-only. The corresponding database table has not been created yet.
- The `SearchBar` and `Footer` components use hardcoded Tailwind colour classes instead of the project's design tokens. These need to be migrated before they are production-ready.
- There is no `.env.example` file in the repository. New contributors need to request the Supabase credentials directly.
- The map only displays one part of Singapore Institute Management. Students can only check in at the Tay Eng Soon Library, hence the study spot is limited. 
- The zone updated status are slightly unsync which leads to inaccuracy with the real-life situations.


### Planned Improvements

- Replace all mock data with live Supabase queries and RPC calls.
- Complete the QR code validation flow (match scanned token against `locations.qr_token` and log to `status_logs`).
- Implement the rewards redemption RPC and deduct points from the user's balance on confirmation.
- Build out the Study Buddy Finder with real study group creation and discovery.
- Add the notifications preferences table to Supabase and wire up the Settings toggles.
- Migrate `SearchBar` and `Footer` to use design tokens from `globals.css`.
- Add a `.env.example` file to the repository.
- Improve the method on update status to be more accurate. 
- Improve the method of student checking in. 
- Expand the map to covers all study spots in Singapore Institute of Management. 

---

## Team Contributions

| Member | Role | Contributions |
|--------|------|---------------|
| **Alex (Vun Kian Hiung)** | Tech and Project Lead | Set up the repository, designed the Supabase database schema, configured authentication middleware, handled Vercel deployment, and managed pull request reviews. |
| **Ameer** | Backend Lead | Built the Supabase data layer including all fetch, insert, and update functions across locations, sessions, profiles, events, points, reviews, and study groups. |
| **Kimbery** | UI/UX Lead | Produced the Figma wireframes, defined the design system (colour palette, typography, and spacing), and specified the "Relax View" theme used throughout the app. |
| **Helen** | Frontend Developer | Implemented pages and React components from Kimbery's designs using Tailwind CSS. |
| **Chris** | Frontend Developer | Implemented pages and React components from Kimbery's designs using Tailwind CSS. |

For coding conventions, folder structure, and the Git workflow, see [CONTRIBUTING.md](./CONTRIBUTING.md).
For the full component API, design token reference, and route architecture, see [TEAM_HANDOVER.md](./TEAM_HANDOVER.md).
