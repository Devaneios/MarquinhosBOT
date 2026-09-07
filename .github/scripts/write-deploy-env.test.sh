#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf -- "$test_dir"' EXIT

if env -i PATH="$PATH" "$script_dir/write-deploy-env.sh" "$test_dir/missing.env" >/dev/null 2>&1; then
  echo "expected missing deployment settings to fail" >&2
  exit 1
fi

export BACKUP_DIR="$test_dir/backups"
export CORS_ORIGINS='https://one.example.test,https://two.example.test'
export DEPLOY_IMAGE_TAG='abc123'
export DISCORD_BOT_TOKEN='discord-bot-token'
export DISCORD_CLIENT_ID='client id'
export DISCORD_CLIENT_SECRET='discord-client-secret'
export DISCORD_REDIRECT_URI='https://web.example.test/discord/callback'
export LASTFM_API_KEY='lastfm-key'
export LASTFM_REDIRECT_URI='https://web.example.test/lastfm/callback'
export LASTFM_SHARED_SECRET='lastfm-secret'
export MARQUINHOS_API_KEY='api-key'
export MARQUINHOS_CRYPTO_SALT='crypto-salt'
export MARQUINHOS_DECRYPTION_KEY='decryption$key'
export MARQUINHOS_SECRET_KEY='secret-key'
export MARQUINHOS_TOKEN='bot-token'
export OPENAI_API_KEY='openai-key'
export SPOTIFY_CLIENT_ID='spotify-client'
export SPOTIFY_CLIENT_SECRET='spotify-secret'
export VITE_API_ORIGIN='https://activity.example.test'
export VITE_DISCORD_CLIENT_ID='discord-client-id'
export MARQUINHOS_WEB_URL='https://web.example.test/space path'

"$script_dir/write-deploy-env.sh" "$test_dir/deploy/.env"

[[ $(stat -c '%a' "$test_dir/deploy/.env") == 600 ]]
grep -Fq "CORS_ORIGINS='https://one.example.test,https://two.example.test'" "$test_dir/deploy/.env"
grep -Fq "DISCORD_CLIENT_ID='client id'" "$test_dir/deploy/.env"
grep -Fq "MARQUINHOS_WEB_URL='https://web.example.test/space path'" "$test_dir/deploy/.env"
! grep -Fq 'OPENAI_MODEL=' "$test_dir/deploy/.env"
grep -Fq "MARQUINHOS_WEB_URL='https://web.example.test/space path'" "$test_dir/deploy/bot.env"
grep -Fq "MARQUINHOS_DECRYPTION_KEY='decryption\$key'" "$test_dir/deploy/bot.env"
! grep -Fq 'MARQUINHOS_TOKEN=' "$test_dir/deploy/bot.env"
! grep -Fq 'OPENAI_API_KEY=' "$test_dir/deploy/api.env"
