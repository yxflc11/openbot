---
title: "Create and manage Bots"
description: "Create and manage Bots — OpenBot"
---

A Bot is a persistent colleague with an identity, profile and reviewed capabilities. The Server owns that identity. A model cannot turn text such as “act as another Bot” into another colleague's permissions.

## Create a colleague

Use the workspace creation entry to create a Bot. Give it a short name, role and clear responsibilities. For a native model-based colleague, select the profile that does not require a computer. Open its profile to inspect identity, memories, skills and the evolution record. A direct conversation addresses only that Bot; a group channel can contain several colleagues.

## Memory, skills and evolution

Memories are explicit retained facts, not unrestricted access to every conversation. Skills can be imported from a `SKILL.md` document and move through review states. Only assigned, verified skills are available to a task. Learned proposals require review before they become durable authority or verified instructions. Suspending or revoking a skill removes access to future work.

The evolution view records changes and evidence. Its learning direction is inspired by [Hermes Agent](https://github.com/NousResearch/hermes-agent); OpenBot does not claim to have invented the learning-graph concept.

## Assignment and sharing

Join a Bot to a channel through the member menu. A colleague may delegate a bounded task to another member, which runs under the recipient's own permissions. Removing a member stops that colleague's active task tree while retaining historical messages and its profile. Sharing a Bot exports a reviewed portable package; it does not transfer your API keys or live permissions.
