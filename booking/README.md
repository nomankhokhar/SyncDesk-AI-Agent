# Booking Reservation API + MCP Server (Go)

Reservation backend for the AI phone agent: a **Gin REST API** for managing bookings, plus an **MCP server** that exposes the same operations as tools so an AI agent can book, cancel, and analyze reservations.

```
AI Agent (Claude / phone-agent) ── MCP (stdio) ──► cmd/mcp ── HTTP ──► cmd/api ──► in-memory store
```

The receptionist in [`../phone-agent`](../phone-agent) uses this automatically: it spawns `cmd/mcp` on each call and registers every tool it publishes (see `phone-agent/src/booking-mcp.ts`) — you only need `cmd/api` running.

## Structure

```
booking/
├── cmd/
│   ├── api/          # REST API entrypoint (Gin, port 8080)
│   └── mcp/          # MCP server entrypoint (stdio)
└── internal/
    ├── controllers/  # HTTP handlers (thin, MVC "C")
    ├── models/       # Data structs + request/response types ("M")
    ├── routes/       # Route registration
    ├── services/     # Business logic + validation
    └── storage/      # In-memory store (swap for a DB later)
```

## Run

```bash
# 1. Start the API (default :8080, override with PORT)
go run ./cmd/api

# 2. Start the MCP server in another terminal (default API URL http://localhost:8080,
#    override with BOOKING_API_URL)
go run ./cmd/mcp
```

## REST API

| Method | Path                        | Description                          |
|--------|-----------------------------|--------------------------------------|
| GET    | /api/reservations           | List all reservations                |
| GET    | /api/reservations/:id       | Get one reservation                  |
| POST   | /api/reservations           | Create a reservation                 |
| PUT    | /api/reservations/:id       | Edit a reservation (full replace)    |
| DELETE | /api/reservations/:id       | Delete a reservation (204)           |
| POST   | /api/reservations/:id/cancel| Cancel a reservation (keeps the row) |
| GET    | /api/analysis               | Booking statistics                   |

Create / update payload (same shape):

```json
{
  "customer_name": "Ayesha Khan",
  "phone": "+923001112233",
  "party_size": 2,
  "date": "2026-07-15",
  "time": "19:00",
  "notes": "window seat"
}
```

## MCP tools

| Tool                  | What it does                                      |
|-----------------------|---------------------------------------------------|
| `list_reservations`   | List all reservations                             |
| `create_reservation`  | Book a reservation (name, phone, party size, date, time, notes) |
| `update_reservation`  | Change a reservation by ID (full replace)         |
| `cancel_reservation`  | Cancel by reservation ID                          |
| `get_booking_analysis`| Totals, cancellations, guests, avg party size, busiest date |

### Use with Claude Code / Claude Desktop

```json
{
  "mcpServers": {
    "booking": {
      "command": "go",
      "args": ["run", "./cmd/mcp"],
      "cwd": "/path/to/booking",
      "env": { "BOOKING_API_URL": "http://localhost:8080" }
    }
  }
}
```

Keep `cmd/api` running — the MCP server is a thin client over the REST API.

## Notes

- Storage is in-memory (seeded with sample data) — data resets on restart. The `storage.Store` methods are the only thing to reimplement for a real database.
- No credentials required; configuration is env-only (`PORT`, `BOOKING_API_URL`).
