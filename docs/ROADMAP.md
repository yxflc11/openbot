# 实施路线图

## 当前进度

M0 第三切片正在推进：Server 会自动执行 PostgreSQL migration；频道、Bot、频道成员、频道消息和结构化事件会真实落库；Web 可以创建 Bot、创建频道、把 Bot 加入频道、发送本地消息，并在桌面办公室和手机列表中读取同一份数据；频道 SSE、多浏览器即时同步、断线检测和自动重连已跑通；Server 重启后的刷新恢复已通过实测。

M0 尚未完成的部分是本地登录、thread/run 投影、共享记忆、完整 policy 与 audit 页面。频道消息 realtime 已建立基线，后续 Run、审批、Node 与屏幕事件会沿用同一投影边界，而不是和当前 CRUD 混成一次大改动。

## Spike — 决定是否正式 fork CopilotKit/OpenBot

### 验证

- 在 Apple Silicon 与 Linux 上原样启动。
- 画出 CopilotKit Intelligence 在 server/app 中的所有依赖点。
- 用最小本地 thread adapter 完成一轮消息持久化和刷新恢复。
- 确认 `agent-computer`、policy、audit、routine、handoff 测试可独立运行。
- 估算 supervisor 泛化成 remote Node 的改造边界。

### 决策门

如果替换 Intelligence 不要求重写大部分 server/app，正式 fork；否则只提取 MIT 模块/设计并保持 clean-room 边界。

## M0 — 完全本地的 Server

### 交付

- Local Threads / Memory / Realtime。
- PostgreSQL 中的频道、消息和事件。
- 不提供 Intelligence key/license 时完整启动。
- 本地登录、Bot 名册、频道、policy 和 audit。
- Marvis 式办公室基线，以及创建频道、创建 Bot、把 Bot 加入频道的完整流程。
- 响应式 Web/PWA 基线；移动端使用单栏任务与底部抽屉。

### 过线测试

- 断网环境仍能创建频道、对话、刷新和恢复历史。
- Server 重启不丢 thread/run/approval。
- 浏览器中不存在向 CopilotKit Intelligence 的网络请求。

## M1 — Server + Linux Node 闭环

### 交付

- Node enrollment、WSS 长连接、心跳、吊销。
- capability registry 与 deterministic router。
- Docker browser provider。
- run、屏幕、日志和产物回传。
- Run Inspector 的 Computer、Progress、Team 与 Artifacts 实时投影。

### 过线测试

- Server 与 Node 可位于两台不同机器。
- Node 无入站端口仍能领取任务。
- 节点断线后 run 明确失败/等待，不重复外部副作用。
- 更换 Node 后 Bot、频道和历史保持不变。

## M2 — 多设备远程审批与接管

### 交付

- Tailscale-first 部署文档。
- 手机 PWA 的频道、审批和电脑画面。
- Attention 审批卡在桌面右栏和手机任务页同时置顶。
- 一次性 capability lease。
- view token、独占 control lease 和人机互斥。
- Run、审批、Node 和电脑状态的多设备 realtime 同步。

### 过线测试

- 手机在外网通过私网访问 Server。
- 未批准的 commit 不发生；重放、超时和上下文变化均拒绝。
- 一台设备接管后，其他设备和 Agent 不能同时输入。
- Client 无法绕过 Server 直连 Node。

## M3 — macOS Node

### 交付

- macOS launchd Node daemon。
- Cua observe/prepare provider。
- Lume VM provider。
- macOS 权限诊断与稳定 runtime identity。

### 过线测试

- Linux Server 能调度家中 Mac Node。
- Mac Node 重启后主动重连。
- 没有 Cua capability 时任务不会错误路由。
- 宿主 Cua 与 Lume VM 的凭证和工作区彼此隔离。

## M4 — 多 Bot、routine 与 coder

### 交付

- `chief` / `ops` / `coder` 结构化 handoff。
- durable queue、并发限制、幂等、重试和失败熔断。
- Codex/Claude CLI adapter。
- 可选 Multica coder provider。

### 过线测试

- `chief` 无电脑权限，只能派活和汇总。
- routine 在 Server 重启后不重复、不补跑过期窗口。
- `coder` 不能读取 `ops` 的浏览器 profile 或 macOS 凭证。

## M5 — 开源发布与运维

### 交付

- Server Docker Compose 安装。
- Linux systemd 与 macOS launchd Node 安装。
- 固定版本、checksum、SBOM、第三方 notice。
- 备份、恢复、升级 canary 和回滚。
- 独特项目名、LICENSE、SECURITY、贡献指南。

### 过线测试

- 新服务器能从备份恢复全部频道、Bot、策略和审计。
- 替换执行节点不需要迁移系统数据库。
- 升级失败能回滚且不重新消费审批。

## 最先创建的 Issue

1. `Spike: boot CopilotKit/OpenBot on Apple Silicon and Linux`
2. `Spike: map and replace Intelligence thread dependencies`
3. `M0: persist local channels, threads and AG-UI events`
4. `M1: define versioned Server-Node protocol`
5. `M1: enroll a remote Linux Node over outbound WSS`
6. `M1: route one browser task and stream its screenshot`
