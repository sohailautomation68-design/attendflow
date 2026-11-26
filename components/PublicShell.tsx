import Link from "next/link";

/** Shared header and footer for the public marketing pages. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="text-lg font-bold text-indigo-700">attendflow</Link>
          <nav className="flex flex-wrap gap-3 text-sm font-medium text-slate-700">
            <Link href="/features" className="px-2 py-1">Features</Link>
            <Link href="/pricing" className="px-2 py-1">Pricing</Link>
            <Link href="/faq" className="px-2 py-1">FAQ</Link>
            <Link href="/about" className="px-2 py-1">About</Link>
            <Link href="/login" className="px-2 py-1">Sign in</Link>
            <Link href="/signup" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white">Start your academy</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">{children}</main>
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 py-6 text-sm text-slate-500">
          <Link href="/contact" className="hover:text-slate-800">Contact and demo</Link>
          <Link href="/privacy" className="hover:text-slate-800">Privacy policy</Link>
          <Link href="/terms" className="hover:text-slate-800">Terms of service</Link>
        </div>
      </footer>
    </div>
  );
}
