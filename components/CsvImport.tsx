"use client";

import { useState, useTransition } from "react";
import { importStudentsAction, previewImportAction } from "@/app/actions";

type Issue = { line: number; message: string };
type Row = { line: number; fullName: string; rollNumber: string; guardianPhone: string | null };

export function CsvImport({ classId }: { classId: string }) {
  const templateHref = `/classes/${classId}/template`;
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ rows: Row[]; issues: Issue[] } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Paste CSV text with the header <code className="rounded bg-slate-100 px-1">fullName,rollNumber,guardianPhone</code>.
        Check the file first; nothing is saved until you confirm.{" "}
        <a href={`${templateHref}`} className="font-medium text-indigo-600 underline">Download a template</a>
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
          setResult(null);
        }}
        rows={6}
        placeholder={"fullName,rollNumber,guardianPhone\nAli Khan,1,0300-1234567"}
        className="w-full rounded-xl border border-slate-300 p-3 font-mono text-sm"
        aria-label="Student CSV"
      />
      <button
        type="button"
        disabled={pending || !text.trim()}
        onClick={() => start(async () => setPreview(await previewImportAction(classId, text)))}
        className="h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 disabled:opacity-50"
      >
        Check file
      </button>

      {preview && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold">
            {preview.rows.length} valid row(s), {preview.issues.length} issue(s)
          </p>
          {preview.issues.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-700">
              {preview.issues.map((i) => (
                <li key={`${i.line}-${i.message}`}>{i.line ? `Line ${i.line}: ` : ""}{i.message}</li>
              ))}
            </ul>
          )}
          {preview.issues.length === 0 && preview.rows.length > 0 && (
            <>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {preview.rows.map((r) => (
                  <li key={r.line}>{r.rollNumber} — {r.fullName}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await importStudentsAction(classId, text);
                    setResult(r.issues.length ? `Not imported: ${r.issues[0].message}` : `Imported ${r.imported} students.`);
                    if (!r.issues.length) {
                      setText("");
                      setPreview(null);
                    }
                  })
                }
                className="mt-3 h-11 w-full rounded-xl bg-indigo-600 font-semibold text-white disabled:opacity-50"
              >
                Import {preview.rows.length} students
              </button>
            </>
          )}
        </div>
      )}
      {result && <p role="status" className="text-sm text-slate-700">{result}</p>}
    </div>
  );
}
