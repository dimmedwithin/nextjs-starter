import { ItemForm } from "@/features/items/components/item-form";
import { ItemList } from "@/features/items/components/item-list";

/**
 * Route files under src/app/ stay thin — this page just composes feature
 * components from src/features/items/. Routing logic lives here; data
 * fetching, forms, and business logic live in the feature folder.
 */
export default function HomePage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-heading text-2xl font-semibold">Items</h1>
        <p className="text-muted-foreground text-sm">
          Example feature wired to your NestJS API via TanStack Query + React
          Hook Form + Zod. No auth headers are attached yet — run{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            /choose-stack
          </code>{" "}
          in Claude Code to wire up auth.
        </p>
      </div>

      <section className="grid gap-4">
        <h2 className="text-sm font-medium">New item</h2>
        <ItemForm />
      </section>

      <section className="grid gap-4">
        <h2 className="text-sm font-medium">All items</h2>
        <ItemList />
      </section>
    </div>
  );
}
