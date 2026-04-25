#!/bin/bash

LOGFILE="/tmp/nextjs-startup.log"

echo "[compile_page.sh] Starting at $(date)" > "$LOGFILE"

cd /home/user

echo "[compile_page.sh] Starting Next.js dev server at $(date)" >> "$LOGFILE"
npx next dev --turbopack --hostname 0.0.0.0 >> "$LOGFILE" 2>&1 &
SERVER_PID=$!

echo "[compile_page.sh] Server PID: $SERVER_PID" >> "$LOGFILE"

# Wait for server to be ready (max 180 seconds)
counter=0
max_wait=180
while true; do
    counter=$((counter + 1))
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000" 2>/dev/null || echo "000")
    if [ "$response" = "200" ]; then
        echo "[compile_page.sh] Server responded 200 at $(date)" >> "$LOGFILE"
        break
    fi
    if [ "$counter" -ge "$max_wait" ]; then
        echo "[compile_page.sh] TIMEOUT waiting for server after $max_wait seconds" >> "$LOGFILE"
        exit 1
    fi
    if [ $((counter % 10)) -eq 0 ]; then
        echo "[compile_page.sh] Waiting... (${counter}s, response: $response)" >> "$LOGFILE"
    fi
    sleep 1
done

echo "[compile_page.sh] Server ready! Waiting 20s for Turbopack to settle at $(date)" >> "$LOGFILE"
sleep 20
echo "[compile_page.sh] Done. Server should be accessible at $(date)" >> "$LOGFILE"

# Keep container alive
echo "[compile_page.sh] Waiting for Next.js server (PID $SERVER_PID)..." >> "$LOGFILE"
wait $SERVER_PID
