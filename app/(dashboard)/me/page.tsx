import { CorrectionForm } from "@/components/PortalForms";
import { portalStudents } from "@/lib/data";
import { requireUser } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", LEAVE: "Excused" };

export default async function MePage() {
  const user = await requireUser();
  if (user.role !== "STUDENT" && user.role !== "GUARDIAN") {
    return <p className="text-slate-600">This page is for students and guardians.</p>;
  }
  const items = await portalStudents(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{user.role === "GUARDIAN" ? "Your children" : "My attendance"}</h1>
        <p className="text-sm text-slate-600">Read-only. To change a mark, send a correction request; the academy decides.</p>
      </div>

      {items.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-slate-600 shadow-sm ring-1 ring-slate-200">No linked student yet. Ask the academy to set up your login.</p>}

      {items.map(({ student, stats, recent }) => (
        <section key={student.id} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{student.fullName}</h2>
            <p className="text-2xl font-bold text-slate-900">{stats.percent === null ? "—" : `${stats.percent}%`}</p>
          </div>
          <p className="text-sm text-slate-600">Attended {stats.attended} of {stats.eligible} counted days · Absent {stats.absent} · Excused {stats.excused}</p>

          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((r) => (
              <li key={r.date} className="flex justify-between py-2">
                <span>{r.date}</span>
                <span className="font-medium">{STATUS_LABEL[r.status] ?? r.status}</span>
              </li>
            ))}
            {recent.length === 0 && <li className="py-2 text-slate-500">No attendance recorded yet.</li>}
          </ul>

          <details className="rounded-xl bg-slate-50 p-4">
            <summary className="cursor-pointer font-semibold text-slate-800">Request a correction</summary>
            <div className="mt-3">
              <CorrectionForm studentId={student.id} />
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
