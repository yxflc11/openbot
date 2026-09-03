# 本地 API（M0 + M1）

所有接口由 OpenBot Server 提供，开发环境默认地址为 `http://localhost:3001`。除健康检查、会话状态和登录外，所有 `/api/v1` 接口都要求有效的本地 Owner Session。Server 不应直接暴露到公网；远程使用优先通过 Tailscale 与 HTTPS。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/health` | Server 存活状态 |
| `GET` | `/api/v1/auth/session` | 读取当前 Owner 会话状态 |
| `POST` | `/api/v1/auth/login` | 使用部署密码创建 Owner Session |
| `POST` | `/api/v1/auth/logout` | 撤销当前 Session 并清除 Cookie |
| `GET` | `/api/v1/bootstrap` | 轻量计数与阶段信息 |
| `GET` | `/api/v1/workspace` | 频道、Bot、Node、Run、Approval、Progress、Artifact 和计数的一次性投影 |
| `GET` | `/api/v1/workspace/events` | 订阅全局 Node、Run 与 Approval 变化（SSE） |
| `GET` | `/api/v1/channels` | 频道与 Bot roster |
| `POST` | `/api/v1/channels` | 创建频道并原子加入初始 Bot |
| `POST` | `/api/v1/channels/:channelId/bots` | 把已有 Bot 加入频道 |
| `GET` | `/api/v1/channels/:channelId/messages` | 读取最近 100 条本地频道消息与 Bot 回复关系 |
| `POST` | `/api/v1/channels/:channelId/messages` | 原子保存用户消息并创建排队任务 |
| `GET` | `/api/v1/channels/:channelId/runs` | 读取频道最近 50 个任务 |
| `GET` | `/api/v1/channels/:channelId/events` | 订阅频道实时事件（SSE） |
| `POST` | `/api/v1/approvals/:approvalId/decision` | Owner 批准一次或拒绝一个待批动作 |
| `GET` | `/api/v1/artifacts/:artifactId/content` | 鉴权读取任务产物；当前仅 PNG 截图 |
| `GET` | `/api/v1/runs/:runId/frame` | 鉴权读取任务最新临时画面；不持久化 |
| `GET` | `/api/v1/bots` | Bot 名册 |
| `POST` | `/api/v1/bots` | 创建 Bot |
| `GET` | `/api/v1/bots/:botId/profile` | 读取数字员工档案、进化、技能、记忆与工作记录 |
| `GET` | `/api/v1/bots/:botId/export/preview` | 预览默认脱敏员工模板及全部排除项 |
| `GET` | `/api/v1/bots/:botId/export` | 下载通过安全检查的员工模板 JSON |
| `POST` | `/api/v1/employees/import/preview` | 在隔离区严格检查员工模板，不写入任何员工数据 |
| `GET` | `/api/v1/nodes` | 当前在线执行节点 |

在线 Node 投影包含 `platform`、`osVersion`、`architecture`、`deviceClass`、`isolation`、
`trustTier`、旧版 `capabilities` 和版本化 `capabilityManifest`。当前路由仍使用旧版能力 id；
manifest 用于兼容性展示和后续策略迁移，本身不授予执行权限。

## 本地 Owner 会话

登录请求：

```json
{
  "password": "部署时设置的 OPENBOT_OWNER_PASSWORD"
}
```

成功后 Server 设置 `openbot_session` Cookie：`HttpOnly`、`SameSite=Strict`、`Path=/`，有效期由 `OPENBOT_SESSION_TTL_HOURS` 控制。生产环境必须设置 `OPENBOT_SECURE_COOKIES=true`。数据库只保存随机 Token 的 SHA-256 摘要，不保存 Token 或 Owner 密码；退出与过期会话均无法继续访问 API。

所有非只读请求都必须携带与 `OPENBOT_ALLOWED_ORIGINS` 精确匹配的 `Origin`。登录连续失败五次后，该来源会被临时限制五分钟。当前为单 Owner 模型，不提供注册、找回密码或多用户权限；修改部署密码后应重启 Server，并主动退出现有设备。

## 创建 Bot

```json
{
  "name": "Ops",
  "role": "浏览器操作与日常运营",
  "computerProfile": "docker-linux"
}
```

`computerProfile` 只能是 `none`、`docker-linux`、`macos-cua`、`lume-vm` 或 `coder`。Bot 名称在当前本地工作区唯一。

创建 Bot 时，Server 会在同一事务内写入一条不可变的 `created` 进化事件。Bot 是数字员工身份本身；系统不会建立第二套重复的 Employee 身份。

## 读取数字员工档案

`GET /api/v1/bots/:botId/profile` 返回 Owner 可见的数字员工聚合投影：

- `employee`：姓名、职责、状态、外观和固定执行配置；
- `evolution`：有来源和证据引用的追加式进化事件；
- `skills`：版本、依赖、所需能力、验证状态与证据置信度；
- `memories`：按类型、敏感度和可迁移策略分类的记忆；
- `records`：该员工最近的 Run、Approval、Artifact 与结构化决策摘要；
- `statistics`：最近 50 个 Run 的结果计数与已验证技能数；
- `configuration`：执行配置和可移植员工包格式版本。

`records.decisions` 只来自 Worker Host 上报并持久化的 `RUN_PROGRESS` 事件，用于解释阶段、已观察事实和下一步动作。它不是模型原始思维链，也不允许 Provider 把隐藏提示、密钥或私有推理写入其中。

技能的 `confidence` 表示证据质量，不会授予电脑权限；真正的执行权限仍由 Server 的 Node 路由、策略、审批和后续 capability lease 独立决定。记忆的 `portability` 也只是导出候选策略，导出时仍需重新过滤和 Owner 确认。

## 导出安全员工模板

`GET /api/v1/bots/:botId/export/preview` 先返回将要包含的已验证技能、所需能力、校验和、
明确排除项和阻止原因。v1 默认模板不包含任何记忆，也不包含来源员工 ID、所有权、Run、
进化历史、决策、产物、审批、Node 身份、主机绑定、凭证、Session 或能力授权。

`GET /api/v1/bots/:botId/export` 只在预览没有阻止项时返回
`application/vnd.openbot.employee+json`。Server 会检查导出自由文本中的疑似凭证、Bearer Token、
私钥标记和用户本地路径；命中后返回 `422`，不会生成下载。包内 SHA-256 对规范化 `payload`
提供意外修改检测，但当前 `signature.status` 是 `unsigned`，不能证明发布者身份。未来导入功能必须
先隔离校验、创建新的本地员工 ID，并让所有导入技能保持禁用，直到 Owner 完成本地策略审核。

`POST /api/v1/employees/import/preview` 接受整个 v1 员工模板 JSON，最大 1 MiB。它使用严格
schema，任何未声明字段都会返回 `422`，不会被静默忽略。通过结构验证后，Server 检查 SHA-256、
技能 slug 与依赖、技能实际能力和顶层能力声明是否一致、疑似敏感文本，以及当前在线工作主机
能否满足执行配置和全部能力。

成功响应只是一份 `quarantine.active: true` 的只读投影。`quarantine.canActivate` 固定为 `false`，
`createsNewIdentity` 固定为 `true`，`importedSkillState` 固定为
`disabled-pending-review`，`hostAuthority` 固定为 `none`。该接口不写入 Bot、技能、记忆、Node
绑定或权限；即使 `blocked: false`，也只表示可以进入人工审核，不表示员工已导入或已获信任。

## 创建频道

```json
{
  "name": "运营中心",
  "description": "处理日常运营任务并保留完整上下文",
  "botIds": ["00000000-0000-4000-8000-000000000001"]
}
```

频道与初始 roster 在同一数据库事务中写入；任一 Bot 不存在时整次创建失败。创建 Bot、创建频道和加入频道都会写入结构化事件，供后续 realtime、audit 和办公室状态投影使用。

## 发送频道任务

```json
{
  "content": "打开测试页，填写表单但不要提交",
  "botId": "可选；必须是该频道成员的 Bot ID"
}
```

消息正文会先去除首尾空白，长度限制为 1–8000 个字符。一次请求会在同一数据库事务中创建 `human` 消息、状态为 `queued` 的 Run、`MESSAGE_CREATED` 和 `RUN_CREATED` 事件。Run 通过唯一的 `sourceMessageId` 关联来源消息，避免同一输入被投影为多个任务。

若传入 `botId`，Server 只接受频道 roster 内的 Bot；未传入时确定性地优先选择名称或职责为 Chief/总管/协调/调度的成员，否则选择 roster 中稳定排序的首位成员。空频道和越权指定均返回 `422`。模型与 Client 不能绕过这条成员边界。

成功响应包含 `{ message, run }`。Server 随后向频道 SSE 订阅者依次发布 `message.created` 与 `run.created`；Web 分别按消息 ID 和 Run ID 合并快照与实时事件，因此刷新、重连和并发写入不会产生重复投影。

Run 会把接单 Bot 当时的 `computerProfile` 固化为 `executionProfile`，不会在运行中由 Client、模型或 Node 改写。若存在兼容且未满载的在线 Node，Server 会通过版本化 WebSocket 协议发出 offer；Node 接受、Server 在短事务中条件认领成功并发送 confirm 后，Run 进入 `assigned`。Node 再请求启动，Server 条件更新为 `running` 后才发 `run.start`；进度写入结构化事件并实时投影到频道，最新画面只进入受限内存缓存，成功结果和 Artifact 元数据在同一数据库事务中落库，随后 Server 发 `run.settled` 释放节点容量。

尚未执行的 `assigned` Run 在节点断线或 Server 恢复时回到 `queued`；已经 `running` 的 Run 则明确失败，不会在外部副作用未知时自动重跑。当前 Docker provider 只接受任务正文中的一个明确 HTTP(S) URL，只执行 `/navigate` 与 `/screenshot`，不点击、不填写、不提交。截图正文保存在 Server 文件存储，数据库只保存引用、SHA-256、大小和元数据。

## 订阅频道事件

`GET /api/v1/channels/:channelId/events` 返回 `text/event-stream`，当前事件如下：

| SSE event | data | 作用 |
| --- | --- | --- |
| `channel.ready` | `{ type, channelId, occurredAt }` | 确认订阅已建立 |
| `message.created` | `{ type, channelId, message }` | 投影一条已持久化的频道消息 |
| `run.created` | `{ type, channelId, run }` | 投影一条已持久化的排队任务 |
| `run.updated` | `{ type, channelId, run, artifacts? }` | 投影分配、运行、完成、失败和新产物 |
| `run.progress` | `{ type, channelId, progress }` | 投影已持久化的执行阶段和说明 |
| `run.frame` | `{ type, channelId, frame }` | 投影最新临时画面的版本、尺寸和时间；不含图片正文 |
| `heartbeat` | ISO 时间字符串 | 检测代理或 Server 形成的半开连接 |

Server 每 15 秒发送一次心跳。Web 超过 35 秒未收到任何帧会主动关闭连接，并以 2 秒间隔重连。每次收到 `channel.ready` 后，Web 都会重新读取最近历史，并按实体 ID 与 `updatedAt` 合并消息和 Run，以补齐断线期间写入的数据且不让旧 REST 快照覆盖较新的 SSE 状态。SSE 只承担 Server 到浏览器的下行投影；创建消息等命令继续使用 REST。

`GET /api/v1/workspace/events` 使用独立的全局 SSE。首帧 `workspace.ready` 包含当前在线 Node 权威快照，之后发送 `node.upserted`、`node.removed`、`run.updated` 与 `approval.updated`；Web 因此不需要刷新就能看到远程机器、办公室任务和待审批动作变化。频道事件仍负责单频道消息、进度与画面，Workspace 事件负责跨频道总览。

审批决定正文为 `{ "decision": "approve" }` 或 `{ "decision": "reject" }`。Server 只接受 `pending` 状态且未过期的审批；每个审批只能决定一次，重复请求返回 `409`。批准会把 Run 恢复为 `running` 并把决定送回发起请求的 Node，拒绝或过期会把 Run 标记为 `blocked` 并取消 Node 执行。当前握手尚未签发独立、可验证的一次性 capability lease，因此只允许可信私网测试 provider 使用。

当前 realtime hub 是单 Server 进程内广播。需要运行多个 Server 副本时，必须先换成 PostgreSQL `LISTEN/NOTIFY`、Redis Streams 或 NATS 等共享事件总线，不能依赖进程内 fan-out。

Artifact 与临时画面内容接口使用同一个 Owner Session，响应为 `private, no-store` 并带 `X-Content-Type-Options: nosniff`。Web 不接收或暴露实际 `storage_key`；没有登录的浏览器不能读取截图。临时画面限制为 PNG 和 2 MiB，Server 最多保留 16 个 Run 的最新帧，每帧默认 2 分钟后过期；SSE 只发送元数据，图片由浏览器按 revision 单独读取。

## 错误约定

- `401`：未登录、会话已过期或登录密码错误；
- `403`：非只读请求缺少可信 `Origin`，或来源不在允许列表；
- `429`：登录失败次数过多，调用方应遵循 `Retry-After`；
- `409`：频道或 Bot 名称冲突，审批已决定或已过期；
- `422`：输入字段或 roster 无效；
- `404`：频道或 Bot 不存在；
- `500`：未预期的 Server 错误，响应不会泄漏数据库细节。
