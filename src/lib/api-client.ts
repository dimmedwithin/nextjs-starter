import { env } from "@/lib/env";

/**
 * Generic, stack-agnostic REST client for talking to the NestJS backend.
 *
 * Deliberately contains NO auth logic. This starter kit defers the choice
 * of auth stack (Better-Auth vs Supabase) to the `/choose-stack` Claude Code
 * command, run once per project. Until that command is run, every request
 * this client makes is unauthenticated.
 */

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
  /** JSON-serializable request body. Automatically stringified. */
  body?: unknown;
  /** Query string params, appended to the URL. */
  searchParams?: Record<string, string | number | boolean | undefined>;
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

async function request<TResponse>(
  path: string,
  { body, searchParams, headers, ...init }: RequestOptions = {}
): Promise<TResponse> {
  const response = await fetch(buildUrl(path, searchParams), {
    ...init,
    method: init.method ?? (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
      // <-- choose-stack will add auth headers/interceptors here
      // (e.g. `Authorization: Bearer <access_token>` from an in-memory
      // token store, plus 401 -> refresh -> retry logic for Option A,
      // or the Supabase session's access_token as a bearer token for
      // Option B). Do not add token logic above this line by hand —
      // let the /choose-stack command generate it so both options stay
      // consistent with their respective session-management code.
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Credentials are same-origin by default. If the NestJS API lives on a
    // different origin and the chosen auth stack relies on cookies, this
    // will likely need to become "include" — that's also something
    // /choose-stack should wire up alongside the cookie/session strategy.
  });

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
