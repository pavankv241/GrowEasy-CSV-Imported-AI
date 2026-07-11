import { describe, expect, it } from "vitest";
import { ruleBasedExtract } from "./ruleBasedExtractor.js";

describe("ruleBasedExtract", () => {
  it("maps messy CSV columns to CRM fields", () => {
    const headers = [
      "Lead Created",
      "First Name",
      "Last Name",
      "Work Email",
      "Mobile",
      "Company",
      "City",
      "State",
      "Country",
      "Owner",
      "Status",
      "Comments",
      "Source",
    ];

    const rows = [
      {
        rowIndex: 1,
        data: {
          "Lead Created": "2026-05-13 14:20:48",
          "First Name": "John",
          "Last Name": "Doe",
          "Work Email": "john.doe@example.com",
          Mobile: "9876543210",
          Company: "GrowEasy",
          City: "Mumbai",
          State: "Maharashtra",
          Country: "India",
          Owner: "test@gmail.com",
          Status: "Interested",
          Comments: "Client wants demo",
          Source: "leads_on_demand",
        },
      },
      {
        rowIndex: 2,
        data: {
          "Lead Created": "2026-05-14 09:00:00",
          "First Name": "",
          "Last Name": "",
          "Work Email": "",
          Mobile: "",
          Company: "No Contact Co",
          City: "Chennai",
          State: "Tamil Nadu",
          Country: "India",
          Owner: "",
          Status: "",
          Comments: "No contact",
          Source: "",
        },
      },
    ];

    const result = ruleBasedExtract(headers, rows);

    expect(result.totalImported).toBe(1);
    expect(result.totalSkipped).toBe(1);
    expect(result.imported[0].name).toBe("John Doe");
    expect(result.imported[0].email).toBe("john.doe@example.com");
    expect(result.imported[0].crm_status).toBe("GOOD_LEAD_FOLLOW_UP");
    expect(result.imported[0].data_source).toBe("leads_on_demand");
  });
});
