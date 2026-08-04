# CLAUDE.md

Project context for Claude Code when working in this repo.

## What this is

A stack-agnostic Next.js starter kit ("vibecoding starter kit") for fast,
AI-assisted MVP development. It pairs naturally with a sibling
`nestjs-starter` repo (a NestJS API), but **this repo is independently
cloneable and must never depend on that sibling existing** — its own
`pnpm install`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` must all
succeed with only this repo present.

## Tech stack decisions (already made — do not re-litigate without cause)

- **Framework**: Next.js, App Router, TypeScript strict, `src/` layout,
  `@/*` import alias.
- **UI**: shadcn/ui (Base UI primitives, not Radix) + Tailwind CSS v4.
  shadcn-generated files under `src/components/ui/*` use
  `class-variance-authority` internally (that's upstream shadcn code — leave
  it as-is so `shadcn add`/updates keep working).
- **Variant styling for hand-written components**: `tailwind-variants`
  (`tv()`), not CVA. See `src/components/status-badge.tsx` for the reference
  pattern. Use this for any _new_ custom variant component.
- **Server state**: TanStack Query (`@tanstack/react-query`). Provider in
  `src/lib/providers/query-provider.tsx`. Query keys are centralized per
  feature (see `src/features/items/hooks.ts`).
- **Client state**: Zustand, one small store per concern (see
  `src/stores/use-ui-store.ts`). Reach for this only for UI-only state that
  doesn't belong in TanStack Query or local component state.
- **Forms**: React Hook Form + Zod + `@hookform/resolvers`. `src/components/ui/form.tsx`
  is hand-maintained (not CLI-generated — shadcn's Base UI registry doesn't
  publish a `form` item yet as of this writing) but matches the classic
  shadcn/ui form composition API (`Form`, `FormField`, `FormItem`,
  `FormLabel`, `FormControl`, `FormMessage`).
- **Analytics**: PostHog (`posthog-js`), inert until `NEXT_PUBLIC_POSTHOG_KEY`
  is set. No user identification wired in yet — that belongs with whichever
  auth stack gets chosen (see below).
- **Package manager**: pnpm (pinned via `packageManager` in `package.json`).
- **Deploy target**: Vercel.

## Auth is NOT scaffolded yet — by design

This template deliberately ships with **zero auth-integration code**. There
is no token store, no session hook, no login/signup page, no `middleware.ts`
(Next.js 16 renamed this file convention to `proxy.ts` — see below), and the
generic API client in `src/lib/api-client.ts` sends no `Authorization`
header. This mirrors the `nestjs-starter` backend's own design: it defers
choosing between "MongoDB + Mongoose + Better-Auth" and "Supabase all-in-one"
until the developer decides, via a `/choose-stack` command in each repo.

**Do not write Better-Auth-client or Supabase-client code into this app
speculatively.** That code is generated on demand by running `/choose-stack`
in Claude Code inside a project cloned from this template — see
`.claude/commands/choose-stack.md` for the full instructions Claude follows
when that command runs. If asked to "add login" or "wire up auth" in a fresh
clone of this template, point to `/choose-stack` first rather than
hand-rolling a one-off auth integration.

The one thing already in place for whichever stack gets chosen: a clearly
marked comment (`// <-- choose-stack will add auth headers/interceptors
here`) inside `src/lib/api-client.ts`, and a matching marker comment at the
bottom of `.env.example` for stack-specific env vars.

## Next.js 16 note

This project scaffolded on Next.js 16. The `middleware.ts` file convention
was renamed to `proxy.ts` (`export function proxy(request)` instead of
`export function middleware(request)`) — this matters if/when `/choose-stack`
or any future work adds route-protection logic. Check
`node_modules/next/dist/docs/` for anything else that looks unfamiliar before
assuming older Next.js conventions still apply.

## Git identity & commit hygiene

This repo lives under the `dimmedwithin` GitHub account, which is separate
from the user's work GitHub account. Both accounts are configured on this
machine, so:

- **Local git identity, not global.** This repo's `user.name`/`user.email`
  are set via `git config` (local, no `--global`) to the `dimmedwithin`
  identity (`Facu Fuentes <facufu@proton.me>`). Never rely on the machine's
  global git config for commits here — it may point at the work identity.
- **Remote must use the `github-dimmedwithin` SSH host alias**, never plain
  `github.com`. On this machine, `git@github.com` authenticates as the work
  account; only `git@github-dimmedwithin:dimmedwithin/<repo>.git` routes
  through the key tied to the `dimmedwithin` account. Verify with
  `ssh -T git@github-dimmedwithin` (expect `Hi dimmedwithin!`) before adding
  or changing a remote, and never push if that check fails or resolves to
  the wrong account.
- **No AI attribution in commits.** Never add `Co-Authored-By: Claude`,
  "Generated with Claude Code", or similar trailers/lines to commit messages
  in this repo — commits should read as solely authored by the user.

## Folder structure

```
src/
  app/            routing only — thin route files, no business logic
  features/       one folder per feature (e.g. items/: types, api, hooks, components)
  components/     shared, cross-feature components (components/ui/ = shadcn output)
  lib/            query client/provider, PostHog provider, generic API client, env, utils
  stores/         Zustand stores
```

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` — ESLint (`next lint`)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm format` / `pnpm format:check` — Prettier + `prettier-plugin-tailwindcss`

CI (`.github/workflows/ci.yml`) runs lint → typecheck → build on every push
and PR to `main`, using pnpm with frozen lockfile. No test runner is wired up
yet — add one (Vitest/RTL is the natural fit) when the app has real logic
worth testing beyond the example `items` feature.
