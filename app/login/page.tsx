import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Sign in to attendflow</h1>
      <p className="mt-2 text-slate-600">Take attendance in seconds.</p>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <AuthForm
          action={loginAction}
          submitLabel="Sign in"
          fields={[
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
          ]}
        />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        New academy?{" "}
        <Link href="/signup" className="font-semibold text-indigo-600">
          Create an account
        </Link>
      </p>
    </main>
  );
}
