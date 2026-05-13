CAPSync — Team coordination on Next.js + Supabase

This repository contains CAPSync, a lightweight team collaboration app built with Next.js and Supabase.

Getting started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

Key features

- Circles: create and manage collaborative groups with members and roles.
- Tracker: tasks, sprints, Kanban board and timeline views.
- Calendar: shared circle calendar with meeting scheduling and deadline management.
- Notifications: activity feed and toast notifications.
- Authentication: Supabase-backed sign-up, login and profile flows.
- Design system: shadcn UI primitives and design tokens for consistent styling.

Repository cleanup (pre-deploy)

As part of the final pre-deployment cleanup we removed several unused components and trimmed one unused dependency from package.json to reduce bundle size and maintenance surface. Removed items:

- components/notifications/ActivityFeedPanel.tsx
- components/circles/CircleNavigation.tsx
- components/calendar/MonthView.tsx
- components/calendar/WeekView.tsx
- components/ui/field.tsx
- components/ui/input-group.tsx

Removed package entry:

- `@radix-ui/react-dropdown-menu`

If you relied on any of the removed pieces, restore them from your VCS history or ask me to re-add them.

Linting and deployment checklist

- Run `npm run lint` and fix any remaining TypeScript or lint warnings before deploying.
- Build and test the app locally with `npm run build` and `npm start` (or using your deployment pipeline).
- Verify Supabase environment variables are configured in production.

If you want, I can proceed to:

- fix the remaining linter errors automatically where safe
- prune unused dependencies from package.json and run a clean install
- create a production-ready build and smoke-test it locally

License: see project settings or repository root for licensing information.
