import "server-only";

import type { Analysis, Reservation } from "@/lib/types";
import type { ReservationInput } from "@/lib/schemas";

const BASE = process.env.BOOKING_API_URL ?? "http://localhost:8080";

export class BookingError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BookingError";
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      cache: "no-store",
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new BookingError(`Booking service unreachable at ${BASE}`, 503);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!res.ok) {
    const msg =
      (body as { error?: string } | undefined)?.error ?? res.statusText;
    throw new BookingError(msg, res.status);
  }
  return body as T;
}

export function getReservations(): Promise<Reservation[]> {
  return req<Reservation[]>("/reservations");
}

export function getReservation(id: number): Promise<Reservation> {
  return req<Reservation>(`/reservations/${id}`);
}

export function getAnalysis(): Promise<Analysis> {
  return req<Analysis>("/analysis");
}

export function createReservation(input: ReservationInput): Promise<Reservation> {
  return req<Reservation>("/reservations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateReservation(
  id: number,
  input: ReservationInput,
): Promise<Reservation> {
  return req<Reservation>(`/reservations/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function cancelReservation(id: number): Promise<Reservation> {
  return req<Reservation>(`/reservations/${id}/cancel`, { method: "POST" });
}

export function deleteReservation(id: number): Promise<void> {
  return req<void>(`/reservations/${id}`, { method: "DELETE" });
}
