import { NextResponse } from "next/server";
import { AccessError, attendanceReport, getClass } from "@/lib/data";
import { isValidISODate, todayISO } from "@/lib/dates";
import { toCsv } from "@/lib/csv-export";
import { requireUser } from "@/lib/session";

/** Downloads the attendance report for one class as CSV (same numbers as the on-screen report). */
export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const user = await requireUser();
  const { classId } = await params;
  const url = new URL(request.url);
  const to = url.searchParams.get("to");
  const from = url.searchParams.get("from");
  const toDate = to && isValidISODate(to) ? to : todayISO();
  const fromDate = from && isValidISODate(from) ? from : `${toDate.slice(0, 8)}01`;

  try {
    const cls = await getClass(user, classId);
    const subjectParam = url.searchParams.get("subject");
    const subjectId = subjectParam === null || subjectParam === "all" ? undefined : subjectParam;
    const rows = await attendanceReport(user, classId, fromDate, toDate, subjectId);
    const csv = toCsv(
      ["Roll", "Student", "Attended", "Eligible sessions", "Absent", "Excused", "Attendance %"],
      rows.map((r) => [r.rollNumber, r.fullName, r.attended, r.eligible, r.absent, r.excused, r.percent]),
    );
    const safeName = cls.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${safeName}-${fromDate}-to-${toDate}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AccessError) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}
