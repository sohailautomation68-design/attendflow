import Link from "next/link";
import { redirect } from "next/navigation";
import { STRINGS, pickLang } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/session";

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "STUDENT" || user.role === "GUARDIAN" ? "/me" : "/dashboard");

  const sp = await searchParams;
  const lang = pickLang(sp.lang);
  const t = STRINGS[lang];

  return (
    <div dir={t.dir} className="mx-auto max-w-4xl px-4 py-12">
      <header className="flex items-center justify-between gap-3">
        <p className="text-lg font-bold text-indigo-700">attendflow</p>
        <nav className="flex items-center gap-3 text-sm font-medium">
          <Link href={lang === "ur" ? "/" : "/?lang=ur"} className="px-3 py-2 text-slate-700">{t.switchTo}</Link>
          <Link href="/login" className="px-3 py-2 text-slate-700">{t.ctaSignIn}</Link>
          <Link href="/signup" className="rounded-lg bg-indigo-600 px-3 py-2 text-white">{t.ctaStart}</Link>
        </nav>
      </header>

      <section className="mt-16 text-start">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{t.heroTitle}</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">{t.heroBody}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">{t.ctaStart}</Link>
          <Link href="/contact" className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-800 ring-1 ring-slate-300">Book a demo</Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          { t: t.feature1, d: t.feature1Body },
          { t: t.feature2, d: t.feature2Body },
          { t: t.feature3, d: t.feature3Body },
        ].map((f) => (
          <div key={f.t} className="rounded-2xl bg-white p-5 text-start shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-slate-900">{f.t}</h2>
            <p className="mt-2 text-sm text-slate-600">{f.d}</p>
          </div>
        ))}
      </section>

      <footer className="mt-16 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <Link href="/features" className="hover:text-slate-800">Features</Link>
        <Link href="/pricing" className="hover:text-slate-800">Pricing</Link>
        <Link href="/faq" className="hover:text-slate-800">FAQ</Link>
        <Link href="/privacy" className="hover:text-slate-800">Privacy policy</Link>
        <Link href="/terms" className="hover:text-slate-800">Terms of service</Link>
      </footer>
    </div>
  );
}
