import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError, attendanceReport, getClass, listSubjects } from "@/lib/data";
import { isValidISODate, todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/session";

function shiftDays(iso: string, n: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ from?: string; to?: string; subject?: string }>;
}) {
  const user = await requireUser();
  const { classId } = await params;
  const sp = await searchParams;
  const to = sp.to && isValidISODate(sp.to) ? sp.to : todayISO();
  const from = sp.from && isValidISODate(sp.from) ? sp.from : to.slice(0, 8) + "01";

  try {
    const cls = await getClass(user, classId);
    const subjects = await listSubjects(user, classId);
    const subjectId = sp.subject === undefined || sp.subject === "all" ? undefined : subjects.some((s) => s.id === sp.subject) ? sp.subject : "";
    const rows = await attendanceReport(user, classId, from, to, subjectId);
    const sessions = rows[0]?.sessionCount ?? 0;

    return (
      <div>
        <Link href="/dashboard" className="text-sm font-medium text-indigo-600">← Classes</Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{cls.name} — attendance</h1>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href={`/reports/${classId}?from=${todayISO()}&to=${todayISO()}`} className="rounded-lg bg-slate-100 px-3 py-2 font-medium">Today</Link>
          <Link href={`/reports/${classId}?from=${shiftDays(todayISO(), -6)}&to=${todayISO()}`} className="rounded-lg bg-slate-100 px-3 py-2 font-medium">Last 7 days</Link>
          <Link href={`/reports/${classId}?from=${todayISO().slice(0, 8)}01&to=${todayISO()}`} className="rounded-lg bg-slate-100 px-3 py-2 font-medium">This month</Link>
          <a href={`/reports/${classId}/csv?from=${from}&to=${to}&subject=${subjectId ?? "all"}`} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white">Download CSV</a>
        </div>

        <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-slate-600">From</span>
            <input type="date" name="from" defaultValue={from} className="h-10 rounded-lg border border-slate-300 px-2" />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600">To</span>
            <input type="date" name="to" defaultValue={to} className="h-10 rounded-lg border border-slate-300 px-2" />
          <select name="subject" defaultValue={subjectId ?? "all"} className="h-10 rounded-lg border border-slate-300 px-2" aria-label="Subject filter">
            <option value="all">All sessions</option>
            <option value="">Whole class only</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          </label>
          <button type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white">Show</button>
        </form>

        <p className="mt-4 text-sm text-slate-600">{sessions} class day(s) recorded in this period. Present % counts Present and Late.</p>

        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Present days</th>
                <th className="px-4 py-3">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{r.rollNumber}</td>
                  <td className="px-4 py-3 font-medium">{r.fullName}</td>
                  <td className="px-4 py-3">
                    {r.attended} / {r.eligible}
                    {r.excused > 0 && <span className="text-slate-500"> ({r.excused} excused)</span>}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${r.percent === null ? "text-slate-500" : r.percent < 75 ? "text-rose-700" : "text-emerald-700"}`}>
                    {r.percent === null ? "—" : `${r.percent}%`}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No students yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
}
