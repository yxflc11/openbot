# Desktop 附件上传代理例外

[English](desktop-attachment-proxy.md) · [简体中文](desktop-attachment-proxy.zh-CN.md)

2026-09-11。现有复用记录见 Desktop Server 连接调研、ADR-0042 与开源复用账本。主进程代理原先只
转发 `accept`、`content-type`、`if-match`、`last-event-id`，请求体上限 3 MiB。渲染进程按
`application/octet-stream` POST 频道附件，并带百分号编码的 `X-OpenBot-Filename`（含中文文件名）。
Server 路由需要该头；代理剥掉后出现 “Missing attachment filename”。大于 3 MiB、仍在任务附件预算内
的正文也会被丢弃。

复查已固定的 Electron **44.2.0** `Session.fetch` / `protocol.handle` 组合（官方文档站点可能
409，沿用 desktop-server-connection.md 中的 44.2.0 证据，不再新拉文档）。不新增依赖，不复制上游
实现。全局放大自定义头或把全部 API 升到 20 MiB 都会扩大已审查适配器的攻击面。

只对精确路径 `POST /api/v1/channels/:channelId/attachments`（`channelId` 为单段，风格与现有
channel events 正则一致）额外转发 `x-openbot-filename`，并把正文上限改为与 Server
`MAX_TASK_ATTACHMENT_BYTES`（20 MiB）一致。嵌套的 cleanup / process / restore / id 路由以及
其余 API 仍用 3 MiB 与原四头白名单。凭据头继续拒绝；`X-Renderer-Secret` 等任意自定义头仍丢弃。
Server 仍对类型、文件名和存储策略有最终权威。无需新的复用账本行。

验证：文件名与二进制（含 0 字节）转发、中文百分号编码文件名、上传路由 3 MiB 以上且不超过 20 MiB
可通过、超过 20 MiB 返回 413 且不发网络、无关 POST 仍在 3 MiB 处 413 且不转发该头、附件路由仍拒绝
Authorization。运行 `npm run check`。
