# GrowEasy CSV Importer — Frontend

Next.js web app for the GrowEasy AI-powered CSV importer assignment.

## Setup

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to your backend URL (default `http://localhost:4000`).

## User flow

1. **Upload** — drag & drop or file picker
2. **Preview** — client-side CSV parse (no AI yet)
3. **Confirm Import** — calls `POST /api/extract`
4. **Results** — imported + skipped tables with counts

## Edge cases handled (frontend)

| Edge case | Implementation |
| --------- | -------------- |
| Non-CSV file | `FileUpload.tsx` — rejects non-`.csv` files |
| File over 10MB | Size check before parse |
| Empty CSV | `page.tsx` — "CSV file contains no data rows" |
| Malformed CSV | PapaParse critical errors shown in error banner |
| Parse in progress | Upload disabled + "Parsing CSV..." state |
| API / AI failure | Error banner; user returned to preview step |
| Large tables | `DataTable.tsx` — `@tanstack/react-virtual` virtualization |
| Sticky headers + scroll | Horizontal and vertical scroll with fixed column widths |
| Truncated cell text | Wider columns for `crm_note`, `crm_status`, etc. + hover tooltip |
| Dark mode | `ThemeProvider.tsx` — persisted preference |

## Key files

```
src/
├── app/page.tsx              # 4-step import flow
├── components/
│   ├── FileUpload.tsx        # Drag & drop upload
│   ├── DataTable.tsx         # Virtualized preview/results table
│   ├── ResultsSummary.tsx    # Imported / skipped counts
│   └── ImportProgress.tsx    # AI processing state
└── lib/
    ├── csv.ts                # Client-side PapaParse
    └── api.ts                # Backend API client
```

## Deploy (Vercel)

- Root directory: `frontend`
- Env: `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`
