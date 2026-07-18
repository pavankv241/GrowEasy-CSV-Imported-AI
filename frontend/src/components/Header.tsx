"use client";

import { useTheme } from "./ThemeProvider";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-line/70 bg-surface/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <span className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.65rem]">
          CSV Importer
        </span>

        <button
          type="button"
          onClick={toggleTheme}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
          aria-label="Toggle color theme"
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </header>
  );
}
