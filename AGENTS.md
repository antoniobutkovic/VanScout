# Movago project guide

## Web app

- The deployable web client lives in `apps/client`.
- It is a standalone React 19 + TypeScript + Vite app.
- Keep product UI in `apps/client/src/pages` and shared visual primitives in
  `apps/client/src`.
- Keep the visual language aligned with the Movago reference: warm paper
  background, moss green actions, clay accents, editorial typography, generous
  spacing, and responsive layouts.
- Use `pnpm --dir apps/client dev` for local development and
  `pnpm --dir apps/client build` for a production build.

## Mobile app

- The existing Kotlin Multiplatform app remains under `mobile/`.
- Follow `mobile/AGENTS.md` and `mobile/ARCHITECTURE_RULES.md` for mobile work.
