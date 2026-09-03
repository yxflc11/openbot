# ADR-0008：频道消息到持久化任务

- 状态：Accepted
- 日期：2026-09-03

## 背景

上一阶段的频道输入只保存为消息。办公室因此无法可靠回答“谁接到了什么任务”，刷新或 Server 重启后也没有独立的工作状态可恢复。让 Web 根据聊天文本猜测任务会造成多个设备不一致，也会把分派权限交给 Client。

## 决策

`POST /api/v1/channels/:channelId/messages` 作为 M0 的任务入口，在一个 PostgreSQL 事务内创建：

1. 一条 `human` message；
2. 一条关联该消息的 `queued` Run；
3. `MESSAGE_CREATED` 与 `RUN_CREATED` 结构化事件。

显式 `botId` 必须属于频道 roster。没有显式指派时，Server 优先选择名称或职责匹配 Chief、总管、协调、调度的成员；没有这类成员时，稳定回退到 roster 首位成员。空频道拒绝接单。

Run 的 `source_message_id` 使用部分唯一索引；这样历史消息可以不绑定 Run，同时每条任务输入最多生成一个 Run。Web 从 workspace/channel 快照读取 Run，并通过 `run.created` SSE 增量更新频道任务卡、办公室工位与右栏。

## 结果

- 消息、任务和事件不会出现只写入一半的状态。
- 多设备、刷新和 Server 重启看到同一任务投影。
- 分派边界由 Server 控制，Client 与模型不能指定频道外 Bot。
- 全局 Run 列表与频道 Run 列表都有与排序方式匹配的索引。

## 当前限制

M0 只创建 `queued` Run；尚未连接 Node 调度、状态机、审批、产物或执行结果。后续状态变化必须继续写结构化事件，不能回退到解析消息文本。
