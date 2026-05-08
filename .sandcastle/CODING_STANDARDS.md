# Coding Standards

## Stack

- pnpm monorepo with `frontend/` and `backend/` workspaces
- Backend: Hono on Node via `@hono/node-server`, TypeScript, Vitest
- Frontend: Vue 3 + Vite + Vue Router + Pinia + TailwindCSS v4
- Formatting: Prettier (semi, double quotes, trailing commas, 100 char width)
- Linting: ESLint with typescript-eslint + eslint-plugin-vue + eslint-config-prettier

## Style

- Prefer terse simplicity
- prefer a functional style
- No `any` types -- use proper typing
- No commented-out code or TODO comments in committed code

## Architecture

- Backend app definition (`app.ts`) is separated from server startup (`index.ts`) for testability
- Backend routes use Hono's basePath `/api`
- Frontend uses `@/` path alias for `src/`
- Frontend proxies `/api` to backend in dev via Vite config

## Testing

- Backend tests use Vitest with Hono's built-in `app.request()` -- no HTTP server needed
- Test files live alongside source files as `*.test.ts`
- Run backend tests: `pnpm --filter backend test`

## Verification

Before committing, all of these must pass:

- `pnpm --filter backend typecheck`
- `pnpm --filter frontend typecheck`
- `pnpm --filter backend test`
- `npx fallow dead-code --changed-since HEAD` (no dead code introduced)
