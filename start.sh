#!/usr/bin/env bash
# OASIS ScorePro — start both backend and frontend in development mode
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== OASIS ScorePro ==="
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
echo "[1/2] Starting FastAPI backend on http://localhost:8000 ..."
(
  cd "$ROOT/backend"
  python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level info
) &
BACKEND_PID=$!
echo "      Backend PID: $BACKEND_PID"

# Give the backend a moment to start
sleep 2

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "[2/2] Starting Vite frontend on http://localhost:5173 ..."
(
  cd "$ROOT"
  npm run dev -- --host
) &
FRONTEND_PID=$!
echo "      Frontend PID: $FRONTEND_PID"

echo ""
echo "  Dashboard → http://localhost:5173"
echo "  API docs  → http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# Wait and clean up both on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
