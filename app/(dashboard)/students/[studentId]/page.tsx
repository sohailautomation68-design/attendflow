import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalAccountForm } from "@/components/PortalForms";
import { AccessError, studentProfile } from "@/lib/data";
import { requireUser } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", LEAVE: "Excused" };

export default async function StudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const user = await requireUser();
  const { studentId } = await params;

  try {
    const { student, enrollments, records, stats, alerts } = await studentProfile(user, studentId);
    return (
      <div className="space-y-6">
        <div>
          <Link href={`/classes/${student.classId}`} className="text-sm font-medium text-indigo-600">← Class</Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{student.fullName}</h1>
          <p className="text-sm text-slate-600">Roll {student.rollNumber}{student.guardianPhone ? ` · Guardian ${student.guardianPhone}` : ""}</p>
        </div>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Attendance", v: stats.percent === null ? "—" : `${stats.percent}%` },
            { k: "Attended", v: String(stats.attended) },
            { k: "Absent", v: String(stats.absent) },
            { k: "Excused", v: String(stats.excused) },
          ].map((c) => (
            <div key={c.k} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs text-slate-500">{c.k}</p>
              <p className="text-2xl font-bold text-slate-900">{c.v}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 font-semibold text-slate-900">Alerts</h2>
          {alerts.length === 0 ? <p className="text-sm text-slate-500">No alerts.</p> : (
            <ul className="space-y-1 text-sm">
              {alerts.map((a) => (
                <li key={a.id}>{a.raisedAt.toISOString().slice(0, 10)} · {a.detail} · <span className="text-slate-600">{a.status === "ACTIVE" ? "open" : "resolved"}</span></li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 font-semibold text-slate-900">Class history</h2>
          <ul className="space-y-1 text-sm">
            {enrollments.map((e) => (
              <li key={e.id}>From {e.startDate} {e.endDate ? `to ${e.endDate}` : "(current)"}</li>
            ))}
          </ul>
        </section>

        {user.role === "ADMIN" && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-1 font-semibold text-slate-900">Student or guardian login</h2>
            <p className="mb-3 text-sm text-slate-600">Students see their own attendance. Guardians see this student only, and only after consent is recorded.</p>
            <PortalAccountForm studentId={student.id} />
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 font-semibold text-slate-900">Recent records</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {records.map((r) => (
              <li key={r.id} className="flex justify-between py-2">
                <span>{r.session.date}{r.session.subjectId ? " · subject" : ""}</span>
                <span className="font-medium">{STATUS_LABEL[r.status] ?? r.status}</span>
              </li>
            ))}
            {records.length === 0 && <li className="py-2 text-slate-500">No records yet.</li>}
          </ul>
        </section>
      </div>
    );
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
}
