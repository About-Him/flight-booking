#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
curl -sS -X POST "http://localhost:8083/connectors" \
  -H "Content-Type: application/json" \
  -d @"$ROOT/scripts/debezium-connector.json"
echo
