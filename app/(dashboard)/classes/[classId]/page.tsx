import Link from "next/link";
import { notFound } from "next/navigation";
import { addStudentAction } from "@/app/actions";
import { AuthForm } from "@/components/AuthForm";
import { RemoveStudentButton, TeacherSelect, TransferButton } from "@/components/AdminControls";
import { CsvImport } from "@/components/CsvImport";
import { TimetableAdmin } from "@/components/TimetableAdmin";
import { SubjectsAdmin } from "@/components/SubjectsAdmin";
import { listSubjects, listTimetable } from "@/lib/data";
import { db } from "@/lib/db";
import { listClasses } from "@/lib/data";
import { AccessError, getClass, listStudents, listTeachers } from "@/lib/data";
import { requireAdmin } from "@/lib/session";

export default async function ManageClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const user = await requireAdmin();
  const { classId } = await params;

  try {
    const cls = await getClass(user, classId);
    const subjects = await listSubjects(user, classId);
    const [students, teachers, allClasses, timetable, cancelled] = await Promise.all([listStudents(user, classId), listTeachers(user), listClasses(user), listTimetable(user, classId), db.cancelledDay.findMany({ where: { classId, academyId: user.academyId }, orderBy: { date: "desc" } })]);

    return (
      <div className="space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-indigo-600">← Classes</Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{cls.name}</h1>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 font-semibold text-slate-900">Teacher</h2>
          <TeacherSelect
            classId={classId}
            teachers={teachers.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }))}
            currentTeacherId={cls.teacherId}
          />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 font-semibold text-slate-900">Add student</h2>
            <AuthForm
              action={addStudentAction}
              submitLabel="Add student"
              hidden={{ classId }}
              fields={[
                { name: "fullName", label: "Full name" },
                { name: "rollNumber", label: "Roll number" },
                { name: "guardianPhone", label: "Guardian phone (optional)", optional: true },
              ]}
            />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 font-semibold text-slate-900">Students ({students.length})</h2>
            <ul className="divide-y divide-slate-100">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/students/${s.id}`} className="truncate font-medium text-slate-900 hover:underline">{s.fullName}</Link>
                    <p className="text-xs text-slate-500">Roll {s.rollNumber}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1"><TransferButton studentId={s.id} classId={classId} classes={allClasses.map((c) => ({ id: c.id, name: c.name }))} /><RemoveStudentButton studentId={s.id} classId={classId} name={s.fullName} /></div>
                </li>
              ))}
              {students.length === 0 && <li className="py-4 text-sm text-slate-500">No students yet.</li>}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:col-span-2">
            <h2 className="mb-3 font-semibold text-slate-900">Subjects</h2>
            <SubjectsAdmin classId={classId} subjects={subjects} />
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:col-span-2">
            <h2 className="mb-3 font-semibold text-slate-900">Timetable</h2>
            <TimetableAdmin classId={classId} entries={timetable} cancelledDays={cancelled} />
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:col-span-2">
            <h2 className="mb-3 font-semibold text-slate-900">Import students from CSV</h2>
            <CsvImport classId={classId} />
          </div>
        </section>
      </div>
    );
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
}
