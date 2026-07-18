"use client";

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
    <div className="space-y-10">
      <dl className="grid grid-cols-3 gap-px border border-line bg-line">
        <Stat
          label="Imported"
          value={result.totalImported}
          tone="pine"
        />
        <Stat
          label="Skipped"
          value={result.totalSkipped}
          tone="warn"
        />
        <Stat
          label="Processed"
          value={result.totalProcessed}
          tone="ink"
        />
      </dl>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h3 className="font-display text-xl font-medium text-ink">
            Imported CRM records
          </h3>
          <span className="truncate font-mono text-[11px] text-muted">{fileName}</span>
        </div>
        <DataTable
          headers={[...CRM_HEADERS]}
          rows={importedRows}
          maxHeight="h-[400px]"
        />
      </section>

      {result.skipped.length > 0 && (
        <section>
          <h3 className="mb-4 font-display text-xl font-medium text-ink">
            Skipped records
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pine" | "warn" | "ink";
}) {
  const valueClass =
    tone === "pine"
      ? "text-pine"
      : tone === "warn"
        ? "text-warn"
        : "text-ink";

  return (
    <div className="bg-surface-raised px-4 py-5 sm:px-6">
      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        {label}
      </dt>
      <dd className={`mt-2 font-display text-4xl font-semibold tracking-tight ${valueClass}`}>
        {value}
      </dd>
    </div>
  );
}
