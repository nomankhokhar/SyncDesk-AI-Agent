# SyncDesk Dashboard

A Next.js + shadcn/ui dashboard for the SyncDesk booking API and the LiveKit AI
phone agent.

- **Reservations** — full CRUD (create / edit / cancel / delete) over
  [`../booking`](../booking) plus the booking analysis. AI-made bookings show up
  here automatically.
- **AI Calls** — place an outbound AI call by phone number, watch live calls with
  the agent's state (listening / thinking / speaking) and a live transcript of
  both sides, and end a call.

Nothing in the browser talks to the Go API or LiveKit directly — the Go API has
no CORS, so all of that runs through Next Route Handlers / Server Actions.

## Setup

```bash
cd dashboard
npm install
npm run dev                       # http://localhost:3000
```

**Credentials:** the dashboard reads `LIVEKIT_URL` / `LIVEKIT_API_KEY` /
`LIVEKIT_API_SECRET` straight out of `../phone-agent/.env` at startup
(see `next.config.ts`) — there's no second copy and nothing to fill in.

Everything is optional / has a default:

| Var | Where it comes from |
|---|---|
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | `../phone-agent/.env` (auto), server-side only |
| `BOOKING_API_URL` | defaults to `http://localhost:8080` |

To override any of them, make a `dashboard/.env.local` (gitignored) — it wins
over the `phone-agent/.env` fallback.

## Running everything

`../run.sh` starts the booking API, the phone agent, **and** this dashboard
(on `:3000`) together, tearing all three down on Ctrl-C. It skips the dashboard
only if `dashboard/node_modules` is missing.

For the AI Calls tab to do anything, the `phone-agent` worker must be running
(`npm run dev` in `../phone-agent`, or via `run.sh`).

## Notes

- The booking store is in-memory and resets (back to 2 seed rows, IDs from 1) on
  every API restart.
- No auth — run it locally only. The call-token route mints a room-join token
  for anyone who can reach `:3000`.
- Scripts: `npm run dev` / `build` / `start` / `lint`.
