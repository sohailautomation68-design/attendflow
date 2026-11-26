import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";

export const metadata = {
  title: "Features — attendflow attendance software for academies",
  description: "Digital attendance, absence alerts, follow-up tasks, reports and student and guardian access for coaching centres and tuition academies.",
};

const FEATURES = [
  { t: "Student management", d: "Add students one by one or import a CSV with a preview and validation. Move students between classes without losing history." },
  { t: "Digital attendance", d: "Mark a whole class in one screen with big buttons. Mark everyone present first, then change exceptions. Subjects can have their own sheet." },
  { t: "Teacher management", d: "Teachers see only the classes assigned to them. Admins control timetables and assignments." },
  { t: "Absence alerts", d: "Repeated absences and low attendance are flagged automatically, with follow-up tasks and recorded reasons." },
  { t: "Reports", d: "Attendance percentages use one set of clear rules. Filter by date and subject, then download CSV." },
  { t: "Timetable and cancelled days", d: "Weekly slots generate attendance days. Holidays and cancelled classes are never counted as absences." },
  { t: "Student and guardian access", d: "Students see their own attendance. Guardians see only their linked children, after consent is recorded." },
  { t: "Audit trail", d: "Every attendance change is logged with who made it, the old and new values, and the reason." },
];

export default function FeaturesPage() {
  return (
    <PublicShell>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Features</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Everything an academy needs for daily attendance, from the first class to the end-of-month report.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f.t} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-slate-900">{f.t}</h2>
            <p className="mt-2 text-sm text-slate-600">{f.d}</p>
          </li>
        ))}
      </ul>
      <p className="mt-10"><Link href="/signup" className="font-semibold text-indigo-600">Start your academy →</Link></p>
    </PublicShell>
  );
}
