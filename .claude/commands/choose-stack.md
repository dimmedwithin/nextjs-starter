---
description: Wire up authentication against a chosen backend stack (Better-Auth client or Supabase client) — the one decision this starter kit deliberately leaves unmade until you run this command.
---

# /choose-stack

This starter kit ships with **zero auth-integration code** on purpose. There
is no token store, no session hook, no login/signup page, no route
protection, and `src/lib/api-client.ts` sends every request unauthenticated
(look for the `// <-- choose-stack will add auth headers/interceptors here`
comment inside it). This command is what fills that gap in, once, for a
specific project.

Follow these steps in order.

## Step 1 — Present the two options

Show the user a concise summary of both options before asking anything.
Post this comparison (the substance below is the whole point — don't just
say "see the docs," this repo has no external docs directory to point to):

---

### Option A: Better-Auth client

Pairs with a NestJS backend that runs [Better-Auth](https://www.better-auth.com)
(typically via a community adapter such as `@thallesp/nestjs-better-auth`),
issuing its own JWTs. This is the natural fit if the paired `nestjs-starter`
was scaffolded with **MongoDB + Mongoose + Better-Auth**.

**Pros**

- NestJS remains the real "brain" of the app — it owns every auth decision,
  issues its own tokens, and isn't a thin pass-through to someone else's
  platform.
- Fully self-hosted, MIT-licensed, zero per-user or per-MAU billing at any
  scale.
- Works with any database the NestJS backend uses (Mongo, Postgres, etc.) —
  not tied to Postgres.
- Matches the httpOnly-cookie-refresh + in-memory-access-token architecture
  this starter kit uses for maximum XSS resistance (tokens never touch
  `localStorage`).

**Cons**

- More integration glue: the frontend talks to whatever REST shape the
  NestJS Better-Auth adapter exposes, which can vary by adapter/version —
  the code below assumes conventional `/auth/login`, `/auth/signup`,
  `/auth/refresh`, `/auth/logout`, `/auth/me` endpoints and may need small
  path adjustments to match the actual backend.
- You (not a managed vendor) are responsible for refresh-token rotation and
  revocation correctness on the backend.

### Option B: Supabase client

The Next.js app talks to Supabase **directly** for auth (not through
NestJS) using `@supabase/supabase-js` + `@supabase/ssr`. Pairs naturally
with a `nestjs-starter` scaffolded with **Supabase (Postgres + Auth +
Storage)** as its all-in-one backend — or can be used even without a NestJS
backend at all.

**Pros**

- Fastest path to working auth: email/password, magic links, OAuth, MFA all
  come "for free" from Supabase's hosted GoTrue service.
- Session refresh, cookie handling, and JWT verification are handled by
  `@supabase/ssr` — very little custom code to get wrong.
- Free tier covers 50,000 MAU — generous for any hobby/MVP project.
- If your NestJS backend's data model lives in the same Supabase Postgres
  instance, Row Level Security can do authorization instead of hand-written
  guards.

**Cons**

- Next.js now depends on Supabase directly for identity — NestJS (if you
  have one) becomes a thinner layer that just verifies the Supabase-issued
  JWT on incoming requests, rather than owning auth itself.
- Vendor coupling to Supabase's auth product (mitigated: Supabase is fully
  open source and self-hostable if you ever need to leave the managed
  platform).

---

## Step 2 — Ask which option to use

Use `AskUserQuestion` to ask the user which option they want, with a
reminder built into the question:

> "Which auth stack should I wire up for this Next.js app — Option A
> (Better-Auth client, pairs with a NestJS + Mongo + Better-Auth backend)
> or Option B (Supabase client, talks to Supabase directly for auth)? If
> you're pairing this with the `nestjs-starter` sibling repo, pick whichever
> option matches what you already chose (or plan to choose) in **that**
> repo's own `/choose-stack` command — the two must agree, since Option A's
> NestJS backend and Option B's Supabase project are not interchangeable
> identity providers."

Offer exactly two options: **"Option A — Better-Auth client"** and
**"Option B — Supabase client"**. Do not proceed until the user answers.

