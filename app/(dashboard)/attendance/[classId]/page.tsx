import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceSheet } from "@/components/AttendanceSheet";
import { AccessError, getAttendanceSheet, getClass, listSubjects } from "@/lib/data";
import { isValidISODate, todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ date?: string; subject?: string }>;
}) {
  const user = await requireUser();
  const { classId } = await params;
  const sp = await searchParams;
  const date = sp.date && isValidISODate(sp.date) ? sp.date : todayISO();

  try {
    const cls = await getClass(user, classId);
    const subjects = await listSubjects(user, classId);
    // An empty subject means "whole class". Unknown subject ids fall back to whole class.
    const subjectId = subjects.some((s) => s.id === sp.subject) ? (sp.subject as string) : "";
    const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "Whole class";
    const { students } = await getAttendanceSheet(user, classId, date, subjectId);

    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link href="/dashboard" className="text-sm font-medium text-indigo-600">
            ← Classes
          </Link>
          <form method="get" className="flex flex-wrap items-center gap-2">
            {subjects.length > 0 && (
              <select name="subject" defaultValue={subjectId} className="h-10 rounded-lg border border-slate-300 px-2 text-sm" aria-label="Subject">
                <option value="">Whole class</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            {/* Changing the date reloads the sheet for that day. Teachers can backfill past days. */}
            <input
              type="date"
              name="date"
              defaultValue={date}
              max={todayISO()}
              className="h-10 rounded-lg border border-slate-300 px-2 text-sm"
              aria-label="Attendance date"
            />
            <button type="submit" className="h-10 rounded-lg bg-slate-100 px-3 text-sm font-medium">
              Go
            </button>
          </form>
        </div>
        <AttendanceSheet
          classId={classId}
          className={`${cls.name} · ${subjectName}`}
          date={date}
          subjectId={subjectId}
          students={students}
        />
      </div>
    );
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
}
