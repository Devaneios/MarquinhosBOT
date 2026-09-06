#!/usr/bin/env bash
# Refreshes the read-only source mirror bind-mounted into agent sandbox
# containers at /repo (see SandboxManager). Runs standalone on the host via
# cron/systemd timer, independent of either repo's CI pipeline.
#
# Uses `git archive` (not the staging clone itself) to materialize the
# mirror, so only committed, tracked content ever reaches it — no .git
# directory, no untracked files, no local .env left lying around even if
# someone's dev checkout has one.
set -euo pipefail

MIRROR_DIR="${SANDBOX_MIRROR_PATH:-/opt/marquinhos/sandbox-mirror}"
STAGING_DIR="${SANDBOX_MIRROR_STAGING_PATH:-${MIRROR_DIR}-staging}"

sync_repo() {
  local name="$1"
  local url="$2"
  local staging="$STAGING_DIR/$name"
  local target="$MIRROR_DIR/$name"

  if [ -d "$staging/.git" ]; then
    git -C "$staging" fetch --depth 1 origin main
    git -C "$staging" reset --hard origin/main
  else
    rm -rf "$staging"
    mkdir -p "$staging"
    git clone --depth 1 --branch main "$url" "$staging"
  fi

  rm -rf "$target"
  mkdir -p "$target"
  git -C "$staging" archive HEAD | tar -x -C "$target"
}

mkdir -p "$STAGING_DIR" "$MIRROR_DIR"

sync_repo "marquinhos-web-api" "https://github.com/Devaneios/marquinhos-web-api.git"
sync_repo "MarquinhosBOT" "https://github.com/Devaneios/MarquinhosBOT.git"
