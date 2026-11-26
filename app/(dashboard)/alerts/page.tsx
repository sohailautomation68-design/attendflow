import { AlertActions } from "@/components/AlertActions";
import { evaluateClassAlerts, listAlerts, listClasses, listTeachers } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/session";

const RULE_LABEL: Record<string, string> = {
  CONSECUTIVE_ABSENCES: "Consecutive absences",
  LOW_ATTENDANCE: "Low attendance",
  ABSENCES_IN_30_DAYS: "Frequent absences",
};

export default async function AlertsPage() {
  const user = await requireUser();
  const today = todayISO();

  // Check every visible class; the dedup rule means refreshing never creates duplicates.
  for (const c of await listClasses(user)) {
    await evaluateClassAlerts(user, c.id, today).catch(() => undefined);
  }

  const [alerts, teachers] = await Promise.all([listAlerts(user, "ACTIVE"), listTeachers(user)]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Absence alerts</h1>
      <p className="mt-1 text-sm text-slate-600">Students who need follow-up. Alerts are raised automatically from attendance and stay open until someone resolves them.</p>

      {alerts.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white p-6 text-center text-slate-600 shadow-sm ring-1 ring-slate-200">No open alerts. Good work.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-slate-900">{a.student.fullName} <span className="font-normal text-slate-500">· Roll {a.student.rollNumber} · {a.className}</span></p>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">{RULE_LABEL[a.rule] ?? a.rule}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{a.detail}</p>
              <p className="text-xs text-slate-500">Raised {a.raisedAt.toISOString().slice(0, 10)}</p>
              <AlertActions
                alertId={a.id}
                tasks={a.tasks}
                teachers={teachers.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }))}
                isAdmin={user.role === "ADMIN"}
                currentUserId={user.id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
