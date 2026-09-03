# 本地 API（M0）

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
| `POST` | `/api/v1/channels/:channelId/messages` | 保存一条用户频道消息 |
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

- `401`：未登录、会话已过期或登录密码错误；
- `403`：非只读请求缺少可信 `Origin`，或来源不在允许列表；
- `429`：登录失败次数过多，调用方应遵循 `Retry-After`；
- `409`：频道或 Bot 名称冲突；
- `422`：输入字段或 roster 无效；
- `404`：频道或 Bot 不存在；
- `500`：未预期的 Server 错误，响应不会泄漏数据库细节。
