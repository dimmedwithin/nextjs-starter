import { apiClient } from "@/lib/api-client";
import type { CreateItemInput, Item } from "@/features/items/types";

/**
 * Thin, feature-scoped wrapper around the generic `apiClient`. Keeping
 * these calls here (rather than sprinkling `apiClient.get(...)` through
 * components) means the REST paths for this resource live in exactly one
 * place, and TanStack Query hooks (`hooks.ts`) stay focused on caching
 * concerns rather than URL construction.
 */
export const itemsApi = {
  list: () => apiClient.get<Item[]>("/items"),

  getById: (id: string) => apiClient.get<Item>(`/items/${id}`),

  create: (input: CreateItemInput) => apiClient.post<Item>("/items", input),

  delete: (id: string) => apiClient.delete<void>(`/items/${id}`),
};
