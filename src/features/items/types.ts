import { z } from "zod";

/**
 * Example "items" feature — a stand-in CRUD resource matching the
 * `nestjs-starter` backend's own example "items" module, so the two
 * starter kits demonstrate the same end-to-end shape out of the box.
 */
export const itemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  createdAt: z.string(),
});

export type Item = z.infer<typeof itemSchema>;

export const createItemSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  description: z
    .string()
    .max(2000, "Description must be 2000 characters or fewer")
    .optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
