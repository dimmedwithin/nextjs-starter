"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A separate NestJS API is a real network hop with its own latency
        // and occasional downtime — a short staleTime avoids re-fetching on
        // every focus/mount while still keeping data reasonably fresh.
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  });
}

// Avoid re-creating the client on every render on the client, while still
// creating a fresh client per request on the server (React Server Components
// render per-request, so a module-level singleton would leak data between
// users if this ran on the server).
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
