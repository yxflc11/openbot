# ADR-0012：临时最新画面传输

状态：Accepted

## 背景

远程设备需要看到 Bot 正在操作哪台电脑，但把完整 PNG 塞进频道 SSE 会为每个订阅者复制大量 base64，持久化每一帧又会放大隐私和存储风险。Client 直连 Node 也会绕过 Server 的认证边界。

## 决策

- Node 通过现有出站 WebSocket 发送版本化 `run.frame`，只允许受尺寸限制的 PNG。
- Server 只接受绑定到该 Node 且状态为 `running` 的 Run 画面，并验证 PNG 签名和 2 MiB 上限。
- Server 每个 Run 只保存最新一帧，默认最多 16 个 Run、保留 2 分钟；不写 PostgreSQL、Artifact Storage 或日志。
- 频道 SSE 的 `run.frame` 只发送 revision、尺寸、时间与关联 ID。已登录 Web 再通过 `/api/v1/runs/:runId/frame?revision=` 读取正文。
- 当前 Docker provider 每次 `/screenshot` 上报一帧；协议允许后续 Cua、Lume 或浏览器 provider 连续更新，不改变 Web 数据边界。

## 结果

Run Inspector 可以在不直连 Node 的情况下展示最新执行画面，多设备共享同一 Server 授权路径。这个切片不是视频流，也不授予输入权；连续采集、view token、WebRTC relay 和独占 control lease 仍属于后续 M1/M2。
