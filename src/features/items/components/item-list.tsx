"use client";

import { Trash2Icon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { useDeleteItem, useItems } from "@/features/items/hooks";

/**
 * Example list component reading server state through `useItems()`
 * (TanStack Query). No auth headers are attached to the underlying
 * request yet — see `src/lib/api-client.ts`.
 */
export function ItemList() {
  const { data: items, isLoading, isError, error } = useItems();
  const deleteItem = useDeleteItem();

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading items…</p>;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load items</AlertTitle>
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : `Check that NEXT_PUBLIC_API_URL points at a running backend.`}
        </AlertDescription>
      </Alert>
    );
  }

  if (!items?.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No items yet — create one above.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{item.title}</CardTitle>
              {item.description && (
                <CardDescription>{item.description}</CardDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${item.title}`}
              disabled={deleteItem.isPending}
              onClick={() => deleteItem.mutate(item.id)}
            >
              <Trash2Icon />
            </Button>
          </CardHeader>
          <CardContent>
            <StatusBadge status="online" size="sm">
              synced
            </StatusBadge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
