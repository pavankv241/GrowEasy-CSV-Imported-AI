import Papa from "papaparse";
import type { CsvRow } from "../types/crm.js";

export interface ParseResult {
  headers: string[];
  rows: CsvRow[];
  totalRows: number;
}

export function parseCsvBuffer(buffer: Buffer): ParseResult {
  const text = buffer.toString("utf-8");
  return parseCsvText(text);
}

export function parseCsvText(text: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    const critical = result.errors.find((e) => e.type === "Quotes" || e.type === "FieldMismatch");
    if (critical) {
      throw new Error(`CSV parse error: ${critical.message}`);
    }
  }

  const headers = result.meta.fields ?? [];
  const rows: CsvRow[] = (result.data ?? []).map((row, index) => ({
    rowIndex: index + 1,
    data: Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()])
    ),
  }));

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}
