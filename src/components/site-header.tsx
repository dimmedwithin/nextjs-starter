"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/use-ui-store";

/**
 * Minimal shadcn-based header. No auth state (sign in/out, user menu) is
 * rendered here yet — /choose-stack adds that once an auth stack is
 * picked, likely by extending this component with a `useSession`/`useUser`
 * hook's result.
 */
export function SiteHeader() {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-heading text-sm font-semibold">
          nextjs-starter
        </Link>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle sidebar"
          onClick={toggleSidebar}
        >
          <MenuIcon />
        </Button>
      </div>
    </header>
  );
}
