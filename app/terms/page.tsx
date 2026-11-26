import Link from "next/link";

export const metadata = { title: "Terms of service — attendflow" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-slate-800">
      <Link href="/" className="text-sm font-medium text-indigo-600">← Home</Link>
      <h1 className="text-3xl font-bold text-slate-900">Terms of service</h1>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        DRAFT. This page must be reviewed by a qualified lawyer before the service is offered to real academies.
      </p>

      <h2 className="pt-2 text-xl font-semibold">Using attendflow</h2>
      <p>Academies are responsible for the accuracy of the attendance they record and for having the right to store student information.</p>

      <h2 className="pt-2 text-xl font-semibold">Accounts</h2>
      <p>Keep your password private. The academy administrator is responsible for teacher accounts they create.</p>

      <h2 className="pt-2 text-xl font-semibold">Acceptable use</h2>
      <p>Do not record attendance for students you are not responsible for, attempt to access another academy&apos;s data, or misuse the service.</p>

      <h2 className="pt-2 text-xl font-semibold">Availability and liability</h2>
      <p>The service is provided as-is during early access. Alerts and percentages support, but do not replace, your own judgement.</p>

      <h2 className="pt-2 text-xl font-semibold">Pricing</h2>
      <p>No charges apply during early access. Subscription terms will be published before any payment is requested.</p>
    </main>
  );
}
