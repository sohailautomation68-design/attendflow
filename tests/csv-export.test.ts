import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv-export";

describe("CSV export", () => {
  it("quotes commas and quotes, and neutralises formula injection", () => {
    const out = toCsv(["Name", "Note"], [["Khan, Ali", 'said "hi"'], ["=HYPERLINK(x)", null]]);
    expect(out).toContain('"Khan, Ali","said ""hi"""');
    expect(out).toContain("'=HYPERLINK(x),");
  });
});
