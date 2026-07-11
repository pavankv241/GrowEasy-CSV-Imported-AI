"use client";

import { AlertCircle, CheckCircle2, SkipForward } from "lucide-react";
import type { ImportResult } from "@/types/crm";
import { DataTable } from "./DataTable";

const CRM_HEADERS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
] as const;

interface ResultsSummaryProps {
  result: ImportResult;
  fileName: string;
}

export function ResultsSummary({ result, fileName }: ResultsSummaryProps) {
  const importedRows = result.imported.map((r) => ({ ...r }));
  const skippedRows = result.skipped.map((s) => ({
    rowIndex: String(s.rowIndex),
    reason: s.reason,
    ...s.originalData,
  }));
  const skippedHeaders = [
    "rowIndex",
    "reason",
    ...Object.keys(result.skipped[0]?.originalData ?? {}),
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Total Imported"
          value={result.totalImported}
          accent="emerald"
        />
        <StatCard
          icon={<SkipForward className="h-5 w-5 text-amber-600" />}
          label="Total Skipped"
          value={result.totalSkipped}
          accent="amber"
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5 text-blue-600" />}
          label="Total Processed"
          value={result.totalProcessed}
          accent="blue"
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Imported CRM Records
          </h3>
          <span className="text-xs text-zinc-500">{fileName}</span>
        </div>
        <DataTable
          headers={[...CRM_HEADERS]}
          rows={importedRows}
          maxHeight="h-[400px]"
        />
      </section>

      {result.skipped.length > 0 && (
        <section>
          <h3 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Skipped Records
          </h3>
          <DataTable
            headers={skippedHeaders}
            rows={skippedRows}
            maxHeight="h-[300px]"
          />
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "emerald" | "amber" | "blue";
}) {
  const bgMap = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/30",
    amber: "bg-amber-50 dark:bg-amber-950/30",
    blue: "bg-blue-50 dark:bg-blue-950/30",
  };

  return (
    <div
      className={`rounded-xl border border-zinc-200 p-5 dark:border-zinc-700 ${bgMap[accent]}`}
    >
      <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}
