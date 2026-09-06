import { z } from "zod";

// Shared by the client forms (react-hook-form resolver) AND the server trust
// boundary (Server Actions / Route Handlers). Field names are snake_case to
// match the Go API exactly — no mapping anywhere.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// Stricter than phone-agent/src/make-call.ts (which only checks a leading "+").
export const E164_RE = /^\+[1-9]\d{7,14}$/;

function isRealCalendarDate(v: string): boolean {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && v === d.toISOString().slice(0, 10);
}

export const reservationSchema = z.object({
  customer_name: z.string().trim().min(1, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .regex(E164_RE, "Use E.164 format, e.g. +14155551234"),
  party_size: z.coerce
    .number()
    .int("Whole number")
    .min(1, "At least 1 guest")
    .max(50, "50 guests max"),
  date: z
    .string()
    .regex(DATE_RE, "Use YYYY-MM-DD")
    .refine(isRealCalendarDate, "Not a real date"),
  time: z.string().regex(TIME_RE, "Use HH:MM (24h)"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ReservationInput = z.infer<typeof reservationSchema>;

export const callDispatchSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(E164_RE, "Use E.164 format, e.g. +14155551234"),
});

export type CallDispatchInput = z.infer<typeof callDispatchSchema>;

/** First human-readable issue from a failed `safeParse`. */
export function firstIssue(error: z.ZodError): { message: string; field?: string } {
  const issue = error.issues[0];
  return {
    message: issue?.message ?? "Invalid input",
    field: typeof issue?.path[0] === "string" ? issue.path[0] : undefined,
  };
}
