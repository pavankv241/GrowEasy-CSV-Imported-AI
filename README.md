# GrowEasy AI-Powered CSV Importer

An intelligent CSV importer that maps arbitrary spreadsheet formats to GrowEasy CRM lead fields using AI.

## Features

- **Drag & drop** or file picker CSV upload
- **Client-side preview** — parse and review data before any AI processing
- **Confirm-to-import** flow — AI runs only after user confirmation
- **AI field mapping** — handles Facebook leads, Google Ads, Excel exports, CRM dumps, and custom spreadsheets
- **Batch processing** with retry on API rate limits
- **Virtualized tables** for smooth scrolling on large files
- **Dark mode** toggle
- **Skipped record tracking** — rows without email or mobile are reported with reasons

## Tech Stack

| Layer    | Technology              |
| -------- | ----------------------- |
| Frontend | Next.js 16, Tailwind CSS |
| Backend  | Node.js, Express        |
| AI       | Groq or Google Gemini (free tier) |
| CSV      | PapaParse               |

## Project Structure

```
GrowEasy/
├── backend/          # Express API — CSV parse + AI extraction
├── frontend/         # Next.js web app
├── sample-data/      # Test CSV files
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Node.js 20+
- npm
- **Groq API key** (recommended) — free at [console.groq.com](https://console.groq.com), or
- Google Gemini API key — free at [Google AI Studio](https://aistudio.google.com/apikey)

## Local Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd GrowEasy
npm run install:all
```

### 2. Configure environment

**Backend** — copy and edit `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

```env
PORT=4000
AI_PROVIDER=groq
GROQ_API_KEY=gsk-your-key-here
GROQ_MODEL=llama-3.3-70b-versatile
BATCH_SIZE=50
CORS_ORIGIN=http://localhost:3000
```

Or for Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key-here
GEMINI_MODEL=gemini-2.0-flash-lite
```

**Frontend** — copy and edit `frontend/.env.local`:

```bash
cp frontend/.env.local.example frontend/.env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Run locally

```bash
# From project root — starts both servers
npm install
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

Or run separately:

```bash
npm run dev:backend   # port 4000
npm run dev:frontend  # port 3000
```

## API Endpoints

| Method | Endpoint        | Description                          |
| ------ | --------------- | ------------------------------------ |
| GET    | `/health`       | Health check                         |
| POST   | `/api/parse`    | Upload CSV, return parsed preview    |
| POST   | `/api/extract`  | AI-extract CRM records from JSON rows |
| POST   | `/api/upload`   | Upload CSV + full AI pipeline        |

### Extract request body

```json
{
  "headers": ["Full Name", "Email", "Phone"],
  "rows": [
    { "rowIndex": 1, "data": { "Full Name": "John", "Email": "john@example.com", "Phone": "9876543210" } }
  ]
}
```

## CRM Output Fields

`created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`

### Allowed values

- **crm_status:** `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE`
- **data_source:** `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots`

Records without email **and** mobile are skipped.

## Edge Case Handling

Edge cases are handled at three layers: upload validation, AI extraction, and post-processing normalization.

### Upload & CSV parsing

| Edge case | Handling |
| --------- | -------- |
| Non-CSV file | Rejected on frontend and backend |
| File over 10MB | Rejected with clear error message |
| Empty CSV (no data rows) | Blocked before AI runs |
| Malformed quotes / fields | PapaParse critical errors shown to user |
| Messy / varying column names | Headers trimmed; AI maps columns dynamically |
| Empty cells | Normalized to empty string `""` |

### AI extraction & validation

| Edge case | Handling |
| --------- | -------- |
| Different CSV layouts (Facebook, Google Ads, Excel exports) | No fixed schema — AI infers field mapping |
| AI returns flat JSON (Groq/Llama) | Response normalizer wraps into nested `record` shape |
| AI wraps JSON in markdown fences | Fences stripped before parsing |
| Missing row in AI response | Batch validation fails with clear error |
| Invalid `crm_status` or `data_source` | Coerced to `""` if not in allowed enum |
| Row with no email and no mobile | Skipped with reason in skipped records table |
| Email-only row (no phone) | Imported successfully |
| API rate limit (429) | Single retry with backoff delay |

### Post-processing (code-enforced rules)

| Rule | Handling |
| ---- | -------- |
| `created_at` parseable by `new Date()` | Normalized via `normalizeCreatedAt()` (ISO + DD/MM/YYYY) |
| Multiple emails in one field | First → `email`, extras → `crm_note` |
| Multiple mobile numbers | First → `mobile`, extras → `crm_note` |
| `lead_owner` email | Not duplicated as an extra email |
| Mapped columns (First Name, Status, etc.) | Not duplicated into `crm_note` |
| Odd phone formats from AI | `normalizePhoneFields()` fixes common mistakes |
| Allowed status / data source values | Validated with Zod and normalized |

### Frontend UX edge cases

| Edge case | Handling |
| --------- | -------- |
| CSV parse failure | Error banner, user stays on upload step |
| Backend / AI failure | Error banner, user returns to preview |
| Large result sets | Virtualized table with horizontal and vertical scroll |
| Truncated long values | Wider columns for key fields + hover tooltip |

### Sample test cases

Use `test-import.csv` in the project root to verify:

- **5 imported** — varied column names mapped to CRM fields
- **1 skipped** — row with no email and no phone
- **Mixed statuses** — Interested → `GOOD_LEAD_FOLLOW_UP`, Closed Won → `SALE_DONE`, etc.

## Testing

```bash
# Backend unit tests
npm run test --prefix backend

# Try sample CSVs
# Upload sample-data/facebook-leads.csv or sample-data/groweasy-format.csv
```

## Docker

```bash
# Set GEMINI_API_KEY in backend/.env first
docker compose up --build
```

## Deployment

### Frontend (Vercel)

1. Import the `frontend/` directory
2. Set `NEXT_PUBLIC_API_URL` to your deployed backend URL
3. Deploy

### Backend (Railway / Render)

1. Deploy `backend/` directory
2. Set environment variables from `backend/.env.example`
3. Update `CORS_ORIGIN` to your frontend URL

## Submission Checklist

- [ ] Hosted application URL
- [ ] Public GitHub repository
- [ ] README with setup instructions
- [ ] Position applied for (Intern / Full-Time)
- [ ] Email to varun@groweasy.ai

## License

MIT — built for GrowEasy assignment submission.
