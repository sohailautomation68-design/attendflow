import { ContactForm } from "@/components/ContactForm";
import { PublicShell } from "@/components/PublicShell";

export const metadata = { title: "Contact and book a demo — attendflow", description: "Book a demo or ask a question about attendflow." };

export default function ContactPage() {
  return (
    <PublicShell>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Book a demo</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Tell us about your academy and we will reply by email. We do not share your details.</p>
      <div className="mt-8 max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <ContactForm />
      </div>
    </PublicShell>
  );
}