Once answered, follow the matching section below (Step 3A or Step 3B), then
finish with Step 4 in both cases.

---

## Step 3A — Implement Option A: Better-Auth client

No new npm packages are required — this uses plain `fetch` (already wrapped
by `src/lib/api-client.ts`) and the `zustand` dependency already installed
in this starter kit.

> **Adjust endpoint paths if needed.** The code below assumes the NestJS
> backend exposes `POST /auth/login`, `POST /auth/signup`, `POST
/auth/refresh`, `POST /auth/logout`, and `GET /auth/me`, matching the
> access-token-in-memory + httpOnly-refresh-cookie flow this starter kit is
> built around. If the paired `nestjs-starter`'s Better-Auth adapter uses
> different paths (e.g. Better-Auth's own default `/api/auth/sign-in/email`
> convention), update the `AUTH_ENDPOINTS` object in
> `src/features/auth/api.ts` accordingly — the token-handling architecture
> below is the important part, not the exact path strings.

### 3A.1 — In-memory access-token store

Create `src/stores/use-auth-store.ts`:

```ts
import { create } from "zustand";

/**
 * Holds the short-lived access token AND the current user in memory only —
 * never in localStorage/sessionStorage, so an XSS payload can't read it.
 * It's intentionally lost on a full page reload; useSession() below
 * recovers it via a silent refresh against the httpOnly refresh cookie.
 */
interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (session: { accessToken: string; user: AuthUser }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
}));
```

### 3A.2 — Wire the API client: attach bearer token + 401 refresh retry

Replace the contents of `src/lib/api-client.ts` with:

```ts
import { env } from "@/lib/env";
import { useAuthStore } from "@/stores/use-auth-store";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined>;
  /** Internal: set on the retry attempt to prevent infinite refresh loops. */
  _isRetry?: boolean;
};

function buildUrl(path: string, searchParams?: RequestOptions["searchParams"]) {
  const url = new URL(path.replace(/^\//, ""), `${env.NEXT_PUBLIC_API_URL}/`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Calls the refresh endpoint. The httpOnly refresh cookie is sent
 * automatically by the browser (credentials: "include") — this code never
 * touches the refresh token itself, only the short-lived access token the
 * backend hands back in the JSON body.
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      useAuthStore.getState().clearSession();
      return null;
    }

    const data = (await response.json()) as {
      accessToken: string;
      user: { id: string; email: string; name?: string | null };
    };
    useAuthStore.getState().setSession(data);
    return data.accessToken;
  } catch {
    useAuthStore.getState().clearSession();
    return null;
  }
}

async function request<TResponse>(
  path: string,
  { body, searchParams, headers, _isRetry, ...init }: RequestOptions = {}
): Promise<TResponse> {
  const accessToken = useAuthStore.getState().accessToken;

  const response = await fetch(buildUrl(path, searchParams), {
    ...init,
    method: init.method ?? (body ? "POST" : "GET"),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Access token expired mid-session: refresh once, then retry the original
  // request exactly once. Never retry a request that was already a retry,
  // and never retry the refresh call itself (checked by path below) — both
  // would risk an infinite loop.
  if (response.status === 401 && !_isRetry && path !== "/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<TResponse>(path, {
        body,
        searchParams,
        headers,
        ...init,
        _isRetry: true,
      });
    }
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : `Request to ${path} failed with status ${response.status}`,
      response.status,
      data
    );
  }

  return data as TResponse;
}

export const apiClient = {
  get: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>(path, { ...options, method: "GET" }),
  post: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>(path, { ...options, method: "POST", body }),
  patch: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>(path, { ...options, method: "PATCH", body }),
  put: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>(path, { ...options, method: "PUT", body }),
  delete: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>(path, { ...options, method: "DELETE" }),
};
```

Note `credentials: "include"` is now set on every request — required so the
httpOnly refresh cookie travels with the `/auth/refresh` call. If the
NestJS API is on a different origin than the Next.js app, make sure its CORS
config sets `Access-Control-Allow-Credentials: true` and an explicit (not
wildcard) `Access-Control-Allow-Origin`, and that the refresh cookie is set
with `SameSite=None; Secure` cross-site or `SameSite=Lax` same-site.

