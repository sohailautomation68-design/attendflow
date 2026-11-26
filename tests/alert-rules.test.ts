import { describe, expect, it } from "vitest";
import { evaluateRules } from "@/lib/alert-rules";

const s = (date: string, status: string) => ({ date, status });

describe("absence alert rules", () => {
  it("raises a consecutive-absence alert after 3 absences in a row", () => {
    const r = evaluateRules([s("2026-01-01", "PRESENT"), s("2026-01-02", "ABSENT"), s("2026-01-03", "ABSENT"), s("2026-01-04", "ABSENT")], 75, 4, "2026-01-05");
    expect(r.map((a) => a.rule)).toContain("CONSECUTIVE_ABSENCES");
  });

  it("a present or leave day breaks the streak", () => {
    const r = evaluateRules([s("2026-01-01", "ABSENT"), s("2026-01-02", "LEAVE"), s("2026-01-03", "ABSENT"), s("2026-01-04", "ABSENT")], 50, 3, "2026-01-05");
    expect(r.map((a) => a.rule)).not.toContain("CONSECUTIVE_ABSENCES");
  });

  it("low attendance needs enough sessions and must be under 75%", () => {
    expect(evaluateRules([s("2026-01-01", "ABSENT")], 0, 1, "2026-01-02").map((a) => a.rule)).not.toContain("LOW_ATTENDANCE");
    expect(evaluateRules([s("2026-01-01", "PRESENT"), s("2026-01-02", "PRESENT"), s("2026-01-03", "ABSENT"), s("2026-01-04", "ABSENT")], 50, 4, "2026-01-05").map((a) => a.rule)).toContain("LOW_ATTENDANCE");
  });

  it("5 absences within 30 days triggers the window rule; older absences do not count", () => {
    const recent = ["2026-02-01", "2026-02-03", "2026-02-05", "2026-02-07", "2026-02-09"].map((d) => s(d, "ABSENT"));
    expect(evaluateRules(recent, 0, 5, "2026-02-15").map((a) => a.rule)).toContain("ABSENCES_IN_30_DAYS");
    const old = ["2025-12-01", "2025-12-03", "2025-12-05", "2025-12-07", "2025-12-09"].map((d) => s(d, "ABSENT"));
    expect(evaluateRules(old, 0, 5, "2026-02-15").map((a) => a.rule)).not.toContain("ABSENCES_IN_30_DAYS");
  });
});
