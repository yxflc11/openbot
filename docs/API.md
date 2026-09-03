# 本地 API（M0 + M1）

所有接口由 OpenBot Server 提供，开发环境默认地址为 `http://localhost:3001`。除健康检查、会话状态和登录外，所有 `/api/v1` 接口都要求有效的本地 Owner Session。Server 不应直接暴露到公网；远程使用优先通过 Tailscale 与 HTTPS。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/health` | Server 存活状态 |
| `GET` | `/api/v1/auth/session` | 读取当前 Owner 会话状态 |
| `POST` | `/api/v1/auth/login` | 使用部署密码创建 Owner Session |
| `POST` | `/api/v1/auth/logout` | 撤销当前 Session 并清除 Cookie |
| `GET` | `/api/v1/bootstrap` | 轻量计数与阶段信息 |
| `GET` | `/api/v1/workspace` | 频道、Bot、Node 和计数的一次性投影 |
| `GET` | `/api/v1/channels` | 频道与 Bot roster |
| `POST` | `/api/v1/channels` | 创建频道并原子加入初始 Bot |
| `POST` | `/api/v1/channels/:channelId/bots` | 把已有 Bot 加入频道 |
| `GET` | `/api/v1/channels/:channelId/messages` | 读取最近 100 条本地频道消息 |
| `POST` | `/api/v1/channels/:channelId/messages` | 原子保存用户消息并创建排队任务 |
| `GET` | `/api/v1/channels/:channelId/runs` | 读取频道最近 50 个任务 |
| `GET` | `/api/v1/channels/:channelId/events` | 订阅频道实时事件（SSE） |
| `GET` | `/api/v1/bots` | Bot 名册 |
| `POST` | `/api/v1/bots` | 创建 Bot |
| `GET` | `/api/v1/nodes` | 当前在线执行节点 |

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

Run 会把接单 Bot 当时的 `computerProfile` 固化为 `executionProfile`，不会在运行中由 Client、模型或 Node 改写。若存在兼容且未满载的在线 Node，Server 会通过版本化 WebSocket 协议发出 offer；Node 接受、Server 在短事务中条件认领成功并发送 confirm 后，Run 才进入 `assigned`。节点断线或 Server 丢失内存确认时，尚未执行的 `assigned` Run 会回到 `queued`。当前流程只完成任务槽位分配，尚未启动 provider，也没有产生外部副作用。

## 订阅频道事件

`GET /api/v1/channels/:channelId/events` 返回 `text/event-stream`，当前事件如下：

| SSE event | data | 作用 |
| --- | --- | --- |
| `channel.ready` | `{ type, channelId, occurredAt }` | 确认订阅已建立 |
| `message.created` | `{ type, channelId, message }` | 投影一条已持久化的频道消息 |
| `run.created` | `{ type, channelId, run }` | 投影一条已持久化的排队任务 |
| `run.updated` | `{ type, channelId, run }` | 投影任务分配、回队等持久化状态变化 |
| `heartbeat` | ISO 时间字符串 | 检测代理或 Server 形成的半开连接 |

Server 每 15 秒发送一次心跳。Web 超过 35 秒未收到任何帧会主动关闭连接，并以 2 秒间隔重连。每次收到 `channel.ready` 后，Web 都会重新读取最近历史，并按实体 ID 与 `updatedAt` 合并消息和 Run，以补齐断线期间写入的数据且不让旧 REST 快照覆盖较新的 SSE 状态。SSE 只承担 Server 到浏览器的下行投影；创建消息等命令继续使用 REST。Node 在线状态目前仍随 workspace 刷新读取，全局 Node realtime 尚未接入。

当前 realtime hub 是单 Server 进程内广播。需要运行多个 Server 副本时，必须先换成 PostgreSQL `LISTEN/NOTIFY`、Redis Streams 或 NATS 等共享事件总线，不能依赖进程内 fan-out。

## 错误约定

- `401`：未登录、会话已过期或登录密码错误；
- `403`：非只读请求缺少可信 `Origin`，或来源不在允许列表；
- `429`：登录失败次数过多，调用方应遵循 `Retry-After`；
- `409`：频道或 Bot 名称冲突；
- `422`：输入字段或 roster 无效；
- `404`：频道或 Bot 不存在；
- `500`：未预期的 Server 错误，响应不会泄漏数据库细节。