### 3A.3 — Auth feature: API calls + useSession hook

Create `src/features/auth/types.ts`:

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type SignupInput = z.infer<typeof signupSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}
```

Create `src/features/auth/api.ts`:

```ts
import { apiClient, refreshAccessToken } from "@/lib/api-client";
import type {
  AuthSession,
  AuthUser,
  LoginInput,
  SignupInput,
} from "@/features/auth/types";

// See the note at the top of this command's Option A section if your
// NestJS backend's Better-Auth adapter exposes different paths.
const AUTH_ENDPOINTS = {
  login: "/auth/login",
  signup: "/auth/signup",
  logout: "/auth/logout",
  me: "/auth/me",
} as const;

export const authApi = {
  login: (input: LoginInput) =>
    apiClient.post<AuthSession>(AUTH_ENDPOINTS.login, input),

  signup: (input: Omit<SignupInput, "confirmPassword">) =>
    apiClient.post<AuthSession>(AUTH_ENDPOINTS.signup, input),

  logout: () => apiClient.post<void>(AUTH_ENDPOINTS.logout),

  me: () => apiClient.get<AuthUser>(AUTH_ENDPOINTS.me),

  /** Silent refresh against the httpOnly refresh cookie. */
  refresh: refreshAccessToken,
};
```

Create `src/features/auth/use-session.ts`:

```ts
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/stores/use-auth-store";

/**
 * Bootstraps and exposes the current session. On mount (e.g. after a full
 * page reload, since the access token lives in memory only), it attempts a
 * silent refresh against the httpOnly refresh cookie before falling back to
 * "not authenticated". Call this once near the root of the app (see the
 * SessionProvider wiring below) plus anywhere you need `{ user, isLoading }`.
 */
export function useSession() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const storeUser = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      if (accessToken) {
        return authApi.me();
      }
      const refreshed = await authApi.refresh();
      if (!refreshed) return null;
      return authApi.me();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: storeUser ?? query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(storeUser ?? query.data),
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);

  return async () => {
    await authApi.logout().catch(() => undefined);
    clearSession();
    queryClient.setQueryData(["session"], null);
  };
}
```

Add a tiny bootstrap component so the silent refresh runs once near the app
root. Create `src/features/auth/components/session-boundary.tsx`:

```tsx
"use client";

import { useSession } from "@/features/auth/use-session";

