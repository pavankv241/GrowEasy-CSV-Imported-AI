import { describe, expect, it } from "vitest";
import {
  enrichAndNormalizeRecord,
  extractEmails,
  extractPhones,
  isValidCreatedAt,
  normalizeCreatedAt,
} from "./recordNormalizer.js";

describe("normalizeCreatedAt", () => {
  it("formats ISO-like dates for new Date()", () => {
    const result = normalizeCreatedAt("2026-05-13 14:20:48");
    expect(isValidCreatedAt(result)).toBe(true);
    expect(result).toMatch(/^2026-05-13 14:20:48$/);
  });

  it("parses DD/MM/YYYY dates", () => {
    const result = normalizeCreatedAt("13/05/2026 14:20:48");
    expect(isValidCreatedAt(result)).toBe(true);
    expect(result.startsWith("2026-05-13")).toBe(true);
  });

  it("falls back to original row date columns", () => {
    const result = normalizeCreatedAt("", ["2026-05-14 10:00:00"]);
    expect(result).toBe("2026-05-14 10:00:00");
  });
});

describe("extractEmails", () => {
  it("finds multiple emails and uses first as primary", () => {
    const emails = extractEmails(
      "john@example.com, jane@example.com",
      "backup@test.com"
    );
    expect(emails).toEqual(["john@example.com", "jane@example.com", "backup@test.com"]);
  });
});

describe("extractPhones", () => {
  it("finds multiple phone numbers", () => {
    const phones = extractPhones("+91 9876543210, 9876543211");
    expect(phones).toContain("9876543210");
    expect(phones).toContain("9876543211");
  });
});

describe("enrichAndNormalizeRecord", () => {
  it("puts extra emails and mobiles into crm_note", () => {
    const result = enrichAndNormalizeRecord(
      {
        created_at: "2026-05-13 14:20:48",
        name: "John Doe",
        email: "john@example.com, jane@example.com",
        country_code: "+91",
        mobile_without_country_code: "9876543210",
        company: "GrowEasy",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        lead_owner: "test@gmail.com",
        crm_status: "GOOD_LEAD_FOLLOW_UP",
        crm_note: "Also reachable at 9876543299",
        data_source: "leads_on_demand",
        possession_time: "",
        description: "",
      },
      {
        Comments: "Client wants demo next week",
        Mobile: "9876543210, 9876543299",
      }
    );

    expect(result.email).toBe("john@example.com");
    expect(result.mobile_without_country_code).toBe("9876543210");
    expect(result.crm_note).toContain("Extra emails: jane@example.com");
    expect(result.crm_note).toContain("Extra mobiles:");
    expect(result.crm_note).not.toContain("test@gmail.com");
    expect(isValidCreatedAt(result.created_at)).toBe(true);
  });

  it("does not duplicate mapped CSV columns into crm_note", () => {
    const result = enrichAndNormalizeRecord(
      {
        created_at: "2026-05-13 14:20:48",
        name: "John Doe",
        email: "john.doe@example.com",
        country_code: "+91",
        mobile_without_country_code: "9876543210",
        company: "GrowEasy",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        lead_owner: "test@gmail.com",
        crm_status: "GOOD_LEAD_FOLLOW_UP",
        crm_note: "Client wants demo next week",
        data_source: "leads_on_demand",
        possession_time: "",
        description: "",
      },
      {
        "First Name": "John",
        "Last Name": "Doe",
        Status: "Interested",
        Owner: "test@gmail.com",
        Comments: "Client wants demo next week",
      }
    );

    expect(result.crm_note).toBe("Client wants demo next week");
    expect(result.crm_note).not.toContain("First Name");
    expect(result.crm_note).not.toContain("Extra emails: test@gmail.com");
  });
});
