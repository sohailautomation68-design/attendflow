import { db } from "@/lib/db";

/**
 * Privacy-conscious analytics: records an event name and time only.
 * No personal data, no IP addresses, no free text. Unknown event names are ignored.
 */
export const EVENTS = ["signup_completed", "attendance_saved", "lead_submitted", "alert_raised", "correction_requested"] as const;
export type EventName = (typeof EVENTS)[number];

export async function trackEvent(name: EventName, academyId?: string | null) {
  if (!EVENTS.includes(name)) return;
  try {
    await db.analyticsEvent.create({ data: { name, academyId: academyId ?? null } });
  } catch {
    // Analytics must never break the user's action.
  }
}
