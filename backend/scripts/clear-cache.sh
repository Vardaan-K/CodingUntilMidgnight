#!/bin/bash
DIR="$(cd "$(dirname "$0")/.." && pwd)"
rm -f "$DIR/safe_space.db"
rm -f "$DIR/logs/"*.txt
kill $(lsof -t -i:3001) 2>/dev/null
echo "Cleared: database, logs. Restart server with: npm run dev"
