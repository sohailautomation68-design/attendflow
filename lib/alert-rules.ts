/**
 * Absence alert rules (pure, no database). Defaults from docs/PRD-REVIEW.md.
 * Only SUBMITTED sessions inside the student's enrollment and not cancelled are considered,
 * exactly as in lib/attendance-stats.ts.
 *
 * Streak rule: an ABSENT streak is broken by PRESENT, LATE or LEAVE.
 */

export const ALERT_RULES = {
  consecutiveAbsences: 3,
  lowAttendancePercent: 75,
  lowAttendanceMinSessions: 4, // avoid alerting on the first few days
  absencesInWindow: { count: 5, days: 30 },
} as const;

export type AlertRule = "CONSECUTIVE_ABSENCES" | "LOW_ATTENDANCE" | "ABSENCES_IN_30_DAYS";

export type RuleSession = { date: string; status: string }; // status of this student in a counted session

export type TriggeredAlert = { rule: AlertRule; detail: string };

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}

/** sessions: counted sessions for one student (any order). today: YYYY-MM-DD. */
export function evaluateRules(sessions: RuleSession[], percent: number | null, eligible: number, today: string): TriggeredAlert[] {
  const alerts: TriggeredAlert[] = [];
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first

  // 1. Consecutive absences (most recent sessions in a row)
  let streak = 0;
  for (const s of ordered) {
    if (s.status !== "ABSENT") break;
    streak++;
  }
  if (streak >= ALERT_RULES.consecutiveAbsences) {
    alerts.push({ rule: "CONSECUTIVE_ABSENCES", detail: `${streak} consecutive absences` });
  }

  // 2. Low attendance percentage
  if (percent !== null && eligible >= ALERT_RULES.lowAttendanceMinSessions && percent < ALERT_RULES.lowAttendancePercent) {
    alerts.push({ rule: "LOW_ATTENDANCE", detail: `Attendance ${percent}% (below ${ALERT_RULES.lowAttendancePercent}%)` });
  }

  // 3. Absences within a rolling window
  const recentAbsences = sessions.filter(
    (s) => s.status === "ABSENT" && daysBetween(s.date, today) >= 0 && daysBetween(s.date, today) < ALERT_RULES.absencesInWindow.days,
  ).length;
  if (recentAbsences >= ALERT_RULES.absencesInWindow.count) {
    alerts.push({
      rule: "ABSENCES_IN_30_DAYS",
      detail: `${recentAbsences} absences in the last ${ALERT_RULES.absencesInWindow.days} days`,
    });
  }

  return alerts;
}
