import { PublicShell } from "@/components/PublicShell";

export const metadata = { title: "FAQ — attendflow", description: "Common questions about attendflow." };

const QA = [
  { q: "Who can see my students' data?", a: "Only staff of your academy, and only the classes they are allowed to see. Other academies cannot see your data." },
  { q: "How is attendance percentage calculated?", a: "Present and Late count as attended. Excused leave is left out of the total. Cancelled days and days outside a student's enrolment are not counted." },
  { q: "What if a teacher marks the wrong student?", a: "Teachers can change a sheet for 48 hours after saving. After that, the academy administrator can correct it with a reason, and the change is logged." },
  { q: "Can parents see attendance?", a: "Yes, if the academy creates a guardian login and records consent. Guardians can only see their linked children." },
  { q: "Does it work on a phone?", a: "Yes. The attendance sheet is designed for phones, and a draft is kept on the device if the connection drops." },
  { q: "Will it send WhatsApp or SMS messages?", a: "Not yet. Messaging is planned for a later version and will need its own consent and cost decisions." },
];

export default function FaqPage() {
  return (
    <PublicShell>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Frequently asked questions</h1>
      <div className="mt-8 space-y-4">
        {QA.map((item) => (
          <details key={item.q} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <summary className="cursor-pointer font-semibold text-slate-900">{item.q}</summary>
            <p className="mt-2 text-sm text-slate-600">{item.a}</p>
          </details>
        ))}
      </div>
    </PublicShell>
  );
}
