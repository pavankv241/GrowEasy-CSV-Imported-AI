import type { CsvRow, ImportResult } from "@/types/crm";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function extractCrmRecords(
  headers: string[],
  rows: CsvRow[]
): Promise<ImportResult> {
  const response = await fetch(`${API_URL}/api/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headers, rows }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to extract CRM records");
  }

  return data as ImportResult;
}
