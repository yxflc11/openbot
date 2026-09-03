# 本地 API（M0）

所有接口由 OpenBot Server 提供，开发环境默认地址为 `http://localhost:3001`。当前 API 仅用于本地控制面；在本地登录和 session middleware 落地前，不应将 Server 直接暴露到公网。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/health` | Server 存活状态 |
| `GET` | `/api/v1/bootstrap` | 轻量计数与阶段信息 |
| `GET` | `/api/v1/workspace` | 频道、Bot、Node 和计数的一次性投影 |
| `GET` | `/api/v1/channels` | 频道与 Bot roster |
| `POST` | `/api/v1/channels` | 创建频道并原子加入初始 Bot |
| `POST` | `/api/v1/channels/:channelId/bots` | 把已有 Bot 加入频道 |
| `GET` | `/api/v1/channels/:channelId/messages` | 读取最近 100 条本地频道消息 |
| `POST` | `/api/v1/channels/:channelId/messages` | 保存一条用户频道消息 |
| `GET` | `/api/v1/channels/:channelId/events` | 订阅频道实时事件（SSE） |
| `GET` | `/api/v1/bots` | Bot 名册 |
| `POST` | `/api/v1/bots` | 创建 Bot |
| `GET` | `/api/v1/nodes` | 当前在线执行节点 |

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

## 发送本地消息

```json
{
  "content": "打开测试页，填写表单但不要提交"
}
```

消息正文会先去除首尾空白，长度限制为 1–8000 个字符。当前接口只创建 `human` 消息；Bot 和系统消息将在 Run runtime 接入后由服务端写入。消息与 `MESSAGE_CREATED` 事件在同一数据库事务中保存。

消息写入成功后，Server 会向该频道的 SSE 订阅者发布 `message.created`。Web 在订阅就绪后读取历史，并把快照与实时事件按消息 ID 合并，因此刷新、重连和并发写入不会在界面中产生重复消息。

## 订阅频道事件

`GET /api/v1/channels/:channelId/events` 返回 `text/event-stream`，当前事件如下：

| SSE event | data | 作用 |
| --- | --- | --- |
| `channel.ready` | `{ type, channelId, occurredAt }` | 确认订阅已建立 |
| `message.created` | `{ type, channelId, message }` | 投影一条已持久化的频道消息 |
| `heartbeat` | ISO 时间字符串 | 检测代理或 Server 形成的半开连接 |

Server 每 15 秒发送一次心跳。Web 超过 35 秒未收到任何帧会主动关闭连接，并以 2 秒间隔重连。每次收到 `channel.ready` 后，Web 都会重新读取最近历史并按消息 ID 合并，以补齐断线期间写入的数据。SSE 只承担 Server 到浏览器的下行投影；创建消息等命令继续使用 REST。

当前 realtime hub 是单 Server 进程内广播。需要运行多个 Server 副本时，必须先换成 PostgreSQL `LISTEN/NOTIFY`、Redis Streams 或 NATS 等共享事件总线，不能依赖进程内 fan-out。

## 错误约定

- `409`：频道或 Bot 名称冲突；
- `422`：输入字段或 roster 无效；
- `404`：频道或 Bot 不存在；
- `500`：未预期的 Server 错误，响应不会泄漏数据库细节。
