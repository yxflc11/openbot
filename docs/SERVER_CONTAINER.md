# Server container

[English](SERVER_CONTAINER.md) · [简体中文](SERVER_CONTAINER.zh-CN.md)

The source-built Server image uses Node.js `24.20.0` LTS on Debian Bookworm slim, pinned to the
reviewed multi-platform digest in [the Dockerfile](../deploy/server/Dockerfile). The build uses
npm `10.9.9`, prunes the monorepo to the Server and its six internal runtime workspaces, and copies
only their compiled output, production dependencies, package metadata, and database migrations
into the final image. The official base retains its bundled npm and license notices.

This is a pre-alpha deployment baseline. Local arm64 Docker Desktop build and lifecycle tests
passed; CI requires separate native Linux amd64 and arm64 runs. Neither a local test nor a green
hosted run establishes general production or host-platform support. No registry image is published
by this workflow. The separately attested Worker runtime remains on Node `22.22.2`.

## Build and run from source

From the repository root, create `.env` from `.env.example` if it does not already exist. Set a
random `OPENBOT_OWNER_PASSWORD` of at least 15 characters and a separate random
`OPENBOT_POSTGRES_PASSWORD`. The current Compose file embeds the database password in a URI: use
a long random URL-safe value, such as 64 hexadecimal characters. Delimiters such as `/`, `?`, `#`,
`@`, and `%` require a separately reviewed encoding change. The development database default is
not a production secret. Protect `.env` and keep it out of version control.

```bash
docker compose --env-file .env -f deploy/server/compose.yaml config --quiet
docker compose --env-file .env -f deploy/server/compose.yaml up --build -d
docker compose --env-file .env -f deploy/server/compose.yaml ps
curl --fail http://127.0.0.1:3001/health
```

Stop an existing source-development Server before using the same port. Web and Worker services
are separate; this image does not include either client or a computer Provider. Both published
ports remain bound to loopback. Follow the existing private-network, TLS, cookie, and origin
requirements before connecting a remote client.

The Server runs as UID/GID `1000`, with a read-only root filesystem, a private 16 MiB temporary
filesystem, and an explicit writable object volume. PostgreSQL has its own persistent volume.
For an existing deployment, first back up both stores using [database operations](DATABASE.md).
An object volume written by the former root-running image may need an operator-reviewed ownership
migration to UID/GID `1000`. Existing volume ownership is not automatically changed; a new-volume
smoke test does not prove an existing-volume upgrade. Do not delete the volume to fix permissions.

```bash
docker compose --env-file .env -f deploy/server/compose.yaml stop
```

Compose allows 20 seconds for shutdown. The Server has a 10-second HTTP drain before final cleanup.
Current integration evidence covers a healthy, idle Server; startup interruption, busy dispatch,
and stalled database shutdown still need lifecycle tests. `/health` checks process identity and
startup completion, not continuous database readiness. PostgreSQL still uses a version tag rather
than an immutable digest, so the complete stack is not claimed to be byte-for-byte reproducible.

## Reproduce verification

Run `npm run server:container:check` and `npm run check` for the repository contracts. On each native
target, build with `docker build --platform linux/arm64 --tag openbot-server:smoke --file
deploy/server/Dockerfile .` (use `linux/amd64` on amd64), then run:

```bash
OPENBOT_TEST_IMAGE=openbot-server:smoke OPENBOT_TEST_PLATFORM=arm64 bash scripts/smoke-server-container.sh
```

Use `amd64` for the corresponding target. The smoke creates and removes only its temporary test
containers, network, and object volume. It checks runtime architecture, non-root identity,
dependency inventory, missing-password rejection, all 18 current migrations, health identity,
object persistence, migration idempotence, and zero-exit SIGTERM. It does not publish artifacts.

See [upstream research and remaining risks](research/server-node24-production-container.md).
