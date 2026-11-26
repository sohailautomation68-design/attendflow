/**
 * The ONE attendance percentage calculation. Dashboards, reports and alerts
 * must all use this function so they never disagree.
 *
 * Rules (defaults; see docs/PRD-REVIEW.md):
 * - Only SUBMITTED sessions count. Open or draft sessions are ignored.
 * - Cancelled / holiday days are ignored entirely.
 * - Only sessions inside one of the student's enrollment periods count.
 *   An enrollment runs from startDate (inclusive) to endDate (exclusive; null = still enrolled).
 * - PRESENT and LATE count as attended.
 * - EXCUSED ("LEAVE") is excluded from the denominator (neither attended nor absent).
 * - ABSENT counts against the student.
 * - Returns percent = null when there are no eligible sessions (show "—", never 0%).
 */

export type StatSession = {
  date: string; // YYYY-MM-DD
  submitted: boolean;
  cancelled: boolean;
  statusByStudent: Map<string, string>;
};

export type StatEnrollment = { studentId: string; startDate: string; endDate: string | null };

export type StudentStats = {
  eligible: number;
  attended: number;
  absent: number;
  excused: number;
  percent: number | null;
};

export function inEnrollment(date: string, enrollments: StatEnrollment[], studentId: string): boolean {
  return enrollments.some(
    (e) => e.studentId === studentId && date >= e.startDate && (e.endDate === null || date < e.endDate),
  );
}

export function studentStats(
  studentId: string,
  sessions: StatSession[],
  enrollments: StatEnrollment[],
): StudentStats {
  let eligible = 0;
  let attended = 0;
  let absent = 0;
  let excused = 0;

  for (const s of sessions) {
    if (!s.submitted || s.cancelled) continue;
    if (!inEnrollment(s.date, enrollments, studentId)) continue;
    const status = s.statusByStudent.get(studentId);
    if (!status) continue; // no record for this student in a submitted session: not finalized for them

    if (status === "LEAVE") {
      excused++;
      continue;
    }
    eligible++;
    if (status === "PRESENT" || status === "LATE") attended++;
    else absent++;
  }

  return {
    eligible,
    attended,
    absent,
    excused,
    percent: eligible === 0 ? null : Math.round((attended / eligible) * 100),
  };
}
