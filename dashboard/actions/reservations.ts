"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  BookingError,
  cancelReservation,
  createReservation,
  deleteReservation,
  updateReservation,
} from "@/lib/booking";
import { firstIssue, reservationSchema } from "@/lib/schemas";
import type { Reservation } from "@/lib/types";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; field?: string };

const idSchema = z.coerce.number().int().positive();

// Server Actions are reachable by direct POST, so re-validate everything here —
// this is the trust boundary. The Go API still owns the final word (its error
// strings are surfaced verbatim). Never throw to the client.

export async function createReservationAction(
  input: unknown,
): Promise<ActionResult<Reservation>> {
  const parsed = reservationSchema.safeParse(input);
  if (!parsed.success) {
    const { message, field } = firstIssue(parsed.error);
    return { ok: false, error: message, field };
  }
  try {
    const reservation = await createReservation(parsed.data);
    revalidatePath("/reservations");
    return { ok: true, data: reservation };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function updateReservationAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<Reservation>> {
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Invalid reservation id" };

  const parsed = reservationSchema.safeParse(input);
  if (!parsed.success) {
    const { message, field } = firstIssue(parsed.error);
    return { ok: false, error: message, field };
  }
  try {
    const reservation = await updateReservation(idParsed.data, parsed.data);
    revalidatePath("/reservations");
    return { ok: true, data: reservation };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function cancelReservationAction(
  id: unknown,
): Promise<ActionResult> {
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Invalid reservation id" };
  try {
    await cancelReservation(idParsed.data);
    revalidatePath("/reservations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function deleteReservationAction(
  id: unknown,
): Promise<ActionResult> {
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Invalid reservation id" };
  try {
    await deleteReservation(idParsed.data);
    revalidatePath("/reservations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

function errMessage(e: unknown): string {
  if (e instanceof BookingError) return e.message;
  return e instanceof Error ? e.message : "Something went wrong";
}
