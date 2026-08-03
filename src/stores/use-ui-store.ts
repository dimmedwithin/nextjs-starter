import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Example Zustand store for light, client-only UI state — the kind of
 * thing that doesn't belong in TanStack Query (it isn't server data) and
 * is overkill for React Context (it changes often and only a few
 * components care). Session/user state is intentionally NOT modeled here:
 * that gets added by /choose-stack alongside whichever auth stack you pick.
 */
interface UiState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  theme: "light" | "dark" | "system";
  setTheme: (theme: UiState["theme"]) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),

      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "ui-store",
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        theme: state.theme,
      }),
    }
  )
);
