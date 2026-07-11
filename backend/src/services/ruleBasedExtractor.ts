import {
  CRM_STATUSES,
  DATA_SOURCES,
  type CrmRecord,
  type CrmStatus,
  type CsvRow,
  type DataSource,
  type ImportResult,
  type SkippedRecord,
} from "../types/crm.js";

type FieldKey = keyof CrmRecord;

const FIELD_PATTERNS: Record<FieldKey, RegExp[]> = {
  created_at: [/created/i, /^date$/i, /lead.?created/i, /timestamp/i],
  name: [/^name$/i, /full.?name/i, /lead.?name/i, /contact.?name/i],
  email: [/email/i, /e-?mail/i, /work.?email/i],
  country_code: [/country.?code/i, /dial/i],
  mobile_without_country_code: [/mobile/i, /phone/i, /contact/i, /tel/i, /cell/i],
  company: [/company/i, /organization/i, /org/i, /business/i, /firm/i],
  city: [/^city$/i, /town/i],
  state: [/state/i, /region/i, /province/i],
  country: [/^country$/i, /nation/i],
  lead_owner: [/owner/i, /assigned/i, /rep/i, /agent/i],
  crm_status: [/status/i, /lead.?status/i, /stage/i],
  crm_note: [/note/i, /comment/i, /remark/i, /follow/i],
  data_source: [/source/i, /campaign/i, /channel/i, /utm/i],
  possession_time: [/possession/i, /property.?ready/i, /ready/i],
  description: [/description/i, /^desc$/i, /details/i],
};

const STATUS_MAP: [RegExp, CrmStatus][] = [
  [/sale.?done|closed.?won|won|converted/i, "SALE_DONE"],
  [/bad.?lead|not.?interested|rejected|lost/i, "BAD_LEAD"],
  [/did.?not.?connect|no.?answer|unreachable|busy|not.?reachable/i, "DID_NOT_CONNECT"],
  [/good.?lead|follow.?up|interested|warm|hot/i, "GOOD_LEAD_FOLLOW_UP"],
];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function findColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const header of headers) {
    const h = normalizeHeader(header);
    if (patterns.some((p) => p.test(h))) return header;
  }
  return null;
}

function buildColumnMap(headers: string[]): Partial<Record<FieldKey, string>> {
  const map: Partial<Record<FieldKey, string>> = {};
  for (const field of Object.keys(FIELD_PATTERNS) as FieldKey[]) {
    const col = findColumn(headers, FIELD_PATTERNS[field]);
    if (col) map[field] = col;
  }

  const firstName = findColumn(headers, [/first.?name/i]);
  const lastName = findColumn(headers, [/last.?name/i]);
  if (!map.name && firstName) {
    map.name = firstName;
    if (lastName) map.name = `${firstName}::${lastName}`;
  }

  return map;
}

function getValue(data: Record<string, string>, col: string | undefined): string {
  if (!col) return "";
  if (col.includes("::")) {
    const [first, last] = col.split("::");
    return [data[first] ?? "", data[last] ?? ""].filter(Boolean).join(" ").trim();
  }
  return (data[col] ?? "").trim();
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return matches ?? [];
}

function parsePhone(raw: string): { country_code: string; mobile: string; extra: string } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { country_code: "", mobile: "", extra: "" };

  if (raw.includes("+91") || (digits.length === 12 && digits.startsWith("91"))) {
    const mobile = digits.length === 12 ? digits.slice(2) : digits.slice(-10);
    return { country_code: "+91", mobile, extra: "" };
  }

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return { country_code: "+91", mobile: digits, extra: "" };
  }

  if (digits.length > 10) {
    return { country_code: "+91", mobile: digits.slice(-10), extra: "" };
  }

  return { country_code: "", mobile: digits, extra: "" };
}

