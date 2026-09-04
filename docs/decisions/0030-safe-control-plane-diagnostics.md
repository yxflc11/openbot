# ADR-0030: Separate public failures, audit facts, and local diagnostics

- Status: Accepted
- Date: 2026-09-04

## Context

Worker Hosts sent raw exception messages in `run.failed`, and the Server persisted them. Artifact
errors followed the same pattern. Provider failures can contain credentials, request data, or local
filesystem paths, so bounded message length alone is not a disclosure control. Operational logging
also used raw `console` output even though `OPENBOT_LOG_LEVEL` was parsed, and asynchronous dispatch
failures were not persisted as safe audit facts.

The control plane needs stable public error classes, independently normalized Server records,
local structured diagnostics, and request/run/node correlation without logging headers, bodies,
tokens, credentials, or arbitrary error objects.

## Upstream review

- [Pino `10.3.1` / `6b344980`](https://github.com/pinojs/pino/tree/6b344980eae3ebed904fc87caf4bba0ab9dbe946)
  (MIT) provides structured JSON, levels, child bindings, and path-based redaction with active tests
  and releases.
- [Winston `3.19.0`](https://github.com/winstonjs/winston/tree/v3.19.0) (MIT) provides a broader
  transport/format pipeline. OpenBot does not need that additional configuration surface.
- [OWASP Logging Cheat Sheet `b8586414`](https://github.com/OWASP/CheatSheetSeries/blob/b8586414a5c47ae68911edb97d4e7b7bc6301035/cheatsheets/Logging_Cheat_Sheet.md)
  (CC BY-SA 4.0 documentation) says access tokens, passwords, database connection strings,
  encryption keys, and session identifiers must not be recorded directly.

## Reuse decision

Use Pino behind a narrow `@openbot/logging` API. Callers supply an allowlisted event name, message,
and bounded correlation identifiers, not arbitrary objects. Keep detailed exception diagnostics
local and sanitized. Define OpenBot's public Run failure vocabulary in its protocol and normalize it
again at the Server boundary because Node input is untrusted.

## Source incorporation

No upstream source or documentation is copied or substantially adapted. Pino is used through its
released API and recorded in the package lock, notice file, and reuse ledger.

## Verification plan

- Logger tests prove configured levels and redaction of credential/token/password/session fields.
- Node tests prove thrown messages containing a token or local path become a stable public code and
  generic message on the wire.
- Server tests prove arbitrary Node codes/text cannot enter Run or event records.
- Dispatcher tests prove background failures create one bounded audit event with phase/run/node
  correlation, and audit-write failure does not recurse.
- Request logging tests prove request id, method, route path, status, and duration are present while
  query strings, headers, and bodies are absent.

## Decision

1. The protocol exposes a bounded enum of public Run failure codes and generic messages.
2. The Server maps untrusted Node failure input to its own allowlisted code/message before durable
   persistence. Local artifact failures receive the same treatment.
3. Local diagnostics may include a sanitized error name and bounded summary, but never an arbitrary
   serialized error, stack, credential, token, request body/header, database URL, or local path.
4. Structured logs honor `OPENBOT_LOG_LEVEL` and carry stable request, run, and Node correlation
   fields where available. HTTP logs omit query strings.
5. Background dispatch failures produce a bounded `run_events` audit fact containing phase and
   public code. Failure to write that secondary fact is logged once and cannot recurse.
6. Pino remains replaceable behind the local interface; application code does not depend on its
   logger shape.

## Consequences

- Owner-facing Run history and events no longer double as an exception dump.
- Operators retain correlated local diagnostics, with less raw detail available by default.
- New public failure conditions require an explicit protocol vocabulary change and tests.
- This does not create a remote telemetry backend, metrics exporter, tracing service, or retention
  policy. Those remain separate operational designs.
