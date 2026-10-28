#!/bin/bash
# Legacy entry point: Mertrack Configuration.
# Diteruskan ke Integra Commander CLI (menu Setting).

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$BASE_DIR/commander.sh" ]; then
  echo "❌ commander.sh tidak ditemukan di $BASE_DIR"
  exit 1
fi

exec "$BASE_DIR/commander.sh" --settings
