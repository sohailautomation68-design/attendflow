"use client";

import { useActionState } from "react";
import { submitLeadAction } from "@/app/actions";

export function ContactForm() {
  const [state, action, pending] = useActionState(submitLeadAction, undefined);
  return (
    <form action={action} className="space-y-3">
      {/* Honeypot: hidden from people, filled in by simple bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <input name="name" required placeholder="Your name" className="h-11 w-full rounded-lg border border-slate-300 px-3" />
      <input name="email" type="email" required placeholder="Email" className="h-11 w-full rounded-lg border border-slate-300 px-3" />
      <input name="academyName" placeholder="Academy name (optional)" className="h-11 w-full rounded-lg border border-slate-300 px-3" />
      <textarea name="message" rows={4} placeholder="What would you like to see? (optional)" className="w-full rounded-lg border border-slate-300 p-3" />
      <button type="submit" disabled={pending} className="h-11 w-full rounded-lg bg-indigo-600 font-semibold text-white disabled:opacity-50">
        {pending ? "Sending…" : "Request a demo"}
      </button>
      {state?.error && <p role="alert" className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
