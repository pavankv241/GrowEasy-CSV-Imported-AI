"use client";

import { Loader2 } from "lucide-react";

interface ImportProgressProps {
  message?: string;
}

export function ImportProgress({
  message = "AI is mapping your CSV columns to CRM fields...",
}: ImportProgressProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white px-8 py-16 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="relative mb-6">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 dark:border-emerald-900 dark:border-t-emerald-400" />
        <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-pulse text-emerald-600 dark:text-emerald-400" />
      </div>
      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        Processing with AI
      </h3>
      <p className="mt-2 max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
        {message}
      </p>
      <div className="mt-6 h-1.5 w-64 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-emerald-500" />
      </div>
    </div>
  );
}
