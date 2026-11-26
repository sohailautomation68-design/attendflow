import { describe, expect, it } from "vitest";
import { validateStudentCsv } from "@/lib/csv-import";

describe("student CSV validation", () => {
  it("accepts a valid file and returns rows", () => {
    const r = validateStudentCsv("fullName,rollNumber,guardianPhone\nAli Khan,1,0300-1234567\nSara Ahmed,2,");
    expect(r.issues).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1].guardianPhone).toBeNull();
  });

  it("supports quoted names with commas and a BOM", () => {
    const r = validateStudentCsv('﻿fullName,rollNumber\n"Khan, Ali",7');
    expect(r.issues).toEqual([]);
    expect(r.rows[0].fullName).toBe("Khan, Ali");
  });

  it("rejects a file without the required header", () => {
    const r = validateStudentCsv("name,roll\nAli,1");
    expect(r.rows).toHaveLength(0);
    expect(r.issues[0].message).toMatch(/fullName and rollNumber/);
  });

  it("flags duplicate roll numbers inside the file and against existing students", () => {
    const r = validateStudentCsv("fullName,rollNumber\nAli Khan,1\nSara Ahmed,1\nBilal Raza,5", ["5"]);
    expect(r.rows.map((x) => x.rollNumber)).toEqual(["1"]);
    expect(r.issues).toHaveLength(2);
    expect(r.issues[0].message).toMatch(/already used/);
  });

  it("flags missing names, missing roll numbers and bad phones with line numbers", () => {
    const r = validateStudentCsv("fullName,rollNumber,guardianPhone\nA,1,\nBilal,,\nCara,3,abc");
    expect(r.rows).toHaveLength(0);
    expect(r.issues.map((i) => i.line)).toEqual([2, 3, 4]);
  });

  it("rejects an empty file", () => {
    expect(validateStudentCsv("   \n").issues[0].message).toMatch(/empty/);
  });
});
