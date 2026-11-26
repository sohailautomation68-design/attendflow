/**
 * Plan limits. Prices are EXPERIMENTAL hypotheses from the PRD and must be validated with academy owners.
 * Change them here (or move to the database later); nothing else hard-codes prices.
 */
export const PLANS = {
  STARTER: { name: "Starter", maxStudents: 100, maxTeachers: 5, priceLabel: "Rs. 799 / month (experimental)" },
  STANDARD: { name: "Standard", maxStudents: 300, maxTeachers: 15, priceLabel: "Rs. 1,499 / month (experimental)" },
  PROFESSIONAL: { name: "Professional", maxStudents: 1000, maxTeachers: 30, priceLabel: "Rs. 2,999 / month (experimental)" },
} as const;

export type PlanCode = keyof typeof PLANS;

export const SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED"] as const;
