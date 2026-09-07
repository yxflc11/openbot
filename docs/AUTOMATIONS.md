# Automatic tasks

Automatic tasks repeat a prompt in a selected channel with a selected Bot. Open **Automatic tasks** in the Desktop sidebar, choose a Bot already in the channel, and set a first run and an interval. The Server stores the schedule and submits each occurrence through the same task, routing, approval, and audit path as a channel message.

## What the first version supports

- Create up to 50 schedules, each with a name, channel, Bot, prompt, first run, and an elapsed interval from 15 minutes to 7 days.
- Pause, resume, or delete a schedule. Pausing or deleting stops future submissions; it does not cancel a Run that was already submitted.
- View the next occurrence, previous attempt, and whether it was submitted, skipped because the previous Run is still active, or paused because the selected Bot is no longer in the channel.
- Open the channel to inspect the resulting Run. Scheduled messages are marked as system messages, and Server audit records link them to their schedule.

The hourly, daily, and weekly choices mean every 1, 24, and 168 elapsed hours. The first-run picker uses the computer's local time and saves the corresponding instant. These are fixed intervals: the local clock time can change across daylight-saving transitions or when you travel to a different time zone.

## Availability and approvals

The Server must remain running. For a local service computer, keep OpenBot running; quitting the app stops its local Server. A remote client does not need to stay open when its remote Server is running.

After downtime, the Server considers one late occurrence and advances directly to a future occurrence. It does not replay every missed interval. A schedule cannot submit another Run while its previous Run is queued, assigned, running, blocked, or waiting for approval. Resuming a paused schedule advances an expired occurrence to the future.

A schedule grants permission to submit its recorded prompt at the chosen interval. It never grants permission to bypass approval, select a different Bot, install a skill, or run arbitrary code in the Server. Actual execution still depends on the Bot's supported execution profile, available computer, and existing policy. Saving a model API configuration does not add model-driven execution where that capability is not yet implemented. A Bot with no supported execution profile can leave a Run queued, causing later occurrences to be skipped.

The first version does not include calendar cron expressions, daylight-saving-aware recurrence, immediate manual runs, schedule editing, or automatic retry of a failed Run. Pause/delete and create a replacement to change its prompt or timing. Submitted Runs keep their history after schedule deletion.

## API

All routes require an authenticated Owner session. Mutations also require a trusted Origin. API paths are relative to the connected Server:

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /api/v1/automations` | — | `{ automations: Automation[] }` |
| `POST /api/v1/automations` | `{ name, channelId, botId, prompt, intervalMinutes, firstRunAt }` | `201 { automation }` |
| `PATCH /api/v1/automations/:id` | `{ enabled: boolean }` | `{ automation }` |
| `DELETE /api/v1/automations/:id` | — | `{ deleted: true }` |

`firstRunAt` is an ISO 8601 UTC timestamp in the next 366 days. Names contain 1–80 characters; prompts 1–8,000 characters; intervals are integers from 15–10,080 minutes. Unknown fields are rejected. Creation bodies are limited to 32 KiB and update bodies to 1 KiB, including requests without Content-Length. A Server that has no automation store returns 503.

`Automation` contains the input fields except `firstRunAt`, plus `id`, `enabled`, `nextRunAt`, `lastRunAt`, `lastRunId`, `lastOutcome`, and `createdAt`. The last three run fields are nullable before an attempt; `lastOutcome` is `submitted`, `skipped_active`, or `target_unavailable`. `lastRunAt` is the most recent scheduling attempt, which may have skipped submission. `lastRunId` remains the last actual submitted Run.

POST has no idempotency key in this version. After a network failure, refresh the list before manually retrying creation.

## Verification

The interval calculation, scheduler coalescing, bounded shutdown, and authenticated API boundary have unit tests. The PostgreSQL integration suite tests two competing claimers, atomic rollback, durable records across store instances, overlap, pause/resume/delete, membership, the 50-record cap, and unchanged interactive task submission. No Worker or external model executes these fixtures.

To run the integration suite, point `OPENBOT_AUTOMATION_TEST_DATABASE_URL` at an empty, disposable, loopback PostgreSQL 17+ database named `openbot_automation_test_*`, then run:

```sh
npx vitest run apps/server/src/postgres-automation-store.integration.test.ts
```

The suite migrates and clears that database. It rejects other hostnames and database names. It is skipped when the dedicated variable is absent. This test is not a multi-Server dispatch certification: OpenBot's dispatcher and realtime infrastructure still have a single-Server boundary.

See [research](research/server-automations.md) for the reuse decision.
