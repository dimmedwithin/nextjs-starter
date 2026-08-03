# nextjs-starter

A minimalist, production-ready Next.js starter kit for fast, AI-assisted MVPs
with Claude Code — pairs with a `nestjs-starter` backend, but doesn't require
it to exist to install, lint, typecheck, or build.

**Stack:** Next.js (App Router, TypeScript strict) · shadcn/ui (Base UI) +
Tailwind + tailwind-variants · TanStack Query + Zustand · React Hook Form +
Zod · PostHog · pnpm · Vercel.

Auth is intentionally **not** wired up yet — see [Auth setup](#auth-setup)
below.

> **Personal starter kit.** This is a personal template maintained for my own projects (and shared as-is with friends). It's opinionated on purpose and will keep changing as my preferences and the ecosystem evolve — no promise of backward compatibility between clones taken at different times. Fork/clone it and adapt it freely to your own needs.

## Setup

1. Clone this repo.
2. `pnpm install`
3. `cp .env.example .env.local` and set `NEXT_PUBLIC_API_URL` to your running
   NestJS backend (defaults to `http://localhost:4000`).
4. `pnpm dev`
5. Open [http://localhost:3000](http://localhost:3000) — the "Items" example
   page will show a loading/error state until a real backend is running at
   `NEXT_PUBLIC_API_URL` with a matching `/items` REST resource.

## Auth setup

Run `/choose-stack` in Claude Code **before your first commit** to wire up
authentication against your chosen backend stack (Better-Auth client or
Supabase client). See [`.claude/commands/choose-stack.md`](.claude/commands/choose-stack.md)
for what it generates. Until you run it, every API request is unauthenticated
by design — no token/session code is committed to this template.

## Scripts

| Command                        | Description                            |
| ------------------------------ | -------------------------------------- |
| `pnpm dev`                     | Start the dev server                   |
| `pnpm build`                   | Production build                       |
| `pnpm lint`                    | ESLint                                 |
| `pnpm typecheck`               | `tsc --noEmit`                         |
| `pnpm format` / `format:check` | Prettier (with Tailwind class sorting) |

## Project structure

```
src/
  app/            routing only — thin route files that import from features
  features/       feature folders (e.g. items/: hooks, api client, form, list)
  components/     shared components; components/ui/ is shadcn's copy-pasted output
  lib/            query client/provider, generic API client, utils, env validation
  stores/         Zustand stores for light client-side UI state
```

See [`CLAUDE.md`](CLAUDE.md) for the full architectural context.

## Sesiones de trabajo: `/retomar` y `/cerrar`

Dos slash commands para llevar continuidad entre sesiones de Claude Code, respaldadas en un journal versionado en `docs/`:

- **`/cerrar`** — al terminar de laburar: verifica el estado del repo (lint, typecheck, build, git status), escribe/actualiza `docs/journal/<fecha>.md` con qué se hizo y una sección "Próxima sesión — empezar acá", guarda memoria durable si corresponde, y commitea + pushea.
- **`/retomar`** — al arrancar de nuevo: lee `docs/00-index.md` y la última entrada del journal, resume en qué quedó el proyecto, y propone el próximo paso (esperando tu OK antes de tocar nada).

`docs/00-index.md` y `docs/journal/` no vienen pre-armados — los crea `/cerrar` la primera vez que se corre. Ver `.claude/commands/retomar.md` y `.claude/commands/cerrar.md` para el detalle completo.

## Deployment

Deploy to Vercel. Set `NEXT_PUBLIC_API_URL` (and, after `/choose-stack`, your
auth env vars) as Vercel project environment variables.

## License

[MIT](LICENSE) — use it, fork it, adapt it freely.
