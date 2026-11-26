import { PublicShell } from "@/components/PublicShell";

export const metadata = { title: "About — attendflow", description: "Why attendflow exists and who it is for." };

export default function AboutPage() {
  return (
    <PublicShell>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">About attendflow</h1>
      <div className="mt-6 space-y-4 text-slate-700">
        <p>Many small academies still keep attendance in paper registers or spreadsheets. Repeated absences go unnoticed, and reports take hours.</p>
        <p>attendflow is built for tuition academies, coaching centres and computer and language institutes. The goal is simple: make marking attendance fast for teachers, and make it easy for management to see who needs help.</p>
        <p>We start with the attendance workflow and add features only when the core works well for real teachers.</p>
      </div>
    </PublicShell>
  );
}
