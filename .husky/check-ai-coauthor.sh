#!/usr/bin/env sh
set -eu

msg_file="$1"

pattern='^Co-authored-by:.*(claude|anthropic|noreply@anthropic\.com|openai|chatgpt|gpt-|codex|copilot|gemini|cursor)'

match=$(grep -iE "$pattern" "$msg_file" || true)

if [ -n "$match" ]; then
  echo "✖ AI co-authoring trailers are not allowed (found: $match). Remove the Co-Authored-By line and commit again." >&2
  exit 1
fi
