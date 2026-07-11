import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import {
  CRM_STATUSES,
  DATA_SOURCES,
  type CrmRecord,
  type CsvRow,
  type ImportResult,
  type SkippedRecord,
} from "../types/crm.js";
import { enrichAndNormalizeRecord } from "../utils/recordNormalizer.js";

const CrmRecordSchema = z.object({
  created_at: z.string(),
  name: z.string(),
  email: z.string(),
  country_code: z.string(),
  mobile_without_country_code: z.string(),
  company: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  lead_owner: z.string(),
  crm_status: z.enum(CRM_STATUSES).or(z.literal("")),
  crm_note: z.string(),
  data_source: z.enum(DATA_SOURCES).or(z.literal("")),
  possession_time: z.string(),
  description: z.string(),
});

const BatchResponseSchema = z.object({
  records: z.array(
    z.object({
      rowIndex: z.number(),
      record: CrmRecordSchema,
      skip: z.boolean().optional(),
      skipReason: z.string().optional(),
    })
  ),
});

const SYSTEM_PROMPT = `You map CSV rows to GrowEasy CRM format. Return ONLY this exact JSON shape:

{"records":[{"rowIndex":1,"record":{"created_at":"","name":"","email":"","country_code":"","mobile_without_country_code":"","company":"","city":"","state":"","country":"","lead_owner":"","crm_status":"","crm_note":"","data_source":"","possession_time":"","description":""},"skip":false,"skipReason":""}]}

Rules:
- Each item MUST have rowIndex, record (nested object with all 15 CRM fields), skip, skipReason
- crm_status: GOOD_LEAD_FOLLOW_UP | DID_NOT_CONNECT | BAD_LEAD | SALE_DONE | ""
- data_source: leads_on_demand | meridian_tower | eden_park | varah_swamy | sarjapur_plots | ""
- Map columns intelligently even when names differ
- First email/mobile only; extras go in crm_note
- skip=true only if no email AND no mobile
- Use "" for missing fields, never omit fields`;

const CRM_FIELD_KEYS = [
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

type AiProvider = "groq" | "gemini";

function buildUserPrompt(headers: string[], batch: CsvRow[]): string {
  return `Map these CSV rows to CRM format. Return {"records":[{"rowIndex":N,"record":{...all 15 fields...},"skip":false}]}.

Headers: ${JSON.stringify(headers)}
Rows: ${JSON.stringify(batch.map((r) => ({ rowIndex: r.rowIndex, data: r.data })))}`;
}

function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(jsonText);
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("429") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("rate limit")
  );
}

function getRetryDelayMs(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const secondsMatch = message.match(/retry in ([\d.]+)s/i);
  if (secondsMatch) {
    return Math.ceil(parseFloat(secondsMatch[1]) * 1000) + 2000;
  }
  return 15000;
}

function hasContactInfo(record: CrmRecord): boolean {
  const email = record.email.trim();
  const mobile = record.mobile_without_country_code.replace(/\D/g, "");
  return email.length > 0 || mobile.length >= 6;
}

function normalizeRecord(record: CrmRecord, originalData?: Record<string, string>): CrmRecord {
  return enrichAndNormalizeRecord(record, originalData);
}

function coerceString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function extractCrmFields(item: Record<string, unknown>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const key of CRM_FIELD_KEYS) {
    fields[key] = coerceString(item[key]);
  }
  return fields;
}

function normalizeAiResponse(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;

  const root = parsed as Record<string, unknown>;
  const rawRecords = Array.isArray(root.records)
    ? root.records
    : Array.isArray(parsed)
      ? parsed
      : null;

  if (!rawRecords) return parsed;

  const records = rawRecords.map((item, index) => {
    if (!item || typeof item !== "object") {
      return { rowIndex: index + 1, record: extractCrmFields({}), skip: true, skipReason: "Invalid row" };
    }

    const row = item as Record<string, unknown>;
    const rowIndex = Number(row.rowIndex ?? index + 1);

    if (row.record && typeof row.record === "object") {
      return {
        rowIndex,
        record: extractCrmFields(row.record as Record<string, unknown>),
        skip: Boolean(row.skip),
        skipReason: coerceString(row.skipReason),
      };
    }

    // Groq/Llama often returns flat CRM fields at top level instead of nested "record"
    return {
      rowIndex,
      record: extractCrmFields(row),
      skip: Boolean(row.skip),
      skipReason: coerceString(row.skipReason),
    };
  });

  return { records };
}

