# Contributing Guide

## Project Overview
SIMplify is a campus study platform built with Next.js, TypeScript, Tailwind CSS, and Supabase.  
This guide documents contribution ownership, folder conventions, and day-to-day workflow.

---

## Team Roles and Responsibilities

### Alex (Project and Tech Lead)
- Set up the GitHub repository and Supabase database.
- Lead backend architecture and API logic.
- Coordinate integration and unblock the team.

### Ameer (Backend Lead)
- Implement backend logic and data flows across features.
- Collaborate with Alex on API behavior, schema updates, and production fixes.

### Kimbery (Lead UI/UX Designer)
- Own UI/UX direction, design language, and visual standards.
- Define wireframes, typography, color system, and interaction patterns.

### Helen (UI Improvement and Frontend Implementation)
- Implement and refine frontend pages/components based on the design system.
- Handle overall UI improvement and consistency across screens.

### Chris Phoo (Demo Recording and Delivery Support)
- Handle demo recording and presentation support.
- Assist with feature showcase flow and release/demo readiness.

---

## Project Structure

```text
public/                 Static assets
src/
  app/                  App Router pages and API routes
  components/           Reusable UI, layout, and feature components
  lib/                  Business logic, DB modules, helpers, shared types
  types/                Additional TypeScript types
  utils/                Supabase client/server/admin utilities
README.md
CONTRIBUTING.md
```

### Folder Notes
- `src/app/`: Routes, layouts, page-level composition, and API endpoints.
- `src/components/`: Reusable components (`features`, `layout`, `ui`, `providers`).
- `src/lib/db/`: Database query modules grouped by domain.
- `src/utils/supabase/`: Supabase clients for browser, server, middleware, and admin.

---

## Workflow

1. Create a feature branch from `main`.
2. Implement scoped changes with clear commits.
3. Run checks locally (`npm run dev`, `npm run build`, `npm run lint`).
4. Open a PR with a short summary, screenshots (if UI), and test notes.
5. Request review from Alex (and domain owner when needed).

---

## Development Guidelines

### Frontend
- Keep page-level logic in `src/app/*/page.tsx`.
- Move reusable UI into `src/components/*`.
- Reuse theme tokens in `globals.css` and existing design patterns before adding new styles.

### Backend/Supabase
- Use existing modules under `src/lib/db/` before creating new DB access paths.
- Keep server-only logic in server actions/API routes.
- Never expose service-role keys or server-only queries in client components.

### General
- Prefer small, focused PRs.
- Remove dead code and stale comments before merging.
- Keep naming consistent and avoid duplicate feature implementations.

---

For help or merge coordination, contact Uncle Alex.
