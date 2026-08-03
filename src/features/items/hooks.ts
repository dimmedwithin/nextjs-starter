import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { itemsApi } from "@/features/items/api";
import type { CreateItemInput } from "@/features/items/types";

/**
 * Query keys are centralized here so invalidation stays consistent across
 * every hook that touches the "items" resource.
 */
export const itemsKeys = {
  all: ["items"] as const,
  lists: () => [...itemsKeys.all, "list"] as const,
  detail: (id: string) => [...itemsKeys.all, "detail", id] as const,
};

export function useItems() {
  return useQuery({
    queryKey: itemsKeys.lists(),
    queryFn: itemsApi.list,
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: itemsKeys.detail(id),
    queryFn: () => itemsApi.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateItemInput) => itemsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => itemsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });
    },
  });
}
