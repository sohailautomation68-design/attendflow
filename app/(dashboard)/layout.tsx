import Link from "next/link";
import type { Metadata } from "next";
import { logoutAction } from "@/app/actions";
import { unreadCount } from "@/lib/data";
import { requireUser } from "@/lib/session";

// Private area: never indexed by search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const isStaff = user.role === "ADMIN" || user.role === "TEACHER";
  const unread = await unreadCount(user);

  const roleLabel: Record<string, string> = {
    ADMIN: "Administrator",
    TEACHER: "Teacher",
    STUDENT: "Student",
    GUARDIAN: "Guardian",
    SUPER_ADMIN: "Platform owner",
  };

  const links = user.role === "SUPER_ADMIN"
    ? [{ href: "/platform", label: "Platform" }]
    : isStaff
    ? [
        { href: "/dashboard", label: "Classes" },
        { href: "/alerts", label: "Alerts" },
        ...(isAdmin
          ? [
              { href: "/classes/new", label: "New class" },
              { href: "/teachers", label: "Teachers" },
              { href: "/corrections", label: "Corrections" },
              { href: "/audit", label: "Audit" },
            ]
          : []),
        { href: "/notifications", label: unread ? `Notifications (${unread})` : "Notifications" },
      ]
    : [
        { href: "/me", label: "My attendance" },
        { href: "/notifications", label: unread ? `Notifications (${unread})` : "Notifications" },
      ];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{user.academyName}</p>
            <p className="truncate text-xs text-slate-500">
              {user.name} · {roleLabel[user.role] ?? user.role}
            </p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="h-10 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </div>
  );
}
