import { createTeacherAction } from "@/app/actions";
import { AuthForm } from "@/components/AuthForm";
import { listTeachers } from "@/lib/data";
import { requireAdmin } from "@/lib/session";

export default async function TeachersPage() {
  const user = await requireAdmin();
  const teachers = await listTeachers(user);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Teachers</h1>
        <p className="mt-1 text-sm text-slate-600">Teachers sign in with the email and password you set here, and only see their own classes.</p>
        <ul className="mt-4 divide-y divide-slate-200 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {teachers.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <p className="font-medium text-slate-900">{t.name}</p>
              <p className="text-sm text-slate-500">{t.email}</p>
            </li>
          ))}
          {teachers.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">No teachers yet.</li>}
        </ul>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold text-slate-900">Add teacher</h2>
        <AuthForm
          action={createTeacherAction}
          submitLabel="Create teacher account"
          fields={[
            { name: "name", label: "Full name" },
            { name: "email", label: "Email", type: "email" },
            { name: "password", label: "Temporary password (min 8)", type: "password" },
          ]}
        />
      </div>
    </div>
  );
}
