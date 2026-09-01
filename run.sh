#!/usr/bin/env bash
#
# Dev runner for SyncDesk: builds + starts the Go booking API and the
# LiveKit phone agent together, and tears both down on Ctrl-C.
#
#   ./run.sh                     # build + run
#   ./run.sh --no-build          # skip the Go rebuild
#   BOOKING_PORT=8090 ./run.sh   # run the booking API on another port
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOKING_PORT="${BOOKING_PORT:-8080}"
BUILD=1
[ "${1:-}" = "--no-build" ] && BUILD=0

log() { printf '\033[36m[run]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[run] %s\033[0m\n' "$*" >&2; exit 1; }

command -v go   >/dev/null || die "go not found"
command -v node >/dev/null || die "node not found"
[ -d "$ROOT/phone-agent/node_modules" ] || die "phone-agent deps missing — run: (cd phone-agent && npm install)"

# ── 1. Port check ───────────────────────────────────────────────────────────
if lsof -nP -iTCP:"$BOOKING_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  holder="$(lsof -nP -iTCP:"$BOOKING_PORT" -sTCP:LISTEN | awk 'NR==2 {print $1" (pid "$2")"}')"
  die "port $BOOKING_PORT is in use by $holder — free it or set BOOKING_PORT=<other>"
fi

# ── 2. Build the Go binaries ────────────────────────────────────────────────
if [ "$BUILD" = 1 ]; then
  log "building booking/bin/{api,mcp}"
  ( cd "$ROOT/booking" && go build -o bin/api ./cmd/api && go build -o bin/mcp ./cmd/mcp )
else
  [ -x "$ROOT/booking/bin/api" ] || die "booking/bin/api missing — run once without --no-build"
fi

# ── 3. First-time LiveKit model download ────────────────────────────────────
if [ ! -f "$ROOT/phone-agent/.livekit-files-downloaded" ]; then
  log "downloading LiveKit inference files (first run only)"
  ( cd "$ROOT/phone-agent" && npm run --silent download-files )
  touch "$ROOT/phone-agent/.livekit-files-downloaded"
fi

# ── 4. Start both, clean up on exit ─────────────────────────────────────────
API_PID=""
AGENT_PID=""

# Recursively signal a process and all its descendants (npm -> tsx -> node
# worker -> job procs, or the go binary). Portable to macOS bash 3.2.
killtree() {
  local sig="$1" pid="$2" child
  [ -n "$pid" ] || return 0
  for child in $(pgrep -P "$pid" 2>/dev/null); do killtree "$sig" "$child"; done
  kill "-$sig" "$pid" 2>/dev/null || true
}

alive() { kill -0 "$1" 2>/dev/null; }

cleanup() {
  trap - EXIT INT TERM
  log "shutting down"
  killtree TERM "$AGENT_PID"
  killtree TERM "$API_PID"
  # LiveKit idle job procs can dawdle on SIGTERM — give them ~3s, then SIGKILL.
  for _ in $(seq 1 6); do
    { [ -z "$AGENT_PID" ] || ! alive "$AGENT_PID"; } && \
    { [ -z "$API_PID" ]   || ! alive "$API_PID";   } && break
    sleep 0.5
  done
  killtree KILL "$AGENT_PID"
  killtree KILL "$API_PID"
  pkill -KILL -f "$ROOT/phone-agent/src/agent.ts" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM HUP

log "starting booking API on :$BOOKING_PORT"
( cd "$ROOT/booking" && exec env PORT="$BOOKING_PORT" ./bin/api ) &
API_PID=$!

# wait for the API to answer before launching the agent
up=0
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://localhost:$BOOKING_PORT/api/reservations"; then
    up=1; log "booking API is up"; break
  fi
  kill -0 "$API_PID" 2>/dev/null || die "booking API exited during startup"
  sleep 0.25
done
[ "$up" = 1 ] || die "booking API did not come up on :$BOOKING_PORT"

log "starting phone agent  —  Ctrl-C stops everything"
( cd "$ROOT/phone-agent" \
    && exec env BOOKING_API_URL="http://localhost:$BOOKING_PORT" \
               BOOKING_MCP_CMD="./bin/mcp" \
               npm run --silent dev ) &
AGENT_PID=$!

# exit (triggering cleanup) as soon as either side stops
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$AGENT_PID" 2>/dev/null; do
  sleep 1
done
die "a process exited — stopping the rest"
