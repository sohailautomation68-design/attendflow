import { createClassAction } from "@/app/actions";
import { AuthForm } from "@/components/AuthForm";
import { listTeachers } from "@/lib/data";
import { requireAdmin } from "@/lib/session";

export default async function NewClassPage() {
  const user = await requireAdmin();
  const teachers = await listTeachers(user);

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">New class</h1>
      <p className="mt-1 text-sm text-slate-600">After creating it, add students from the class page.</p>
      <div className="mt-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <AuthForm
          action={createClassAction}
          submitLabel="Create class"
          fields={[
            { name: "name", label: "Class name", placeholder: "Grade 5 - Section A" },
            { name: "subject", label: "Subject (optional)", placeholder: "Mathematics", optional: true },
          ]}
        />
        {teachers.length > 0 ? (
          <p className="mt-4 text-xs text-slate-500">You can assign a teacher from the class page after creating it.</p>
        ) : (
          <p className="mt-4 text-xs text-slate-500">Tip: add a teacher account first under Teachers.</p>
        )}
      </div>
    </div>
  );
}
