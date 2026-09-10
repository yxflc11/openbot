---
title: "Schedule repeatable work"
description: "Schedule repeatable work — OpenBot"
---

Automations create scheduled assignments for a selected Bot and channel. They reuse the same Server task boundary, model configuration and tool grants as manual work.

Create an automation from the workspace automation destination. Choose the destination Bot and channel, write a specific task, and select its schedule. Review the next execution before enabling it. Pause, resume or delete the automation. To change its prompt or timing, create a new automation and remove the old one.

A scheduled invocation creates a new Run and a channel message. Its result, failures and artifacts remain in the normal task history. Removing a Bot's membership or permissions does not grant the scheduler a bypass. The Bot must still be eligible when the task is created and executed.

Scheduled work can use model or external service quotas. Keep the task bounded, avoid duplicate schedules, and inspect failures before manually resubmitting. A Server must be running for its local scheduler to operate. Sleeping or closed Desktop is not an always-on hosted service, and interrupted external operations are not automatically replayed.
