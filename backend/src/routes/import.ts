import { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { AiExtractor } from "../services/aiExtractor.js";
import { parseCsvBuffer, parseCsvText } from "../utils/csvParser.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

const ImportBodySchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(
    z.object({
      rowIndex: z.number(),
      data: z.record(z.string()),
    })
  ),
});

export const importRouter = Router();

let extractor: AiExtractor | null = null;

function getExtractor(): AiExtractor {
  if (!extractor) {
    extractor = new AiExtractor();
  }
  return extractor;
}

// Parse CSV file only (no AI) — optional server-side parse endpoint
importRouter.post("/parse", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No CSV file uploaded" });
      return;
    }

    const parsed = parseCsvBuffer(req.file.buffer);
    res.json({
      headers: parsed.headers,
      rows: parsed.rows,
      totalRows: parsed.totalRows,
      fileName: req.file.originalname,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse CSV";
    res.status(400).json({ error: message });
  }
});

// AI extraction from pre-parsed rows (frontend preview flow)
importRouter.post("/extract", async (req: Request, res: Response) => {
  try {
    const body = ImportBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body", details: body.error.flatten() });
      return;
    }

    if (body.data.rows.length === 0) {
      res.status(400).json({ error: "No rows to process" });
      return;
    }

    const result = await getExtractor().extract(body.data.headers, body.data.rows);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI extraction failed";
    res.status(500).json({ error: message });
  }
});

// Full pipeline: upload CSV + AI extract in one call
importRouter.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No CSV file uploaded" });
      return;
    }

    const parsed = parseCsvBuffer(req.file.buffer);

    if (parsed.rows.length === 0) {
      res.status(400).json({ error: "CSV file contains no data rows" });
      return;
    }

    const result = await getExtractor().extract(parsed.headers, parsed.rows);
    res.json({
      fileName: req.file.originalname,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    res.status(500).json({ error: message });
  }
});

// Parse raw CSV text
importRouter.post("/parse-text", (req: Request, res: Response) => {
  try {
    const { csvText } = req.body as { csvText?: string };
    if (!csvText || typeof csvText !== "string") {
      res.status(400).json({ error: "csvText is required" });
      return;
    }

    const parsed = parseCsvText(csvText);
    res.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse CSV";
    res.status(400).json({ error: message });
  }
});
