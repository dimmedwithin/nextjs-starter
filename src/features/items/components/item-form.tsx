"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCreateItem } from "@/features/items/hooks";
import { createItemSchema, type CreateItemInput } from "@/features/items/types";

/**
 * Example React Hook Form + Zod form, wired to a TanStack Query mutation.
 * This is the pattern to copy for any new "create X" form in the app.
 */
export function ItemForm() {
  const createItem = useCreateItem();

  const form = useForm<CreateItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  function onSubmit(values: CreateItemInput) {
    createItem.mutate(values, {
      onSuccess: () => {
        toast.success("Item created");
        form.reset();
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong"
        );
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Ship the landing page" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Optional details" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={createItem.isPending}
          className="justify-self-start"
        >
          {createItem.isPending ? "Creating…" : "Create item"}
        </Button>
      </form>
    </Form>
  );
}
