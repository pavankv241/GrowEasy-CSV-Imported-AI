"use client";

import { useCallback, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { FileUpload } from "@/components/FileUpload";
import { Header } from "@/components/Header";
import { ImportProgress } from "@/components/ImportProgress";
import { ResultsSummary } from "@/components/ResultsSummary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { extractCrmRecords } from "@/lib/api";
import { parseCsvFile } from "@/lib/csv";
import type { AppStep, ImportResult, ParsedCsv } from "@/types/crm";

const STEPS: { key: AppStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Preview" },
  { key: "processing", label: "Extract" },
  { key: "results", label: "Results" },
];

function ImporterApp() {
  const [step, setStep] = useState<AppStep>("upload");
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setIsParsing(true);
    try {
      const parsed = await parseCsvFile(file);
      if (parsed.rows.length === 0) {
        throw new Error("CSV file contains no data rows");
      }
      setParsedCsv(parsed);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
      setParsedCsv(null);
      setStep("upload");
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!parsedCsv) return;
    setError(null);
    setStep("processing");

    try {
      const importResult = await extractCrmRecords(parsedCsv.headers, parsedCsv.rows);
      setResult(importResult);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  }, [parsedCsv]);

  const handleReset = () => {
    setStep("upload");
    setParsedCsv(null);
    setResult(null);
    setError(null);
  };

  const previewRows = parsedCsv?.rows.map((r) => r.data) ?? [];
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="ge-shell flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {step !== "upload" && (
          <nav className="mb-8 animate-rise">
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              {STEPS.map((s, i) => (
                <li key={s.key} className="flex items-center gap-1">
                  <span className={i <= stepIndex ? "text-pine" : ""}>
                    {String(i + 1).padStart(2, "0")} {s.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="mx-2 text-line" aria-hidden>
                      /
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-3 h-px w-full overflow-hidden bg-line">
              <div
                className="h-full bg-pine transition-all duration-500 ease-out"
                style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </nav>
        )}

        {error && (
          <div className="mb-6 border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger animate-rise">
            {error}
          </div>
        )}

        {step === "upload" && (
          <section className="mx-auto max-w-2xl pt-6 sm:pt-12">
            <div className="mb-10 text-center">
              <p className="animate-rise font-mono text-[11px] uppercase tracking-[0.22em] text-moss">
                Lead import tool
              </p>
              <h1 className="animate-rise-delay mt-4 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
                GrowEasy
              </h1>
              <div className="mx-auto mt-5 h-px w-24 origin-center scale-x-100 bg-ember animate-draw" />
              <p className="animate-rise-delay-2 mx-auto mt-6 max-w-md text-base leading-relaxed text-muted">
                Drop any spreadsheet. AI maps columns to your CRM lead fields —
                then you confirm before anything is imported.
              </p>
            </div>
            <div className="animate-rise-delay-2">
              <FileUpload onFileSelect={handleFileSelect} disabled={isParsing} />
              {isParsing && (
                <p className="mt-4 text-center font-mono text-xs tracking-wide text-muted">
                  Parsing CSV…
                </p>
              )}
            </div>
          </section>
        )}

        {step === "preview" && parsedCsv && (
          <section className="space-y-6 animate-rise">
            <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl font-medium tracking-tight text-ink">
                  Preview
                </h2>
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium text-ink">{parsedCsv.fileName}</span>
                  <span className="mx-2 text-line">·</span>
                  {parsedCsv.totalRows} rows
                  <span className="mx-2 text-line">·</span>
                  {parsedCsv.headers.length} columns
                  <span className="mx-2 text-line">·</span>
                  no AI yet
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="border border-line bg-surface-raised px-4 py-2.5 text-sm font-medium text-ink transition hover:border-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="bg-ember px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ember-deep"
                >
                  Confirm import
                </button>
              </div>
            </div>
            <DataTable headers={parsedCsv.headers} rows={previewRows} />
          </section>
        )}

        {step === "processing" && <ImportProgress />}

        {step === "results" && result && parsedCsv && (
          <section className="space-y-6 animate-rise">
            <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl font-medium tracking-tight text-ink">
                  Import complete
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Mapped CRM records ready for GrowEasy
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="border border-line bg-surface-raised px-4 py-2.5 text-sm font-medium text-ink transition hover:border-muted"
              >
                Import another file
              </button>
            </div>
            <ResultsSummary result={result} fileName={parsedCsv.fileName} />
          </section>
        )}
      </main>

      <footer className="border-t border-line/70 py-5 text-center font-mono text-[11px] tracking-[0.12em] text-muted">
        GrowEasy · CSV Importer
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <ImporterApp />
    </ThemeProvider>
  );
}
