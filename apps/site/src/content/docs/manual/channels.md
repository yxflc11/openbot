---
title: "Work in channels"
description: "Work in channels — OpenBot"
---

Channels hold the conversation, task history, attachments and Bot membership for a piece of work. Drafts are retained while you move between channels. Replies link back to their source message.

## Send and route a task

Type a message and use `@` to choose one or several members. **Everyone** selects current channel members, within the six-recipient limit. Sending without an explicit recipient uses the channel's coordinator when one is available, otherwise its first eligible Bot. A direct conversation has one fixed recipient.

The Server validates the whole recipient set before creating the message and tasks. At most six native root tasks run concurrently; the same Bot's work in the same channel is serialized. A normal new message creates new work—it does not silently modify an existing task.

## Collaboration and instructions

A Bot can start another member's task, continue its own work, then read the result. The channel shows who assigned the work and who replied. The parent gathers unread colleague results before final delivery. Each tree has at most two delegation levels and four descendants.

Use **Additional instructions** on the intended queued or running native task to correct it. Each task accepts at most eight instructions in total, each up to 4,000 characters; applying an instruction does not reset that limit. They take effect at the next model-step boundary and apply only to the selected task, not automatically to its siblings or delegated tasks. This cannot undo actions already performed. Add new attachments in a new message. **Stop task** stops the task and its descendants; retry creates new work.

## Channel members

Open the member menu at the channel header to add or remove a Bot. Removing a group-channel Bot cancels its active tasks and their descendants, while keeping messages and the Bot profile. Adding it again does not resume cancelled work. A direct conversation has fixed membership and does not allow removal.

## Message controls

Hover or focus a message to reveal the smile, reply and overflow icons beside the bubble. Pick an emoji for your own reaction. Copy, timestamp and task details are in the overflow menu. A reply quote jumps to its source. On touch or keyboard, focus the controls to reveal them; menus support Escape and arrow keys.

Supported providers show incremental text as a draft. MiniMax uses the guarded nonstreaming path and displays the final reply instead of partial text. A committed reply is the durable result. On reconnect, active drafts and stored messages reload; a Server crash marks interrupted tasks failed rather than replaying uncertain external actions. See [runtime boundaries](https://github.com/yxflc11/openbot/blob/main/docs/ASYNC_COLLABORATION.md).
