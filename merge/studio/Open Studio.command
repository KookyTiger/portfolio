#!/bin/bash
# Double-click in Finder: starts the KookyTiger Studio and opens it in your browser.
# Keep this Terminal window open while you work; closing it stops the Studio. (If a Studio is already running, this just opens it.)
cd "$(dirname "$0")/../.." || exit 1
URL="http://localhost:8010/merge/studio/"
if curl -s -m 1 -o /dev/null http://localhost:8010/api/hashes; then open "$URL"; exit 0; fi
( sleep 1.5; open "$URL" ) &
exec python3 merge/studio/server.py
