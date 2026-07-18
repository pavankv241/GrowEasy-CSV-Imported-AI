"use client";

interface ImportProgressProps {
  message?: string;
}

export function ImportProgress({
  message = "Mapping your CSV columns to GrowEasy CRM fields…",
}: ImportProgressProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center animate-rise">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-moss">
        Working
      </p>
      <h3 className="mt-4 font-display text-3xl font-medium tracking-tight text-ink">
        Extracting leads
      </h3>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{message}</p>

      <div className="relative mt-10 h-[2px] w-full max-w-xs overflow-hidden bg-line">
        <div
          className="absolute inset-y-0 w-1/3 bg-ember"
          style={{ animation: "pulse-bar 1.4s ease-in-out infinite" }}
        />
      </div>

      <div
        className="mt-8 font-mono text-[11px] tracking-[0.16em] text-muted"
        style={{ animation: "soft-breathe 2s ease-in-out infinite" }}
      >
        Please wait
      </div>
    </div>
  );
}
