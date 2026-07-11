import Papa from "papaparse";
import type { CsvRow, ParsedCsv } from "@/types/crm";

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          const critical = results.errors.find(
            (e) => e.type === "Quotes" || e.type === "FieldMismatch"
          );
          if (critical) {
            reject(new Error(`CSV parse error: ${critical.message}`));
            return;
          }
        }

        const headers = results.meta.fields ?? [];
        const rows: CsvRow[] = (results.data ?? []).map((row, index) => ({
          rowIndex: index + 1,
          data: Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              String(value ?? "").trim(),
            ])
          ),
        }));

        resolve({
          headers,
          rows,
          totalRows: rows.length,
          fileName: file.name,
        });
      },
      error: (error) => reject(new Error(error.message)),
    });
  });
}
