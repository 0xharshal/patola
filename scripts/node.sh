#!/usr/bin/env bash
# Run a command inside a Node container with the project mounted at /app.
# Nothing is installed on the host; node_modules lives in the project folder.
#
#   scripts/node.sh npm install
#   scripts/node.sh npm run dev       # http://localhost:5173
#   scripts/node.sh npm run dev:https # https://<this computer's IP>:5173 for phones (self-signed)
#   scripts/node.sh npm test
#   scripts/node.sh npm run build     # output in dist/
#
# Servers listen on all interfaces, so other devices on the network can open them
# (http://<this machine's IP>:5173). PUBLISH_ADDRESS=127.0.0.1 keeps them local.
#
# Env overrides: CONTAINER_ENGINE=podman|docker, NODE_IMAGE=<image>, PUBLISH_ADDRESS=<ip>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The Node version lives in .node-version (also used by CI).
IMAGE="${NODE_IMAGE:-docker.io/library/node:$(<"$ROOT/.node-version")-alpine}"

ENGINE="${CONTAINER_ENGINE:-}"
if [[ -z "$ENGINE" ]]; then
  if command -v podman >/dev/null 2>&1; then ENGINE=podman
  elif command -v docker >/dev/null 2>&1; then ENGINE=docker
  else echo "error: podman or docker is required" >&2; exit 1
  fi
fi

# Edits made from the host replace files, which inotify inside the container can miss:
# poll instead so the dev server always serves the current code.
args=(run --rm --init -v "$ROOT":/app:Z -w /app -e HOME=/tmp -e CHOKIDAR_USEPOLLING=true -e CHOKIDAR_INTERVAL=300)
[[ -t 0 && -t 1 ]] && args+=(-it)

# Rootless podman maps container root to your user; docker needs an explicit uid.
if [[ "$ENGINE" == docker ]]; then
  args+=(--user "$(id -u):$(id -g)")
fi

# Publish each server's own port, so the dev server (5173) and preview (4173) can run together.
address="${PUBLISH_ADDRESS:-0.0.0.0}"
if [[ " $* " == *" dev "* || " $* " == *" dev:https "* ]]; then
  args+=(-p "$address:5173:5173")
elif [[ " $* " == *" preview "* ]]; then
  args+=(-p "$address:4173:4173")
fi

exec "$ENGINE" "${args[@]}" "$IMAGE" "$@"
