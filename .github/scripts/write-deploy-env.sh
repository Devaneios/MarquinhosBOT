#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <bot|api> <target>" >&2
  exit 2
fi

app=$1
target=$2

case "$app" in
  bot)
    required_keys=(
      MARQUINHOS_TOKEN
      MARQUINHOS_API_URL
      MARQUINHOS_API_KEY
      MARQUINHOS_CLIENT_ID
    )
    optional_keys=(
      MARQUINHOS_ERROR_DM_USER_ID
      MARQUINHOS_DECRYPTION_KEY
      MARQUINHOS_WEB_URL
      DEEZER_ARL_COOKIE
      GUILD_MAIN_CHANNEL_ID
      GUILD_EXTERNAL_ROLE_ID
      GUILD_NEWCOMERS_CHANNEL_ID
      MARQUINHOS_SPREADSHEET_ID
      MARQUINHOS_SPREADSHEET_API_KEY
    )
    ;;
  api)
    required_keys=(
      HTTP_PORT
      MARQUINHOS_API_KEY
      MARQUINHOS_SECRET_KEY
      DISCORD_BOT_TOKEN
      DISCORD_CLIENT_ID
      DISCORD_CLIENT_SECRET
      DISCORD_REDIRECT_URI
      LASTFM_API_KEY
      LASTFM_SHARED_SECRET
      LASTFM_REDIRECT_URI
      SPOTIFY_CLIENT_ID
      SPOTIFY_CLIENT_SECRET
      OPENAI_API_KEY
    )
    optional_keys=(
      BENCH_GUILD_ID
      HTTPS_PORT
      CORS_ORIGINS
      KNOWLEDGE_BASE_URL
      KNOWLEDGE_BASE_API_KEY
      OPENAI_MODEL
      OPENAI_REASONING_EFFORT
      SEARXNG_URL
      AI_THREAD_TOKEN_BUDGET
      AI_THREAD_RETENTION_DAYS
      AI_RESEARCH_MAX_ROUNDS
      AI_RESEARCH_MAX_SEARCHES
      AI_RESEARCH_MAX_FETCHES
      AI_RESEARCH_DEADLINE_MS
      AI_RESEARCH_RETENTION_DAYS
      AI_TRACE_ENABLED
      AI_TRACE_RETENTION_DAYS
      LOG_LEVEL
      MARQUINHOS_CRYPTO_SALT
      WORDLE_TIMEZONE
      SANDBOX_MIRROR_PATH
    )
    ;;
  *)
    echo "unknown app: $app" >&2
    exit 2
    ;;
esac

missing_keys=()
for key in "${required_keys[@]}"; do
  [[ -n "${!key-}" ]] || missing_keys+=("$key")
done

if ((${#missing_keys[@]} > 0)); then
  printf 'missing required deployment settings: %s\n' "${missing_keys[*]}" >&2
  exit 1
fi

target_dir=$(dirname -- "$target")
mkdir -p -- "$target_dir"
umask 077
tmp_file=$(mktemp "$target_dir/.env.XXXXXX")
trap 'rm -f -- "$tmp_file"' EXIT
chmod 600 "$tmp_file"

write_key() {
  local key=$1
  local value=${!key-}
  local escaped

  [[ -n "$value" ]] || return 0
  escaped=${value//\\/\\\\}
  escaped=${escaped//\"/\\\"}
  escaped=${escaped//$'\n'/\\n}
  escaped=${escaped//$'\r'/\\r}
  printf '%s="%s"\n' "$key" "$escaped" >> "$tmp_file"
}

for key in "${required_keys[@]}" "${optional_keys[@]}"; do
  write_key "$key"
done

mv -f -- "$tmp_file" "$target"
trap - EXIT
