"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
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
  { key: "processing", label: "AI Extract" },
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Step indicator */}
        <nav className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                  i <= stepIndex
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`hidden text-sm sm:inline ${
                  i <= stepIndex
                    ? "font-medium text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="mx-1 h-px w-8 bg-zinc-200 dark:bg-zinc-700" />
              )}
            </div>
          ))}
        </nav>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <section className="mx-auto max-w-2xl">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Upload your CSV
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Any format works — our AI maps columns to GrowEasy CRM fields
              </p>
            </div>
            <FileUpload onFileSelect={handleFileSelect} disabled={isParsing} />
            {isParsing && (
              <p className="mt-4 text-center text-sm text-zinc-500">Parsing CSV...</p>
            )}
          </section>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && parsedCsv && (
          <section className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  Preview: {parsedCsv.fileName}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {parsedCsv.totalRows} rows · {parsedCsv.headers.length} columns — no AI
                  processing yet
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700"
                >
                  <Sparkles className="h-4 w-4" />
                  Confirm Import
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <DataTable headers={parsedCsv.headers} rows={previewRows} />
          </section>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && <ImportProgress />}

        {/* Step 4: Results */}
        {step === "results" && result && parsedCsv && (
          <section className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  Import Complete
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  AI-mapped CRM records ready for GrowEasy
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <RotateCcw className="h-4 w-4" />
                Import Another File
              </button>
            </div>
            <ResultsSummary result={result} fileName={parsedCsv.fileName} />
          </section>
        )}
      </main>

      <footer className="mt-auto border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
        GrowEasy CSV Importer · Assignment Submission
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
