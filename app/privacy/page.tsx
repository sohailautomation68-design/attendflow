import Link from "next/link";

export const metadata = { title: "Privacy policy — attendflow" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-slate-800">
      <Link href="/" className="text-sm font-medium text-indigo-600">← Home</Link>
      <h1 className="text-3xl font-bold text-slate-900">Privacy policy</h1>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        DRAFT. This page must be reviewed by a qualified lawyer before the service is offered to real academies.
      </p>

      <h2 className="pt-2 text-xl font-semibold">What we collect</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Academy staff: name, email address, and a password stored only as a one-way hash.</li>
        <li>Students (often minors): full name, roll number, class enrolment and attendance records. Guardian phone number only if the academy enters it.</li>
        <li>Technical records: failed sign-in attempts (by email, for rate limiting) and an audit log of attendance changes.</li>
      </ul>

      <h2 className="pt-2 text-xl font-semibold">How it is used</h2>
      <p>Data is used only to run attendance, alerts, follow-up and reports for the academy that entered it. We do not sell it or use it for advertising.</p>

      <h2 className="pt-2 text-xl font-semibold">Separation between academies</h2>
      <p>Each academy&apos;s data is separated from every other academy. Staff can only see the classes they are allowed to see.</p>

      <h2 className="pt-2 text-xl font-semibold">Keeping and deleting data</h2>
      <p>Draft default: attendance records are kept for 5 years after a student leaves, then deleted. The academy can ask for deletion earlier, subject to any legal duty to keep records.</p>

      <h2 className="pt-2 text-xl font-semibold">Your rights and contact</h2>
      <p>Academies and guardians may ask to see or correct a student&apos;s record through the academy. Contact details for privacy requests: to be added before launch.</p>
    </main>
  );
}
