#!/bin/bash
query="${*:-Starbucks San Luis Obispo}"
encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$query")
curl -s --max-time 180 "http://localhost:3001/search?query=$encoded" | python3 -m json.tool
