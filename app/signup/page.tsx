import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "@/app/actions";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Create your academy</h1>
      <p className="mt-2 text-slate-600">You become the administrator. Add teachers afterwards.</p>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <AuthForm
          action={signupAction}
          submitLabel="Create academy"
          fields={[
            { name: "academyName", label: "Academy name", placeholder: "Bright Future Academy" },
            { name: "name", label: "Your full name", autoComplete: "name" },
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            { name: "password", label: "Password (min 8 characters)", type: "password", autoComplete: "new-password" },
          ]}
        />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-indigo-600">
          Sign in
        </Link>
      </p>
    </main>
  );
}
