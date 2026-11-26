import Link from "next/link";
import { redirect } from "next/navigation";
import { listClasses, listNeedsAttention, todaysSchedule, dailyAttendanceTrend, setupProgress } from "@/lib/data";
import { TrendChart } from "@/components/TrendChart";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "STUDENT" || user.role === "GUARDIAN") redirect("/me");
  if (user.role === "SUPER_ADMIN") redirect("/platform");
  const classes = await listClasses(user);
  const today = todayISO();
  const schedule = await todaysSchedule(user, today);
  const needs = await listNeedsAttention(user, today);
  const trend = await dailyAttendanceTrend(user, today, 14);
  const setup = user.role === "ADMIN" ? await setupProgress(user) : null;
  const setupLeft = setup ? setup.filter((s) => !s.done) : [];

  // Which classes already have attendance saved today?
  const marked = await db.attendanceSession.findMany({
    where: { academyId: user.academyId, date: today, status: "SUBMITTED", classId: { in: classes.map((c) => c.id) } },
    select: { classId: true },
  });
  const markedIds = new Set(marked.map((m) => m.classId));

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your classes</h1>
          <p className="text-sm text-slate-600">Today: {today}</p>
        </div>
      </div>

      {setupLeft.length > 0 && (
        <section className="mb-6 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
          <h2 className="mb-2 font-semibold text-indigo-900">Setup: {setup!.length - setupLeft.length} of {setup!.length} done</h2>
          <ul className="space-y-1 text-sm">
            {setupLeft.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="font-medium text-indigo-700">{s.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 font-semibold text-slate-900">Attendance, last 14 days</h2>
        <TrendChart points={trend} />
      </section>

      {needs.length > 0 && (
        <section className="mb-6 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h2 className="mb-2 font-semibold text-amber-900">Needs attendance ({needs.length})</h2>
          <ul className="space-y-1 text-sm">
            {needs.slice(0, 10).map((n) => (
              <li key={n.id} className="flex items-center justify-between">
                <span>{n.date} · {n.class.name}</span>
                <Link href={`/attendance/${n.class.id}?date=${n.date}`} className="font-semibold text-indigo-600">Mark now</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 font-semibold text-slate-900">Today&apos;s schedule</h2>
        {schedule.length === 0 ? (
          <p className="text-sm text-slate-500">No classes scheduled today.</p>
        ) : (
          <ul className="space-y-2">
            {schedule.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200">
                <span><span className="font-semibold">{s.startTime}–{s.endTime}</span> · {s.class.name}</span>
                {s.cancelled ? <span className="text-slate-500">Cancelled</span> : <Link href={`/attendance/${s.classId}`} className="font-semibold text-indigo-600">Take attendance</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {classes.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-slate-700">
            {user.role === "ADMIN"
              ? "No classes yet. Create your first class to start."
              : "No classes have been assigned to you yet. Ask your administrator."}
          </p>
          {user.role === "ADMIN" && (
            <Link href="/classes/new" className="mt-4 inline-flex h-11 items-center rounded-xl bg-indigo-600 px-5 font-semibold text-white">
              Create a class
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => (
            <li key={c.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-slate-900">{c.name}</h2>
                  <p className="text-sm text-slate-600">
                    {c.subject ? `${c.subject} · ` : ""}
                    {c._count.students} students · {c.teacher?.name ?? "No teacher assigned"}
                  </p>
                </div>
                {markedIds.has(c.id) ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Marked today</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Not marked</span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Link href={`/attendance/${c.id}`} className="flex h-12 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
                  Take attendance
                </Link>
                <Link href={`/reports/${c.id}`} className="flex h-12 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-800">
                  Report
                </Link>
                {user.role === "ADMIN" && (
                  <Link href={`/classes/${c.id}`} className="flex h-12 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-800">
                    Manage
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
