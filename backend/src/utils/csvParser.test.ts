import { describe, expect, it } from "vitest";
import { parseCsvText } from "./csvParser.js";

describe("parseCsvText", () => {
  it("parses headers and rows", () => {
    const csv = `name,email,phone
John Doe,john@example.com,9876543210
Jane Smith,jane@example.com,9876543211`;

    const result = parseCsvText(csv);
    expect(result.headers).toEqual(["name", "email", "phone"]);
    expect(result.totalRows).toBe(2);
    expect(result.rows[0].data.name).toBe("John Doe");
    expect(result.rows[1].rowIndex).toBe(2);
  });

  it("trims header names", () => {
    const csv = ` name , email \nA,a@b.com`;
    const result = parseCsvText(csv);
    expect(result.headers).toEqual(["name", "email"]);
  });
});
