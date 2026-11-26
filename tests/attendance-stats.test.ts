import { describe, expect, it } from "vitest";
import { studentStats, type StatSession } from "@/lib/attendance-stats";

const S = "stu1";
const session = (date: string, status: string | null, extra: Partial<StatSession> = {}): StatSession => ({
  date,
  submitted: true,
  cancelled: false,
  statusByStudent: status ? new Map([[S, status]]) : new Map(),
  ...extra,
});
const enrolled = [{ studentId: S, startDate: "2026-01-01", endDate: null }];

describe("attendance percentage rules", () => {
  it("present and late count as attended; absent counts against", () => {
    const r = studentStats(S, [session("2026-01-05", "PRESENT"), session("2026-01-06", "LATE"), session("2026-01-07", "ABSENT")], enrolled);
    expect(r).toMatchObject({ eligible: 3, attended: 2, absent: 1, percent: 67 });
  });

  it("excused leave is excluded from the denominator", () => {
    const r = studentStats(S, [session("2026-01-05", "PRESENT"), session("2026-01-06", "LEAVE")], enrolled);
    expect(r).toMatchObject({ eligible: 1, excused: 1, percent: 100 });
  });

  it("cancelled days and unsubmitted (open) sessions are ignored", () => {
    const r = studentStats(
      S,
      [session("2026-01-05", "ABSENT", { cancelled: true }), session("2026-01-06", "ABSENT", { submitted: false }), session("2026-01-07", "PRESENT")],
      enrolled,
    );
    expect(r).toMatchObject({ eligible: 1, percent: 100 });
  });

  it("sessions before enrollment start or after enrollment end are excluded", () => {
    const period = [{ studentId: S, startDate: "2026-02-01", endDate: "2026-03-01" }];
    const r = studentStats(
      S,
      [session("2026-01-20", "ABSENT"), session("2026-02-10", "PRESENT"), session("2026-03-01", "ABSENT")],
      period,
    );
    expect(r).toMatchObject({ eligible: 1, attended: 1, percent: 100 });
  });

  it("returns null percent (not 0%) when there is nothing to count", () => {
    expect(studentStats(S, [], enrolled).percent).toBeNull();
  });
});
