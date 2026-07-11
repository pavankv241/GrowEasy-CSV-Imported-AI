# GrowEasy CSV Importer — Backend

Express API for CSV parsing and AI-powered CRM field extraction.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Environment variables

```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk-your-key-here
GROQ_MODEL=llama-3.3-70b-versatile
BATCH_SIZE=50
CORS_ORIGIN=http://localhost:3000
PORT=4000
```

## API endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | Health check |
| POST | `/api/parse` | Upload CSV → parsed rows (no AI) |
| POST | `/api/extract` | AI extract from JSON `{ headers, rows }` |
| POST | `/api/upload` | Upload CSV → parse → AI extract |

## Edge cases handled (backend)

### CSV parsing (`utils/csvParser.ts`)

| Edge case | Handling |
| --------- | -------- |
| Non-CSV upload | Multer file filter |
| File over 10MB | Multer size limit |
| Empty data rows | 400 error before AI |
| Malformed quotes | PapaParse critical error thrown |
| Varying column names | Dynamic headers passed to AI |
| Empty cells | Trimmed to `""` |

### AI extraction (`services/aiExtractor.ts`)

| Edge case | Handling |
| --------- | -------- |
| Messy CSV layouts | AI prompt maps columns intelligently |
| Groq flat JSON response | `normalizeAiResponse()` wraps into `{ record: {...} }` |
| Markdown JSON fences | Stripped before `JSON.parse` |
| Missing rowIndex in AI output | Batch validation error |
| Invalid request body | Zod validation on `/api/extract` |
| API rate limit (429) | Single retry with backoff |
| Skip: no email AND no mobile | `hasContactInfo()` + skipped records list |

### Post-processing (`utils/recordNormalizer.ts`)

| Rule | Handling |
| ---- | -------- |
| `created_at` → `new Date()` compatible | `normalizeCreatedAt()` — ISO + DD/MM/YYYY |
| Multiple emails | First → `email`, extras → `crm_note` |
| Multiple mobiles | First → `mobile`, extras → `crm_note` |
| `lead_owner` email | Excluded from extra emails |
| Mapped CSV columns | Not duplicated into `crm_note` |
| Invalid `crm_status` / `data_source` | Coerced to `""` (Zod + enum check) |
| Odd phone formats from AI | `normalizePhoneFields()` cleanup |

## Tests

```bash
npm test
```

Covers CSV parsing, AI response normalization, and record post-processing.

## Deploy (Render / Railway)

- Root directory: `backend`
- Build: `npm install && npm run build`
- Start: `npm start`
- Set all env vars from `.env.example`
