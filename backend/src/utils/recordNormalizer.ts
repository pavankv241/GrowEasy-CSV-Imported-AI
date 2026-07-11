import {
  CRM_STATUSES,
  DATA_SOURCES,
  type CrmRecord,
} from "../types/crm.js";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{5,5}[-.\s]?\d{5}|\b[6-9]\d{9}\b/g;

// CSV columns that AI already maps — don't duplicate into crm_note
const MAPPED_COLUMN_PATTERNS = [
  /first.?name/i,
  /last.?name/i,
  /^name$/i,
  /full.?name/i,
  /email/i,
  /mobile/i,
  /phone/i,
  /company/i,
  /city/i,
  /state/i,
  /country/i,
  /owner/i,
  /status/i,
  /lead.?created/i,
  /^date$/i,
  /created/i,
  /source/i,
  /campaign/i,
  /property/i,
  /possession/i,
  /comment/i,
  /note/i,
  /remark/i,
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatCreatedAt(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function normalizeCreatedAt(value: string, fallbacks: string[] = []): string {
  const candidates = [value, ...fallbacks].map((v) => v.trim()).filter(Boolean);

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return formatCreatedAt(parsed);
    }

    const dmy = candidate.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (dmy) {
      const [, day, month, year, hour = "0", minute = "0", second = "0"] = dmy;
      const parsedDmy = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      );
      if (!Number.isNaN(parsedDmy.getTime())) {
        return formatCreatedAt(parsedDmy);
      }
    }
  }

  return "";
}

export function extractEmails(...sources: string[]): string[] {
  const found = new Set<string>();
  for (const source of sources) {
    const matches = source.match(EMAIL_REGEX);
    if (matches) {
      for (const email of matches) found.add(email.toLowerCase());
    }
  }
  return [...found];
}

export function extractPhones(...sources: string[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const matches = source.match(PHONE_REGEX);
    if (!matches) continue;

    for (const raw of matches) {
      const digits = raw.replace(/\D/g, "");
      const normalized =
        digits.length >= 12 && digits.startsWith("91")
          ? digits.slice(2)
          : digits.length > 10
            ? digits.slice(-10)
            : digits;

      if (normalized.length >= 6 && !seen.has(normalized)) {
        seen.add(normalized);
        found.push(normalized);
      }
    }
  }

  return found;
}

function normalizePhoneFields(
  countryCode: string,
  mobile: string
): { country_code: string; mobile_without_country_code: string } {
  let code = countryCode.trim();
  let digits = mobile.replace(/\D/g, "");

  const codeDigits = code.replace(/\D/g, "");
  if (codeDigits.length >= 10 && /[a-zA-Z]/.test(mobile)) {
    digits = codeDigits.slice(-10);
    code = code.startsWith("+") ? `+${codeDigits.slice(0, -10) || "91"}` : "+91";
  } else if (codeDigits.length >= 10 && !digits) {
    digits = codeDigits.slice(-10);
    code = "+91";
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    code = "+91";
    digits = digits.slice(2);
  } else if (digits.length === 10 && /^[6-9]/.test(digits) && !code) {
    code = "+91";
  }

  if (code && !code.startsWith("+") && /^\d+$/.test(code)) {
    code = `+${code}`;
  }

  return { country_code: code, mobile_without_country_code: digits };
}

function appendNote(existing: string, addition: string): string {
  const note = existing.trim();
  const extra = addition.trim();
  if (!extra) return note;
  if (!note) return extra;
  if (note.includes(extra)) return note;
  return `${note} | ${extra}`;
}

function isMappedColumn(column: string): boolean {
  return MAPPED_COLUMN_PATTERNS.some((p) => p.test(column.trim()));
}

function isValueUsedInRecord(value: string, record: CrmRecord): boolean {
  const lower = value.trim().toLowerCase();
  if (!lower) return true;

  for (const field of Object.values(record)) {
    const f = field.trim().toLowerCase();
    if (!f) continue;
    if (f === lower || f.includes(lower) || lower.includes(f)) return true;
  }

  const nameParts = record.name.toLowerCase().split(/\s+/).filter(Boolean);
  if (nameParts.includes(lower)) return true;

  return false;
}

function getExtraEmails(record: CrmRecord): string[] {
  const primary = (record.email.split(",")[0] ?? record.email).trim().toLowerCase();
  const owner = record.lead_owner.trim().toLowerCase();
  const reserved = new Set([primary, owner].filter(Boolean));

  const candidates = extractEmails(record.email, record.crm_note);
  return candidates.filter((email) => !reserved.has(email.toLowerCase()));
}

function getExtraPhones(record: CrmRecord): string[] {
  const primary = record.mobile_without_country_code.replace(/\D/g, "");
  if (!primary) return extractPhones(record.crm_note);

  return extractPhones(record.crm_note).filter((p) => p !== primary);
}

function collectUnmappedNotes(
  record: CrmRecord,
  originalData?: Record<string, string>
): string[] {
  if (!originalData) return [];

  const extras: string[] = [];
  for (const [column, value] of Object.entries(originalData)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (isMappedColumn(column)) continue;
    if (isValueUsedInRecord(trimmed, record)) continue;

    extras.push(`${column}: ${trimmed}`);
  }

  return extras;
}

export function enrichAndNormalizeRecord(
  record: CrmRecord,
  originalData?: Record<string, string>
): CrmRecord {
  const originalValues = originalData ? Object.values(originalData) : [];
  const dateFallbacks = originalValues.filter((v) => /\d{4}|\d{1,2}[\/\-]\d{1,2}/.test(v));

  const emailsInField = extractEmails(record.email);
  const primaryEmail = emailsInField[0] ?? record.email.split(",")[0]?.trim() ?? "";

  const phone = normalizePhoneFields(
    record.country_code,
    record.mobile_without_country_code
  );

  let crm_note = record.crm_note.trim();

  const extraEmails = getExtraEmails(record);
  if (extraEmails.length > 0) {
    crm_note = appendNote(crm_note, `Extra emails: ${extraEmails.join(", ")}`);
  }

  const extraPhones = getExtraPhones(record);
  if (extraPhones.length > 0) {
    crm_note = appendNote(
      crm_note,
      `Extra mobiles: ${extraPhones
        .map((p) => (phone.country_code ? `${phone.country_code} ${p}` : p))
        .join(", ")}`
    );
  }

  for (const extra of collectUnmappedNotes(record, originalData)) {
    crm_note = appendNote(crm_note, extra);
  }

  return {
    created_at: normalizeCreatedAt(record.created_at, dateFallbacks),
    name: record.name.trim(),
    email: primaryEmail,
    country_code: phone.country_code,
    mobile_without_country_code: phone.mobile_without_country_code,
    company: record.company.trim(),
    city: record.city.trim(),
    state: record.state.trim(),
    country: record.country.trim(),
    lead_owner: record.lead_owner.trim(),
    crm_status: CRM_STATUSES.includes(record.crm_status as (typeof CRM_STATUSES)[number])
      ? record.crm_status
      : "",
    crm_note,
    data_source: DATA_SOURCES.includes(record.data_source as (typeof DATA_SOURCES)[number])
      ? record.data_source
      : "",
    possession_time: record.possession_time.trim(),
    description: record.description.trim(),
  };
}

export function isValidCreatedAt(value: string): boolean {
  if (!value.trim()) return true;
  return !Number.isNaN(new Date(value).getTime());
}