function mapStatus(value: string): CrmStatus | "" {
  const v = value.trim();
  if (!v) return "";
  if (CRM_STATUSES.includes(v as CrmStatus)) return v as CrmStatus;
  for (const [pattern, status] of STATUS_MAP) {
    if (pattern.test(v)) return status;
  }
  return "";
}

function mapDataSource(value: string): DataSource | "" {
  const v = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!v) return "";
  const match = DATA_SOURCES.find((s) => v.includes(s) || s.includes(v));
  return match ?? "";
}

function parseLocation(value: string): { city: string; state: string; country: string } {
  const parts = value.split(/[,|]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { city: parts[0], state: parts[1], country: parts[2] };
  }
  if (parts.length === 2) {
    return { city: parts[0], state: parts[1], country: "" };
  }
  return { city: value.trim(), state: "", country: "" };
}

function emptyRecord(): CrmRecord {
  return {
    created_at: "",
    name: "",
    email: "",
    country_code: "",
    mobile_without_country_code: "",
    company: "",
    city: "",
    state: "",
    country: "",
    lead_owner: "",
    crm_status: "",
    crm_note: "",
    data_source: "",
    possession_time: "",
    description: "",
  };
}

function hasContactInfo(record: CrmRecord): boolean {
  const email = record.email.trim();
  const mobile = record.mobile_without_country_code.replace(/\D/g, "");
  return email.length > 0 || mobile.length >= 6;
}

function extractRow(
  row: CsvRow,
  columnMap: Partial<Record<FieldKey, string>>,
  headers: string[]
): { record: CrmRecord; skip: boolean; skipReason?: string } {
  const record = emptyRecord();
  const notes: string[] = [];
  const usedCols = new Set<string>();

  for (const [field, col] of Object.entries(columnMap) as [FieldKey, string][]) {
    if (col.includes("::")) {
      col.split("::").forEach((c) => usedCols.add(c));
    } else {
      usedCols.add(col);
    }

    const value = getValue(row.data, col);

    switch (field) {
      case "email": {
        const emails = extractEmails(value);
        record.email = emails[0] ?? "";
        if (emails.length > 1) notes.push(`Extra emails: ${emails.slice(1).join(", ")}`);
        break;
      }
      case "mobile_without_country_code": {
        const parsed = parsePhone(value);
        record.country_code = parsed.country_code;
        record.mobile_without_country_code = parsed.mobile;
        break;
      }
      case "crm_status":
        record.crm_status = mapStatus(value);
        break;
      case "data_source":
        record.data_source = mapDataSource(value);
        break;
      default:
        record[field] = value;
    }
  }

  const locationCol = findColumn(headers, [/location/i]);
  if (locationCol && !record.city) {
    const loc = parseLocation(row.data[locationCol] ?? "");
    record.city = loc.city;
    record.state = loc.state;
    record.country = loc.country;
    usedCols.add(locationCol);
  }

  if (!record.country_code && record.mobile_without_country_code) {
    record.country_code = "+91";
  }

  for (const header of headers) {
    if (usedCols.has(header)) continue;
    const val = (row.data[header] ?? "").trim();
    if (val) notes.push(`${header}: ${val}`);
  }

  if (notes.length > 0) {
    record.crm_note = [record.crm_note, ...notes].filter(Boolean).join(" | ");
  }

  const skip = !hasContactInfo(record);
  return {
    record,
    skip,
    skipReason: skip ? "Record has neither email nor mobile number" : undefined,
  };
}

export function ruleBasedExtract(headers: string[], rows: CsvRow[]): ImportResult {
  const columnMap = buildColumnMap(headers);
  const imported: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  for (const row of rows) {
    const { record, skip, skipReason } = extractRow(row, columnMap, headers);
    if (skip) {
      skipped.push({ rowIndex: row.rowIndex, originalData: row.data, reason: skipReason! });
    } else {
      imported.push(record);
    }
  }

  return {
    imported,
    skipped,
    totalImported: imported.length,
    totalSkipped: skipped.length,
    totalProcessed: rows.length,
    extractionMethod: "rule-based",
  };
}
