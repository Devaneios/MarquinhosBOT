#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <target>" >&2
  exit 2
fi

target=$1

required_keys=(
  BACKUP_DIR
  CORS_ORIGINS
  DEPLOY_IMAGE_TAG
  DISCORD_BOT_TOKEN
  DISCORD_CLIENT_ID
  DISCORD_CLIENT_SECRET
  DISCORD_REDIRECT_URI
  LASTFM_API_KEY
  LASTFM_REDIRECT_URI
  LASTFM_SHARED_SECRET
  MARQUINHOS_API_KEY
  MARQUINHOS_CRYPTO_SALT
  MARQUINHOS_SECRET_KEY
  MARQUINHOS_TOKEN
  OPENAI_API_KEY
  SPOTIFY_CLIENT_ID
  SPOTIFY_CLIENT_SECRET
  VITE_API_ORIGIN
  VITE_DISCORD_CLIENT_ID
)

optional_keys=(
  AI_RESEARCH_DEADLINE_MS
  AI_RESEARCH_MAX_FETCHES
  AI_RESEARCH_MAX_ROUNDS
  AI_RESEARCH_RETENTION_DAYS
  AI_THREAD_RETENTION_DAYS
  AI_THREAD_TOKEN_BUDGET
  AI_TRACE_ENABLED
  AI_TRACE_RETENTION_DAYS
  DEEZER_ARL_COOKIE
  GUILD_EXTERNAL_ROLE_ID
  GUILD_MAIN_CHANNEL_ID
  GUILD_NEWCOMERS_CHANNEL_ID
  KNOWLEDGE_BASE_API_KEY
  KNOWLEDGE_BASE_URL
  LOG_LEVEL
  MARQUINHOS_DECRYPTION_KEY
  MARQUINHOS_ERROR_DM_USER_ID
  MARQUINHOS_SPREADSHEET_API_KEY
  MARQUINHOS_SPREADSHEET_ID
  MARQUINHOS_WEB_URL
  OPENAI_MODEL
  OPENAI_REASONING_EFFORT
  SANDBOX_MIRROR_PATH
  SEARXNG_URL
  WORDLE_TIMEZONE
)

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
api_tmp_file=$(mktemp "$target_dir/.api.env.XXXXXX")
bot_tmp_file=$(mktemp "$target_dir/.bot.env.XXXXXX")
trap 'rm -f -- "$tmp_file" "$api_tmp_file" "$bot_tmp_file"' EXIT
chmod 600 "$tmp_file"
chmod 600 "$api_tmp_file" "$bot_tmp_file"

write_key() {
  local key=$1
  local file=$2
  local value=${!key-}
  local escaped

  [[ -n "$value" ]] || return 0
  escaped=${value//\'/\\\'}
  printf "%s='%s'\n" "$key" "$escaped" >> "$file"
}

for key in "${required_keys[@]}" "${optional_keys[@]}"; do
  write_key "$key" "$tmp_file"
done

api_optional_keys=(
  AI_RESEARCH_DEADLINE_MS
  AI_RESEARCH_MAX_FETCHES
  AI_RESEARCH_MAX_ROUNDS
  AI_RESEARCH_RETENTION_DAYS
  AI_THREAD_RETENTION_DAYS
  AI_THREAD_TOKEN_BUDGET
  AI_TRACE_ENABLED
  AI_TRACE_RETENTION_DAYS
  KNOWLEDGE_BASE_API_KEY
  KNOWLEDGE_BASE_URL
  LOG_LEVEL
  OPENAI_MODEL
  OPENAI_REASONING_EFFORT
  SANDBOX_MIRROR_PATH
  SEARXNG_URL
  WORDLE_TIMEZONE
)

bot_optional_keys=(
  DEEZER_ARL_COOKIE
  GUILD_EXTERNAL_ROLE_ID
  GUILD_MAIN_CHANNEL_ID
  GUILD_NEWCOMERS_CHANNEL_ID
  MARQUINHOS_DECRYPTION_KEY
  MARQUINHOS_ERROR_DM_USER_ID
  MARQUINHOS_SPREADSHEET_API_KEY
  MARQUINHOS_SPREADSHEET_ID
  MARQUINHOS_WEB_URL
)

for key in "${api_optional_keys[@]}"; do
  write_key "$key" "$api_tmp_file"
done

for key in "${bot_optional_keys[@]}"; do
  write_key "$key" "$bot_tmp_file"
done

mv -f -- "$tmp_file" "$target"
mv -f -- "$api_tmp_file" "$target_dir/api.env"
mv -f -- "$bot_tmp_file" "$target_dir/bot.env"
trap - EXIT
