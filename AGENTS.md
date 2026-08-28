# VanScout project guide

## Web app

- The deployable web client lives at the repository root.
- It is a React 19 + TypeScript + Vite app with UI in `src/` and static assets
  in `public/`.
- Keep product UI in `src/pages` and shared visual primitives in `src`.
- Keep the visual language aligned with the VanScout reference: warm paper
  background, moss green actions, clay accents, editorial typography, generous
  spacing, and responsive layouts.
- Use `npm run dev` for local development and `npm run build` for a production
  build.

## Backend

- The Hono backend lives in `api/`.
- Use `npm run dev:api` to run the local API server and `npm run build:api` to
  build it.
- Keep API route handlers in `api/routes`, services in `api/services`, and
  database code in `api/db`.

## Mobile app

- The existing Kotlin Multiplatform app remains under `mobile/`.
- Follow `mobile/AGENTS.md` and `mobile/ARCHITECTURE_RULES.md` for mobile work.
