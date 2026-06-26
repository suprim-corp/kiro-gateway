#!/bin/sh
# Start API (internal only, not exposed)
cd /app/packages/api && bun dist/index.js &
sleep 2

# Start Next.js on port 3000, bind to all interfaces
cd /app/packages/web/packages/web && HOSTNAME=0.0.0.0 PORT=3000 exec bun server.js
