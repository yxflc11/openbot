#!/usr/bin/env bash
set -euo pipefail

image="${OPENBOT_TEST_IMAGE:-openbot-server:smoke}"
case "${OPENBOT_TEST_PLATFORM:-$(uname -m)}" in
  amd64 | x86_64) expected_arch="amd64" ;;
  arm64 | aarch64) expected_arch="arm64" ;;
  *)
    echo "Unsupported Server container smoke architecture." >&2
    exit 1
    ;;
esac

suffix="${GITHUB_RUN_ID:-local}-$$"
network="openbot-server-smoke-${suffix}"
postgres_container="openbot-postgres-smoke-${suffix}"
server_container="openbot-server-smoke-${suffix}"
invalid_server_container="openbot-server-invalid-smoke-${suffix}"
object_volume="openbot-server-objects-${suffix}"
database_password="openbot-container-ci-only"

cleanup() {
  set +e
  docker rm --force "$server_container" >/dev/null 2>&1
  docker rm --force "$invalid_server_container" >/dev/null 2>&1
  docker rm --force "$postgres_container" >/dev/null 2>&1
  docker volume rm --force "$object_volume" >/dev/null 2>&1
  docker network rm "$network" >/dev/null 2>&1
}
trap cleanup EXIT

wait_for_health() {
  local container="$1"
  local health=""
  local state=""
  for _ in $(seq 1 60); do
    state="$(docker inspect --format '{{.State.Status}}' "$container")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container")"
    if [[ "$health" == "healthy" ]]; then
      return 0
    fi
    if [[ "$state" != "running" ]]; then
      docker logs "$container" >&2
      echo "Container $container stopped before becoming healthy." >&2
      return 1
    fi
    sleep 1
  done
  docker logs "$container" >&2
  echo "Container $container did not become healthy." >&2
  return 1
}

actual_arch="$(docker image inspect --format '{{.Architecture}}' "$image")"
if [[ "$actual_arch" != "$expected_arch" ]]; then
  echo "Expected image architecture $expected_arch, found $actual_arch." >&2
  exit 1
fi

runtime_version="$(docker run --rm --entrypoint node "$image" --version)"
if [[ "$runtime_version" != "v24.20.0" ]]; then
  echo "Expected Node v24.20.0, found $runtime_version." >&2
  exit 1
fi

runtime_uid="$(docker run --rm --entrypoint id "$image" -u)"
if [[ "$runtime_uid" == "0" ]]; then
  echo "Server image must not run as root." >&2
  exit 1
fi

docker run --rm --entrypoint node "$image" --input-type=commonjs --eval '
  const { existsSync } = require("node:fs");
  const requiredModules = ["hono", "@openbot/config", "@openbot/db", "@openbot/domain"];
  for (const name of requiredModules) require.resolve(name);
  const forbiddenModules = ["electron", "tsx", "turbo", "typescript", "vite", "vitest"];
  for (const name of forbiddenModules) {
    try {
      require.resolve(name);
      throw new Error(`Development or unrelated module is present: ${name}`);
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") throw error;
    }
  }
  const requiredPaths = [
    "apps/server/dist/index.js",
    "packages/db/migrations/meta/_journal.json",
    "deploy/server/healthcheck.mjs",
  ];
  for (const path of requiredPaths) {
    if (!existsSync(path)) throw new Error(`Required runtime path is missing: ${path}`);
  }
  const forbiddenPaths = [
    ".git",
    ".env",
    "apps/desktop",
    "apps/node",
    "apps/server/src",
    "apps/web",
    "docs",
    "packages/db/src",
    "providers",
  ];
  for (const path of forbiddenPaths) {
    if (existsSync(path)) throw new Error(`Non-runtime path is present: ${path}`);
  }
'

expected_migration_count="$(docker run --rm --entrypoint node "$image" --input-type=module --eval '
  import { readFile } from "node:fs/promises";
  const journal = JSON.parse(await readFile("packages/db/migrations/meta/_journal.json", "utf8"));
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) process.exit(1);
  console.log(journal.entries.length);
')"

