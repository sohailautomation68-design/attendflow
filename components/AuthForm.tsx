"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string; optional?: boolean };

export function AuthForm({
  action,
  fields,
  submitLabel,
  hidden,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Field[];
  submitLabel: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // After a successful submit (e.g. "Student added"), clear the fields for the next entry.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{f.label}</span>
          <input
            name={f.name}
            type={f.type ?? "text"}
            autoComplete={f.autoComplete}
            placeholder={f.placeholder}
            required={!f.optional}
            className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </label>
      ))}

      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {state.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
