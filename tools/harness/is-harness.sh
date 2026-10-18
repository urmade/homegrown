#!/usr/bin/env bash
# Reads changed paths on stdin (use git diff --name-only --no-renames, so renames list both sides).
# Exits 0 if any path is a harness path. .github/CODEOWNERS is the single definition of harness paths.
set -euo pipefail
OWNERS="${CODEOWNERS_FILE:-$(dirname "$0")/../../.github/CODEOWNERS}"
pattern=$(grep -vE '^[[:space:]]*(#|$)' "$OWNERS" | awk '{print $1}' | sed -E 's#^/##; s#\.#\\.#g; s#/$#/.*#; s#^#^#; s#$#$#' | paste -sd'|')
grep -qE "$pattern"