docker network create "$network" >/dev/null
docker volume create "$object_volume" >/dev/null
docker run --detach \
  --name "$postgres_container" \
  --network "$network" \
  --env POSTGRES_DB=openbot \
  --env POSTGRES_USER=openbot \
  --env "POSTGRES_PASSWORD=$database_password" \
  --health-cmd "pg_isready -U openbot -d openbot" \
  --health-interval 1s \
  --health-timeout 3s \
  --health-retries 30 \
  postgres:17.11-bookworm >/dev/null
wait_for_health "$postgres_container"

database_url="postgres://openbot:${database_password}@${postgres_container}:5432/openbot"
docker run --detach \
  --name "$invalid_server_container" \
  --network "$network" \
  --env "OPENBOT_DATABASE_URL=$database_url" \
  "$image" >/dev/null
invalid_state=""
for _ in $(seq 1 10); do
  invalid_state="$(docker inspect --format '{{.State.Status}}' "$invalid_server_container")"
  [[ "$invalid_state" != "running" ]] && break
  sleep 1
done
if [[ "$invalid_state" == "running" ]]; then
  echo "Server image started without the required Owner password." >&2
  exit 1
fi
invalid_exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$invalid_server_container")"
if [[ "$invalid_exit_code" == "0" ]]; then
  echo "Server image accepted missing required configuration without an error." >&2
  exit 1
fi

docker run --detach \
  --name "$server_container" \
  --network "$network" \
  --publish 127.0.0.1::3001 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m,uid=1000,gid=1000,mode=0700 \
  --mount "type=volume,src=${object_volume},dst=/var/lib/openbot/objects" \
  --env OPENBOT_HOST=0.0.0.0 \
  --env OPENBOT_PORT=3001 \
  --env "OPENBOT_DATABASE_URL=$database_url" \
  --env OPENBOT_OWNER_NAME=Owner \
  --env OPENBOT_OWNER_PASSWORD=openbot-container-owner-password \
  --env OPENBOT_ALLOWED_ORIGINS=http://localhost:5173 \
  "$image" >/dev/null
wait_for_health "$server_container"

host_address="$(docker port "$server_container" 3001/tcp | sed -n '1p')"
health_body="$(curl --fail --silent --show-error "http://${host_address}/health")"
if ! grep --quiet '"ok":true' <<<"$health_body" ||
  ! grep --quiet '"service":"openbot-server"' <<<"$health_body"; then
  echo "Server container returned an unexpected health identity." >&2
  exit 1
fi

migration_count_before="$(docker exec "$postgres_container" \
  psql --username openbot --dbname openbot --tuples-only --no-align \
  --command 'select count(*) from drizzle.__drizzle_migrations;' | tr -d '[:space:]')"
if [[ "$migration_count_before" != "$expected_migration_count" ]]; then
  echo "Server container did not apply the complete PostgreSQL migration journal." >&2
  exit 1
fi

docker exec "$server_container" node --input-type=module --eval '
  import { writeFile } from "node:fs/promises";
  await writeFile("/var/lib/openbot/objects/container-smoke", "ok", { flag: "wx", mode: 0o600 });
'

docker restart --time 20 "$server_container" >/dev/null
wait_for_health "$server_container"
docker exec "$server_container" node --input-type=module --eval '
  import { readFile } from "node:fs/promises";
  if (await readFile("/var/lib/openbot/objects/container-smoke", "utf8") !== "ok") process.exit(1);
'

migration_count_after="$(docker exec "$postgres_container" \
  psql --username openbot --dbname openbot --tuples-only --no-align \
  --command 'select count(*) from drizzle.__drizzle_migrations;' | tr -d '[:space:]')"
if [[ "$migration_count_after" != "$migration_count_before" ]]; then
  echo "Server restart changed the applied migration count." >&2
  exit 1
fi

docker stop --time 20 "$server_container" >/dev/null
exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$server_container")"
if [[ "$exit_code" != "0" ]]; then
  docker logs "$server_container" >&2
  echo "Server container exited with status $exit_code after SIGTERM." >&2
  exit 1
fi

server_logs="$(docker logs "$server_container" 2>&1)"
if ! grep --quiet 'server.shutdown_started' <<<"$server_logs"; then
  echo "Server container did not record graceful shutdown." >&2
  exit 1
fi
if grep --quiet 'server.shutdown_failed' <<<"$server_logs"; then
  echo "Server container recorded a failed shutdown." >&2
  exit 1
fi

echo "Server container smoke passed for linux/${expected_arch} with ${migration_count_after} migrations."
