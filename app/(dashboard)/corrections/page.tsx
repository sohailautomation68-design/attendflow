import { CorrectionDecision } from "@/components/PortalForms";
import { listCorrections } from "@/lib/data";
import { requireAdmin } from "@/lib/session";

export default async function CorrectionsPage() {
  const user = await requireAdmin();
  const pending = await listCorrections(user, "PENDING");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Correction requests</h1>
      <p className="mt-1 text-sm text-slate-600">Approving applies the change to the attendance record and writes it to the audit log with the reason.</p>
      {pending.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white p-6 text-center text-slate-600 shadow-sm ring-1 ring-slate-200">No pending requests.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {pending.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold text-slate-900">{r.studentName} · {r.date} → {r.requestedStatus}</p>
              <p className="mt-1 text-sm text-slate-700">Reason: {r.reason}</p>
              <p className="text-xs text-slate-500">Sent {r.createdAt.toISOString().slice(0, 10)}</p>
              <div className="mt-3">
                <CorrectionDecision requestId={r.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
