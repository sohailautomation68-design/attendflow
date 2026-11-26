import { z } from "zod";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  academyName: z.string().trim().max(120).optional(),
  message: z.string().trim().max(1000).optional(),
  website: z.string().max(500).optional(), // honeypot: real visitors leave this empty
});

export type LeadInput = z.input<typeof leadSchema>;

/** Stores a demo or contact request. Returns an error message, or null on success. */
export async function saveLead(input: LeadInput): Promise<string | null> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues[0].message;
  if (parsed.data.website) return null; // silently accept bot submissions
  await db.lead.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      academyName: parsed.data.academyName || null,
      message: parsed.data.message || null,
    },
  });
  await trackEvent("lead_submitted", null);
  return null;
}
