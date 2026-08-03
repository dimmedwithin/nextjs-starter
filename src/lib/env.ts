import { z } from "zod";

/**
 * Validated, typed access to public (browser-exposed) env vars.
 *
 * Only `NEXT_PUBLIC_*` vars belong here — this module can run on the client.
 * Server-only secrets (once `/choose-stack` adds an auth stack) should get
 * their own `env.server.ts` validated separately and never imported from
 * client components.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url({
    message:
      "NEXT_PUBLIC_API_URL must be a valid URL pointing at your NestJS API (e.g. http://localhost:4000).",
  }),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});

if (!parsed.success) {
  // Fail loudly and early (build/boot time) rather than with a confusing
  // runtime fetch error deep inside a component.
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error(
    "Invalid environment variables. Check .env.local against .env.example."
  );
}

export const env = parsed.data;
