/**
 * Pure CSV validation for student import (no database access, easy to test).
 * Expected header: fullName,rollNumber,guardianPhone (guardianPhone optional).
 * Quoted fields with commas are supported; newlines inside quotes are not.
 */

export type ImportRow = { line: number; fullName: string; rollNumber: string; guardianPhone: string | null };
export type ImportIssue = { line: number; message: string };
export type ImportResult = { rows: ImportRow[]; issues: ImportIssue[] };

export const MAX_IMPORT_ROWS = 500;

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function validateStudentCsv(text: string, existingRollNumbers: string[] = []): ImportResult {
  const issues: ImportIssue[] = [];
  const rows: ImportRow[] = [];

  const lines = text
    .replace(/^﻿/, "") // strip Excel's BOM
    .split(/\r?\n/)
    .map((l, i) => ({ text: l, line: i + 1 }))
    .filter((l) => l.text.trim() !== "");

  if (lines.length === 0) return { rows, issues: [{ line: 0, message: "The file is empty." }] };

  const header = parseLine(lines[0].text).map((h) => h.toLowerCase());
  const nameCol = header.indexOf("fullname");
  const rollCol = header.indexOf("rollnumber");
  const phoneCol = header.indexOf("guardianphone");
  if (nameCol === -1 || rollCol === -1) {
    return {
      rows,
      issues: [{ line: lines[0].line, message: "Header must include fullName and rollNumber columns (guardianPhone is optional)." }],
    };
  }

  const dataLines = lines.slice(1);
  if (dataLines.length > MAX_IMPORT_ROWS) {
    return { rows, issues: [{ line: 0, message: `Import at most ${MAX_IMPORT_ROWS} students at a time.` }] };
  }

  const seenRolls = new Set(existingRollNumbers.map((r) => r.toLowerCase()));

  for (const { text: raw, line } of dataLines) {
    const cells = parseLine(raw);
    const fullName = (cells[nameCol] ?? "").trim();
    const rollNumber = (cells[rollCol] ?? "").trim();
    const guardianPhone = phoneCol === -1 ? "" : (cells[phoneCol] ?? "").trim();
    const rowIssues: string[] = [];

    if (fullName.length < 2) rowIssues.push("name is required (2+ characters)");
    if (fullName.length > 120) rowIssues.push("name is too long");
    if (!rollNumber) rowIssues.push("roll number is required");
    if (rollNumber.length > 30) rowIssues.push("roll number is too long");
    if (guardianPhone && !/^[+0-9 ()-]{7,20}$/.test(guardianPhone)) rowIssues.push("guardian phone looks invalid");

    if (rollNumber) {
      const key = rollNumber.toLowerCase();
      if (seenRolls.has(key)) rowIssues.push(`roll number ${rollNumber} is already used in this class or earlier in the file`);
      else seenRolls.add(key);
    }

    if (rowIssues.length) {
      issues.push({ line, message: rowIssues.join("; ") });
    } else {
      rows.push({ line, fullName, rollNumber, guardianPhone: guardianPhone || null });
    }
  }

  if (dataLines.length === 0) issues.push({ line: 0, message: "No student rows found under the header." });
  return { rows, issues };
}
