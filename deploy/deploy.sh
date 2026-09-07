#!/usr/bin/env bash
set -euxo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <api|bot|activity|all>" >&2
  exit 2
fi

component=$1
root_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
env_file="$root_dir/deploy/.env"

[[ -f "$env_file" ]] || { echo "missing deployment environment file" >&2; exit 1; }
[[ -n "${BACKUP_DIR-}" ]] || { echo "BACKUP_DIR is required" >&2; exit 1; }

docker info >/dev/null
docker_gid=$(getent group docker | cut -d: -f3)
[[ -n "$docker_gid" ]] || { echo "docker group is required" >&2; exit 1; }

compose() {
  DOCKER_GID="$docker_gid" docker compose --env-file "$env_file" -f "$root_dir/deploy/docker-compose.yml" "$@"
}

tag_rollback_image() {
  local container=$1
  local image=$2
  local current_image

  current_image=$(docker inspect --format '{{.Config.Image}}' "$container" 2>/dev/null || true)
  [[ -n "$current_image" ]] && docker tag "$current_image" "$image:rollback"
  return 0
}

tag_sandbox_rollback_image() {
  local current_image

  current_image=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' marquinhos-api 2>/dev/null | sed -n 's/^SANDBOX_IMAGE=//p')
  [[ -n "$current_image" ]] && docker tag "$current_image" marquinhos-sandbox:rollback
  return 0
}

backup_api_data() {
  local timestamp

  install -d -m 700 "$BACKUP_DIR"
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  docker run --rm \
    -v marquinhos-api-data:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine:3.21 \
    tar -C /data -czf "/backup/marquinhos-api-$timestamp.tar.gz" .
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'marquinhos-api-*.tar.gz' -mtime +14 -delete
}

rollback_api() {
  if docker image inspect marquinhos-api:rollback >/dev/null 2>&1; then
    DEPLOY_IMAGE_TAG=rollback compose up --detach --no-deps --force-recreate --wait --wait-timeout 90 api
  fi
}

rollback_bot() {
  if docker image inspect marquinhos-bot:rollback >/dev/null 2>&1; then
    DEPLOY_IMAGE_TAG=rollback compose up --detach --no-deps --force-recreate --wait --wait-timeout 90 bot
  fi
}

rollback_activity() {
  if docker image inspect marquinhos-activity:rollback >/dev/null 2>&1; then
    DEPLOY_IMAGE_TAG=rollback compose up --detach --no-deps --force-recreate --wait --wait-timeout 90 gateway
  fi
}

deploy_api() {
  backup_api_data
  tag_rollback_image marquinhos-api marquinhos-api
  tag_sandbox_rollback_image
  compose build api sandbox
  if ! compose up --detach --no-deps --force-recreate --wait --wait-timeout 90 api; then
    docker logs marquinhos-api --tail 200 2>&1 || true
    rollback_api || true
    exit 1
  fi
}

deploy_bot() {
  tag_rollback_image marquinhos-bot marquinhos-bot
  compose build bot
  if ! compose up --detach --no-deps --force-recreate --wait --wait-timeout 120 bot; then
    docker logs marquinhos-bot --tail 200 2>&1 || true
    rollback_bot || true
    exit 1
  fi
}

deploy_activity() {
  tag_rollback_image marquinhos-gateway marquinhos-activity
  compose build gateway
  if ! compose up --detach --no-deps --force-recreate --wait --wait-timeout 90 gateway; then
    docker logs marquinhos-gateway --tail 200 2>&1 || true
    rollback_activity || true
    exit 1
  fi
}

case "$component" in
  api)
    deploy_api
    ;;
  bot)
    deploy_bot
    ;;
  activity)
    deploy_activity
    ;;
  all)
    deploy_api
    deploy_bot
    deploy_activity
    ;;
  *)
    echo "unknown deployment component: $component" >&2
    exit 2
    ;;
esac
