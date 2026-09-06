// Shapes returned by the Go booking API (booking/internal/models) and the
// LiveKit call-summary view built in lib/calls.ts.

export type ReservationStatus = "confirmed" | "cancelled";

export interface Reservation {
  id: number;
  customer_name: string;
  phone: string;
  party_size: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h)
  notes?: string;
  status: ReservationStatus;
  created_at: string; // RFC3339
}

export interface Analysis {
  total_reservations: number;
  confirmed: number;
  cancelled: number;
  total_guests: number;
  avg_party_size: number; // unrounded; 0 when confirmed === 0
  by_date: Record<string, number>;
  busiest_date?: string;
}

// Agent state published as the `lk.agent.state` participant attribute.
export type AgentState =
  | "initializing"
  | "listening"
  | "thinking"
  | "speaking"
  | (string & {});

export type CallDirection = "inbound" | "outbound";

export interface CallSummary {
  room: string;
  direction: CallDirection;
  phoneNumber: string | null;
  agentState: AgentState | null;
  agentPresent: boolean;
  callerPresent: boolean;
  numParticipants: number;
  startedAt: string; // ISO
}
