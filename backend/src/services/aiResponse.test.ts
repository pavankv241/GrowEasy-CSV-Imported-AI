import { describe, expect, it } from "vitest";

// Test the flat-response normalization via a minimal inline version
function extractCrmFields(item: Record<string, unknown>): Record<string, string> {
  const keys = [
    "created_at", "name", "email", "country_code", "mobile_without_country_code",
    "company", "city", "state", "country", "lead_owner", "crm_status", "crm_note",
    "data_source", "possession_time", "description",
  ];
  const fields: Record<string, string> = {};
  for (const key of keys) {
    fields[key] = item[key] == null ? "" : String(item[key]).trim();
  }
  return fields;
}

function normalizeFlatResponse(parsed: unknown): { records: unknown[] } {
  const root = parsed as { records: Record<string, unknown>[] };
  return {
    records: root.records.map((item, index) => ({
      rowIndex: Number(item.rowIndex ?? index + 1),
      record: item.record && typeof item.record === "object"
        ? extractCrmFields(item.record as Record<string, unknown>)
        : extractCrmFields(item),
      skip: Boolean(item.skip),
    })),
  };
}

describe("AI response normalization", () => {
  it("handles flat Groq-style response without nested record", () => {
    const groqResponse = {
      records: [
        {
          rowIndex: 1,
          name: "John Doe",
          email: "john@example.com",
          mobile_without_country_code: "9876543210",
          crm_status: "GOOD_LEAD_FOLLOW_UP",
        },
      ],
    };

    const normalized = normalizeFlatResponse(groqResponse);
    expect(normalized.records[0]).toMatchObject({
      rowIndex: 1,
      record: {
        name: "John Doe",
        email: "john@example.com",
        mobile_without_country_code: "9876543210",
        crm_status: "GOOD_LEAD_FOLLOW_UP",
      },
    });
  });
});
