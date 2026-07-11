#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <neloo-image>" >&2
  exit 2
fi

image="$1"
suffix="${RANDOM}-$$"
network="neloo-smoke-${suffix}"
postgres="neloo-postgres-${suffix}"
redis="neloo-redis-${suffix}"
app="neloo-app-${suffix}"
secret="test-anonymous-secret-at-least-32-bytes" # gitleaks:allow

cleanup() {
  docker rm -f "$app" "$postgres" "$redis" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

report_error() {
  local status="$?"
  local line="$1"
  echo "Docker runtime smoke failed at line ${line} for ${image}" >&2
  docker logs "$app" >&2 2>/dev/null || true
  return "$status"
}
trap 'report_error $LINENO' ERR

docker network create "$network" >/dev/null
docker run -d --name "$postgres" --network "$network" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=neloo \
  postgres:16-alpine >/dev/null
docker run -d --name "$redis" --network "$network" redis:7-alpine >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$postgres" pg_isready -U postgres -d neloo >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$postgres" pg_isready -U postgres -d neloo >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$redis" redis-cli ping 2>/dev/null | grep -q PONG; then
    break
  fi
  sleep 1
done
docker exec "$redis" redis-cli ping | grep -q PONG

ready=false
base_url=""
for attempt in 1 2; do
  docker rm -f "$app" >/dev/null 2>&1 || true
  if ! docker run -d --name "$app" --network "$network" -p 127.0.0.1::8000 \
    -e PORT=8000 \
    -e ENVIRONMENT=production \
    -e DATABASE_URL="postgresql://postgres:postgres@${postgres}:5432/neloo" \
    -e RATE_LIMIT_REDIS_URL="redis://${redis}:6379/0" \
    -e ALLOW_ANONYMOUS=true \
    -e ALLOW_INSECURE_LOCAL_TOKENS=false \
    -e ANONYMOUS_SESSION_SECRET="$secret" \
    -e DEEPSEEK_API_KEY=test-runtime-smoke-key \
    -e FILE_SECRET_KEY=test-file-secret-at-least-32-bytes \
    -e IMAGE_SECRET_KEY=test-image-secret-at-least-32-bytes \
    "$image" >/dev/null; then
    echo "Container failed to start on attempt ${attempt}" >&2
    continue
  fi

  host_port=""
  for _ in $(seq 1 10); do
    host_port="$(docker port "$app" 8000/tcp 2>/dev/null | awk -F: 'NR == 1 {print $NF}' || true)"
    if [[ -n "$host_port" ]]; then
      break
    fi
    sleep 1
  done
  if [[ -z "$host_port" ]]; then
    echo "Container port was not published on attempt ${attempt}" >&2
    docker logs "$app" >&2 2>/dev/null || true
    continue
  fi

  base_url="http://127.0.0.1:${host_port}"
  for _ in $(seq 1 120); do
    if curl --silent --fail "${base_url}/live" >/dev/null 2>&1; then
      ready=true
      break
    fi
    if [[ "$(docker inspect -f '{{.State.Running}}' "$app")" != "true" ]]; then
      break
    fi
    sleep 1
  done
  if [[ "$ready" == "true" ]]; then
    break
  fi
  echo "Container did not become live on attempt ${attempt}" >&2
  docker logs "$app" >&2 2>/dev/null || true
  sleep 1
done
if [[ "$ready" != "true" ]]; then
  echo "Container did not become live: $image" >&2
  exit 1
fi

unauthenticated_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  -X POST -H 'Content-Type: application/json' -d '{}' "${base_url}/threads/search")"
if [[ "$unauthenticated_status" != "401" ]]; then
  echo "Expected unauthenticated thread search to return 401, got ${unauthenticated_status}" >&2
  exit 1
fi

token="$(SECRET="$secret" python3 - <<'PY'
import base64
import hashlib
import hmac
import json
import os
import time
import uuid

payload = json.dumps(
    {"sub": str(uuid.uuid4()), "exp": int(time.time()) + 300},
    separators=(",", ":"),
).encode()
encoded = base64.urlsafe_b64encode(payload).decode().rstrip("=")
signature = hmac.new(os.environ["SECRET"].encode(), encoded.encode(), hashlib.sha256).hexdigest()
print(f"neloo-anon-v1.{encoded}.{signature}")
PY
)"
models_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  -H "Authorization: Bearer ${token}" "${base_url}/api/models")"
if [[ "$models_status" != "200" ]]; then
  docker logs "$app" >&2
  echo "Expected authenticated model list to return 200, got ${models_status}" >&2
  exit 1
fi

echo "Docker runtime smoke passed: $image"