/** Mount once in the root layout to trigger the silent-refresh-on-load. */
export function SessionBoundary({ children }: { children: React.ReactNode }) {
  useSession();
  return <>{children}</>;
}
```

Then wrap `{children}` with `<SessionBoundary>` inside
`src/app/layout.tsx`, nested underneath `<QueryProvider>` (it needs
TanStack Query context) and above `<SiteHeader />`.

### 3A.4 — Login and signup pages

Create `src/features/auth/components/login-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/api";
import { loginSchema, type LoginInput } from "@/features/auth/types";
import { useAuthStore } from "@/stores/use-auth-store";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    try {
      const session = await authApi.login(values);
      setSession(session);
      router.push(searchParams.get("redirectTo") ?? "/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invalid email or password"
      );
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Enter your email and password.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Logging in…" : "Log in"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              No account?{" "}
              <Link href="/signup" className="underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

Create `src/features/auth/components/signup-form.tsx` (same pattern, adapted
for signup):

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/api";
import { signupSchema, type SignupInput } from "@/features/auth/types";
import { useAuthStore } from "@/stores/use-auth-store";

export function SignupForm() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SignupInput) {
    try {
      const { confirmPassword: _confirmPassword, ...input } = values;
      const session = await authApi.signup(input);
      setSession(session);
      router.push("/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create account"
      );
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>It only takes a minute.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Ada Lovelace" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating account…" : "Sign up"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="underline underline-offset-4">
                Log in
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

Create the thin route files, `src/app/login/page.tsx`:

```tsx
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <LoginForm />
    </div>
  );
}
```

And `src/app/signup/page.tsx`:

```tsx
import { SignupForm } from "@/features/auth/components/signup-form";

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <SignupForm />
    </div>
  );
}
```

### 3A.5 — Route protection: `src/proxy.ts`

Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
(`export function proxy(request)` instead of `export function
middleware(request)` — same runtime behavior, new name/file). Because this
project uses a `src/` directory, the file goes at `src/proxy.ts` (next to
`src/app`), **not** the repo root.

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Add any route prefixes that require an authenticated user.
const PROTECTED_PATHS = ["/dashboard"];

// Must match whatever cookie name your NestJS backend sets for the
// httpOnly refresh token on /auth/login and /auth/refresh.
const REFRESH_COOKIE_NAME = "refresh_token";

/**
 * This is an OPTIMISTIC check only, per Next.js's own guidance: Proxy can
 * read cookies (even httpOnly ones — httpOnly only blocks browser JS, not
 * server-side code) but must not be relied on as the sole authorization
 * mechanism. The NestJS API independently verifies the bearer token on
 * every request regardless of what happens here; this just avoids
 * flashing a protected page before redirecting an obviously-logged-out
 * visitor.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!request.cookies.has(REFRESH_COOKIE_NAME)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

Proceed to **Step 4**.

---

## Step 3B — Implement Option B: Supabase client

Install the two Supabase packages:

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

> Grounded against the current official `with-supabase` Next.js template
> (`create-next-app -e with-supabase`, App Router). Two things changed
> recently that older tutorials get wrong: the file is `proxy.ts`, not
> `middleware.ts` (Next.js 16 rename), and Supabase's publishable client key
> env var is now named `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the
> `sb_publishable_...` key), not the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` —
> both work, but new projects should use the publishable-key naming.

### 3B.1 — Browser and server clients

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Especially important if using Fluid compute: don't put this client in a
 * global variable. Always create a new client within each function that
 * needs it (Server Components, Route Handlers, Server Actions).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore as long as
            // src/proxy.ts is refreshing the session (see 3B.2 below).
          }
        },
      },
    }
  );
}
```

### 3B.2 — Session refresh: `src/lib/supabase/proxy.ts` + `src/proxy.ts`

Create `src/lib/supabase/proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // With Fluid compute, don't put this client in a global variable —
  // always create a new one per request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getClaims(). A simple
  // mistake here can make it very hard to debug users being randomly
  // logged out.
  //
  // IMPORTANT: if you remove this call and use server-side rendering with
  // the Supabase client, users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const PROTECTED_PATHS = ["/dashboard"];
  const isProtected = PROTECTED_PATHS.some(
    (path) =>
      request.nextUrl.pathname === path ||
      request.nextUrl.pathname.startsWith(`${path}/`)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // IMPORTANT: you *must* return supabaseResponse as-is (or copy its
  // cookies onto whatever response you do return) — changing this can
  // desync the browser and server and terminate sessions prematurely.
  return supabaseResponse;
}
```

Create `src/proxy.ts` (project root would be wrong here — this project uses
a `src/` directory, so `proxy.ts` belongs at `src/proxy.ts`, next to
`src/app`):

```ts
import { updateSession } from "@/lib/supabase/proxy";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match everything except static assets/images — adjust as needed.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### 3B.3 — `useUser` hook

Create `src/features/auth/use-user.ts`:

```ts
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

export function useUser() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["supabase-user"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getClaims();
      if (error || !data?.claims) return null;
      return data.claims;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Keep the cached user in sync with sign-in/sign-out events fired by the
  // Supabase client elsewhere in the app (e.g. the login/signup forms).
  useEffect(() => {
    const supabase = createClient();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["supabase-user"] });
    });
    return () => subscription.subscription.unsubscribe();
  }, [queryClient]);

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(query.data),
  };
}

export function useLogout() {
  const queryClient = useQueryClient();

  return async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    queryClient.setQueryData(["supabase-user"], null);
  };
}
```

### 3B.4 — Login and signup pages

Create `src/features/auth/components/login-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type LoginInput = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      form.setError("root", { message: error.message });
      return;
    }

    router.push(searchParams.get("redirectTo") ?? "/");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Enter your email below to log in.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p className="text-destructive text-sm">
                {form.formState.errors.root.message}
              </p>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Logging in…" : "Log in"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              No account?{" "}
              <Link href="/signup" className="underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

Create `src/features/auth/components/signup-form.tsx`, same pattern,
swapping in `supabase.auth.signUp(values)` and copy for account creation
(include an `emailRedirectTo` if the Supabase project requires email
confirmation):

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const signupSchema = z
  .object({
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type SignupInput = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SignupInput) {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      form.setError("root", { message: error.message });
      return;
    }

    router.push("/signup-success");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>It only takes a minute.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p className="text-destructive text-sm">
                {form.formState.errors.root.message}
              </p>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating account…" : "Sign up"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="underline underline-offset-4">
                Log in
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

Create the thin routes, `src/app/login/page.tsx` and
`src/app/signup/page.tsx` (identical shape to Option A's, just importing
these Supabase-backed form components):

```tsx
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <LoginForm />
    </div>
  );
}
```

```tsx
import { SignupForm } from "@/features/auth/components/signup-form";

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <SignupForm />
    </div>
  );
}
```

### 3B.5 — Data calls to NestJS use the Supabase JWT as a bearer token

**This is the key architectural point for Option B**: auth talks to
Supabase directly, but if there's a separate NestJS API for data (not just
Postgres via Supabase directly), that API needs the Supabase-issued access
token as a bearer token so it can verify the request came from an
authenticated Supabase user. Update `src/lib/api-client.ts`'s request
function to attach it:

```ts
import { createClient } from "@/lib/supabase/client";

// Inside request(), before building headers:
const supabase = createClient();
const {
  data: { session },
} = await supabase.auth.getSession();
const accessToken = session?.access_token;

// ...then in headers:
// ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
```

(Apply this as a full edit to the existing `request()` function in
`src/lib/api-client.ts` — attach the header the same way Option A does,
just sourcing the token from Supabase's session instead of the in-memory
Zustand store. No 401-refresh-retry dance is needed here: `@supabase/ssr`
and the Supabase client already keep the session's access token fresh in
the background.) The NestJS backend, in turn, needs to verify this JWT
against Supabase's JWKS/secret — that's backend-side work in
`nestjs-starter`, not this repo.

Proceed to **Step 4**.

---

## Step 4 — Finish up

Regardless of which option was implemented:

1. Update `.env.example`: replace the
   `# --- Stack-specific auth vars added by /choose-stack go below this line ---`
   placeholder with the real vars for the chosen option:
   - **Option A**: no new public env vars are strictly required (the
     access token comes back in the login/refresh response body, and the
     refresh token is an httpOnly cookie set by the backend) — but add a
     comment noting the NestJS API origin must have CORS + cookie settings
     configured to match (`credentials: true`, explicit origin,
     `SameSite`/`Secure` matching same-origin vs cross-origin deployment).
   - **Option B**: add
     ```
     NEXT_PUBLIC_SUPABASE_URL=
     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
     ```
2. Create `.env.local` (if it doesn't already exist) from the updated
   `.env.example` and fill in real values so `pnpm dev` works locally.
3. Update `README.md`: replace the "Auth setup" section's "not wired up
   yet" language with a short description of the chosen stack and any
   setup steps specific to it (e.g. Option B: create a Supabase project,
   copy its URL/publishable key).
4. Update `CLAUDE.md`: replace the "Auth is NOT scaffolded yet" section
   with a short description of what was generated (list the new files) so
   future Claude Code sessions in this repo have accurate context instead
   of instructions that are now stale.
5. Remove the `// <-- choose-stack will add auth headers/interceptors
here` marker comment from `src/lib/api-client.ts` if it's still present
   (Option A's full-file replacement above already omits it; Option B's
   edit should remove it too).
6. Run `pnpm lint && pnpm typecheck && pnpm build` and fix anything that
   fails before committing — don't leave the repo in a broken state.
7. Make a git commit (only after the above passes), for example:
   ```
   git add -A
   git commit -m "Wire up <Better-Auth|Supabase> client auth via /choose-stack"
   ```
