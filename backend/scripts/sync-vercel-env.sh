#!/usr/bin/env bash
# Sync keys from project root .env to Vercel (production). Does not print secret values.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/.env"
TARGET_ENV="${1:-production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

cd "$(dirname "$0")/.."

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  value="$(echo "$value" | sed -e 's/^["'\'']//' -e 's/["'\'']$//' | xargs)"
  [[ -z "$key" ]] && continue
  printf '%s' "$value" | vercel env add "$key" "$TARGET_ENV" --force >/dev/null 2>&1 || true
  echo "Synced: $key"
done < "$ENV_FILE"

echo "Done. Redeploy with: vercel --prod"
