# MatchCore Frontend Demo

Frontend-only React/Vite application for the MatchCore CV/offers matching platform.

This package is prepared so a frontend developer can work without running the backend. By default, the checked-in `.env` enables mocked/demo data.

## Stack

- React 18 + TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS + shadcn/ui components
- Vitest for unit tests

## Quick start

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:8080`.

## Demo login

The frontend can infer the role from the email address when `VITE_ENABLE_MOCK_FALLBACK=true`:

- Candidate: `candidate@matchcore.demo`
- Provider/company: `provider@matchcore.demo`
- Advisor/admin: `advisor@matchcore.demo`

Any password can be used in demo mode.

## Available scripts

```bash
npm run dev       # start Vite dev server
npm run build     # production build
npm run preview   # preview the production build
npm run lint      # ESLint checks
npm test          # Vitest unit tests
```

## Environment files

- `.env` — frontend-only demo mode, safe for local handoff.
- `.env.frontend-demo` — same idea as `.env`, can be copied if needed.
- `.env.backend.example` — template for connecting to the backend.
- `.env.example` — generic template.

For backend mode, copy `.env.backend.example` to `.env`, set `VITE_ADMIN_API_KEY` only for a local/dev backend, and set:

```env
VITE_ENABLE_MOCK_FALLBACK=false
VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:8010
```

Important: every `VITE_*` variable is public in the browser bundle. Do not put a production secret in a Vite frontend environment file.

## Validation performed before handoff

The project has been checked with:

```bash
npm run build
npm test
npm run lint
```

Current lint status: no blocking errors. Some shadcn/ui files may still show Fast Refresh warnings because they export helpers and components from the same file; this does not block build or local development.
