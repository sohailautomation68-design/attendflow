import { listAuditLog } from "@/lib/data";
import { requireAdmin } from "@/lib/session";

export default async function AuditPage() {
  const user = await requireAdmin();
  const logs = await listAuditLog(user, 100);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Audit history</h1>
      <p className="mt-1 text-sm text-slate-600">Every attendance change, newest first. Entries cannot be edited or deleted.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Change</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-4 py-3">{l.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC</td>
                <td className="px-4 py-3">{l.actorName}</td>
                <td className="px-4 py-3">{l.previousValue ?? "unmarked"} → {l.newValue}</td>
                <td className="px-4 py-3 text-slate-600">{l.reason ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No changes recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