function validateBatchResponse(
  batch: CsvRow[],
  parsed: unknown
): z.infer<typeof BatchResponseSchema>["records"] {
  const normalized = normalizeAiResponse(parsed);
  const validated = BatchResponseSchema.safeParse(normalized);

  if (!validated.success) {
    throw new Error(`Invalid AI response format: ${validated.error.message}`);
  }

  const expectedIndices = new Set(batch.map((r) => r.rowIndex));
  const returnedIndices = new Set(validated.data.records.map((r) => r.rowIndex));

  for (const idx of expectedIndices) {
    if (!returnedIndices.has(idx)) {
      throw new Error(`AI response missing rowIndex ${idx}`);
    }
  }

  return validated.data.records;
}

function resolveProvider(): AiProvider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "groq" || explicit === "gemini") return explicit;
  if (process.env.GROQ_API_KEY) return "groq";
  return "gemini";
}

async function callGroq(headers: string[], batch: CsvRow[]): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is required when AI_PROVIDER=groq");

  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(headers, batch) },
      ],
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Groq API error (${response.status})`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from Groq model");

  return parseJsonResponse(content);
}

async function callGemini(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  headers: string[],
  batch: CsvRow[]
): Promise<unknown> {
  const result = await model.generateContent(buildUserPrompt(headers, batch));
  const content = result.response.text();
  if (!content) throw new Error("Empty response from Gemini model");
  return parseJsonResponse(content);
}

export class AiExtractor {
  private provider: AiProvider;
  private geminiModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;
  private modelName: string;
  private batchSize: number;
  private apiCallCount = 0;

  constructor() {
    this.provider = resolveProvider();
    this.batchSize = Number(process.env.BATCH_SIZE ?? 50);

    if (this.provider === "groq") {
      if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY environment variable is required");
      }
      this.modelName = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");

      const genAI = new GoogleGenerativeAI(apiKey);
      this.modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-lite";
      this.geminiModel = genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });
    }
  }

  async extract(
    headers: string[],
    rows: CsvRow[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<ImportResult> {
    const imported: CrmRecord[] = [];
    const skipped: SkippedRecord[] = [];
    const rowMap = new Map(rows.map((r) => [r.rowIndex, r]));
    this.apiCallCount = 0;

    const totalBatches = Math.ceil(rows.length / this.batchSize);
    console.log(
      `Processing ${rows.length} rows in ${totalBatches} ${this.provider} API call(s) using ${this.modelName}`
    );

    for (let i = 0; i < rows.length; i += this.batchSize) {
      const batch = rows.slice(i, i + this.batchSize);
      const batchResult = await this.processBatch(headers, batch);

      for (const item of batchResult) {
        const original = rowMap.get(item.rowIndex);
        const record = normalizeRecord(item.record, original?.data);

        if (item.skip || !hasContactInfo(record)) {
          skipped.push({
            rowIndex: item.rowIndex,
            originalData: original?.data ?? {},
            reason: item.skipReason ?? "Record has neither email nor mobile number",
          });
        } else {
          imported.push(record);
        }
      }

      onProgress?.(Math.min(i + this.batchSize, rows.length), rows.length);
    }

    console.log(`${this.provider} API calls used: ${this.apiCallCount}`);

    return {
      imported,
      skipped,
      totalImported: imported.length,
      totalSkipped: skipped.length,
      totalProcessed: rows.length,
      extractionMethod: "ai",
    };
  }

  private async processBatch(
    headers: string[],
    batch: CsvRow[]
  ): Promise<z.infer<typeof BatchResponseSchema>["records"]> {
    try {
      return await this.callAi(headers, batch);
    } catch (error) {
      if (isRateLimitError(error)) {
        const delay = getRetryDelayMs(error);
        console.warn(`Rate limited. Waiting ${delay}ms then retrying once...`);
        await new Promise((r) => setTimeout(r, delay));
        return await this.callAi(headers, batch);
      }
      throw error;
    }
  }

  private async callAi(
    headers: string[],
    batch: CsvRow[]
  ): Promise<z.infer<typeof BatchResponseSchema>["records"]> {
    this.apiCallCount++;

    const parsed =
      this.provider === "groq"
        ? await callGroq(headers, batch)
        : await callGemini(this.geminiModel!, headers, batch);

    return validateBatchResponse(batch, parsed);
  }
}
