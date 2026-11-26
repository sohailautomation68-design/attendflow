import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";
import { PLANS } from "@/lib/plans";

export const metadata = {
  title: "Pricing — attendflow",
  description: "Simple monthly plans by number of students and teachers. Early-access pricing is experimental.",
};

export default function PricingPage() {
  return (
    <PublicShell>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Pricing</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Prices are experimental and may change during early access. No payment is taken until a subscription is agreed in writing.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {Object.values(PLANS).map((p) => (
          <div key={p.name} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
            <p className="mt-2 text-sm font-medium text-indigo-700">{p.priceLabel}</p>
            <ul className="mt-4 space-y-1 text-sm text-slate-700">
              <li>Up to {p.maxStudents} active students</li>
              <li>Up to {p.maxTeachers} teachers</li>
              <li>Attendance, alerts, reports and audit trail</li>
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-10 text-slate-700">Not sure which plan fits? <Link href="/contact" className="font-semibold text-indigo-600">Book a demo</Link>.</p>
    </PublicShell>
  );
}
