import Link from "next/link";
import { MarkAllReadButton } from "@/components/PortalForms";
import { listNotifications } from "@/lib/data";
import { requireUser } from "@/lib/session";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user, 100);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <MarkAllReadButton />
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-slate-600 shadow-sm ring-1 ring-slate-200">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`rounded-xl p-4 shadow-sm ring-1 ${n.readAt ? "bg-white ring-slate-200" : "bg-indigo-50 ring-indigo-200"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-slate-900">{n.title}</p>
                <p className="shrink-0 text-xs text-slate-500">{n.createdAt.toISOString().slice(0, 10)}</p>
              </div>
              <p className="text-sm text-slate-700">{n.body}</p>
              {n.link && <Link href={n.link} className="mt-1 inline-block text-sm font-medium text-indigo-600">Open</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
