#!/bin/bash
DIR="$(cd "$(dirname "$0")/.." && pwd)"
rm -f "$DIR/safe_space.db"
kill $(lsof -t -i:3001) 2>/dev/null
echo "Cache cleared. Restart server with: npm run dev"
