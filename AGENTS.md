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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
