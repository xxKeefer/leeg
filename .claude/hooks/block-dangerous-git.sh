#!/usr/bin/env bash
# Claude Code PreToolUse hook -- blocks dangerous git commands.
# Receives tool input as JSON on stdin (with "command" field).

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

# Patterns to block
BLOCKED_PATTERNS=(
  'git push'
  'git reset --hard'
  'git clean -f'
  'git clean -fd'
  'git branch -D'
  'git checkout \.'
  'git restore \.'
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'"
    echo "Ask the user for explicit permission before running this command."
    exit 2
  fi
done

exit 0
