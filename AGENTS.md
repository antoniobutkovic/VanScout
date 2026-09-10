# VanScout project guide

## Web app

- The deployable web app lives at the repository root.
- It is a Next.js App Router + React 19 + TypeScript app. Product UI is in
  `src/screens`, shared visual primitives are in `src`, and API routes are in
  `src/app/api`.
- Keep the visual language aligned with the VanScout reference: warm paper
  background, moss green actions, clay accents, editorial typography, generous
  spacing, and responsive layouts.
- Use `npm run dev` for local development and `npm run build` for a production
  build. The API runs in the same Next process; do not start a separate
  backend server.
- Keep API route handlers in `src/app/api`, reusable services in `src/lib`,
  and database access in `src/lib/database.ts`.

## Mobile app

- The existing Kotlin Multiplatform app remains under `mobile/`.
- Follow `mobile/AGENTS.md` and `mobile/ARCHITECTURE_RULES.md` for mobile work.
