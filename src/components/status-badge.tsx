import { tv, type VariantProps } from "tailwind-variants";

/**
 * Example custom component built with `tailwind-variants` (tv()), the
 * chosen variant-styling tool for this starter kit going forward.
 *
 * shadcn/ui's own generated primitives under `src/components/ui/*` (e.g.
 * `badge.tsx`) ship with `class-variance-authority` baked in — that's
 * upstream shadcn code and is left untouched so `shadcn add`/updates keep
 * working cleanly. But any NEW custom variant component you write by hand
 * should follow this pattern instead: tv() merges conflicting Tailwind
 * classes automatically and supports slots for compound components, which
 * CVA does not.
 */
const statusBadge = tv({
  base: "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  variants: {
    status: {
      online:
        "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      offline: "border-border bg-muted text-muted-foreground",
      busy: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      error: "border-destructive/20 bg-destructive/10 text-destructive",
    },
    size: {
      sm: "text-[0.7rem]",
      md: "text-xs",
    },
  },
  defaultVariants: {
    status: "offline",
    size: "md",
  },
});

export type StatusBadgeProps = VariantProps<typeof statusBadge> & {
  children: React.ReactNode;
  className?: string;
};

export function StatusBadge({
  status,
  size,
  className,
  children,
}: StatusBadgeProps) {
  return (
    <span className={statusBadge({ status, size, className })}>
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current opacity-70"
      />
      {children}
    </span>
  );
}
