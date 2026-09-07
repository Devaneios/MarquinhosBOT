#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf -- "$test_dir"' EXIT

if env -i PATH="$PATH" "$script_dir/write-deploy-env.sh" bot "$test_dir/missing.env" >/dev/null 2>&1; then
  echo "expected missing bot settings to fail" >&2
  exit 1
fi

export MARQUINHOS_TOKEN='bot-token'
export MARQUINHOS_API_URL='https://api.example.test/path?x=1#fragment'
export MARQUINHOS_API_KEY='api-key'
export MARQUINHOS_CLIENT_ID='client id'
export MARQUINHOS_WEB_URL='https://web.example.test/space path'
export GUILD_MAIN_CHANNEL_ID=''

"$script_dir/write-deploy-env.sh" bot "$test_dir/bot/.env"
[[ $(stat -c '%a' "$test_dir/bot/.env") == 600 ]]
grep -Fq 'MARQUINHOS_API_URL="https://api.example.test/path?x=1#fragment"' "$test_dir/bot/.env"
grep -Fq 'MARQUINHOS_CLIENT_ID="client id"' "$test_dir/bot/.env"
grep -Fq 'MARQUINHOS_WEB_URL="https://web.example.test/space path"' "$test_dir/bot/.env"
! grep -Fq 'GUILD_MAIN_CHANNEL_ID=' "$test_dir/bot/.env"

export HTTP_PORT='3000'
export MARQUINHOS_SECRET_KEY='secret'
export DISCORD_BOT_TOKEN='discord-token'
export DISCORD_CLIENT_ID='discord-client'
export DISCORD_CLIENT_SECRET='discord-secret'
export DISCORD_REDIRECT_URI='https://web.example.test/oauth/callback'
export LASTFM_API_KEY='lastfm-key'
export LASTFM_SHARED_SECRET='lastfm-secret'
export LASTFM_REDIRECT_URI='https://web.example.test/lastfm/callback'
export SPOTIFY_CLIENT_ID='spotify-client'
export SPOTIFY_CLIENT_SECRET='spotify-secret'
export OPENAI_API_KEY='openai-key'
export CORS_ORIGINS=$'https://one.example.test\nhttps://two.example.test'

"$script_dir/write-deploy-env.sh" api "$test_dir/api/.env"
grep -Fq 'CORS_ORIGINS="https://one.example.test\nhttps://two.example.test"' "$test_dir/api/.env"
! grep -Fq 'OPENAI_MODEL=' "$test_dir/api/.env"
