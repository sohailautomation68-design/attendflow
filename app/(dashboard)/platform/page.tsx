import { PlatformAcademyRow } from "@/components/PlatformAcademyRow";
import { listAcademiesForPlatform } from "@/lib/data";
import { PLANS } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { AccessError } from "@/lib/data";
import { redirect } from "next/navigation";

export default async function PlatformPage() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard");

  let rows;
  try {
    rows = await listAcademiesForPlatform(user);
  } catch (e) {
    if (e instanceof AccessError) redirect("/dashboard");
    throw e;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Platform owner</h1>
      <p className="mt-1 text-sm text-slate-600">
        Counts and billing settings only. Student names and attendance records are not shown here. Every change is written to the audit log with a reason.
      </p>
      <div className="mt-5 space-y-3">
        {rows.map((r) => (
          <PlatformAcademyRow
            key={r.id}
            academyId={r.id}
            name={r.name}
            students={r.students}
            teachers={r.teachers}
            planCode={r.planCode}
            subscriptionStatus={r.subscriptionStatus}
            active={r.active}
            plans={Object.entries(PLANS).map(([code, p]) => ({ code, name: p.name, maxStudents: p.maxStudents, maxTeachers: p.maxTeachers }))}
          />
        ))}
        {rows.length === 0 && <p className="text-slate-600">No academies yet.</p>}
      </div>
    </div>
  );
}
