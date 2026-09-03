# 实施路线图

## 当前进度

M1 第二切片已完成：Server 会自动执行 PostgreSQL migration；频道、Bot、频道成员、频道消息、任务、结构化事件、Owner Session、结果和 Artifact 元数据会真实落库；Web 可以本地登录、创建组合式 Bot、创建频道、把 Bot 加入频道并指定 Bot 提交任务。任务完成结果会作为 Bot 回复保存到频道，频道 SSE、多浏览器即时同步、回复关系、富文本表格、断线检测和自动重连已跑通。任务再以 Bot 固定的 execution profile 匹配有容量的 Node。

Node 已通过出站 WebSocket 上报真实可执行能力和并发容量；两阶段 offer/accept/confirm、显式 start、progress、frame、completed/failed/settled、数据库条件转换、节点断线恢复已通过进程级链路验证。首个 Docker provider 已用薄适配层接通 CopilotKit/OpenBot `agent-computer`：当前只打开任务中明确的公开 URL 并回传一张 PNG。Workspace SSE 已让 Node、Run 与审批状态在所有设备实时同步；结构化 progress 与最新临时画面已进入 Run Inspector。

M2 第一切片已完成：Node/provider 可发送结构化 `approval.request`，Server 原子保存审批和目标指纹并把 Run 切换为 `waiting_approval`；桌面 Attention 与手机审批页可批准一次或拒绝，决定会审计并回传原 Node。重复决定、过期审批和失联 Node 均 fail closed。下一步是接入真正的交互式 provider，并把当前请求/决定握手升级为可验证、可消费一次的 capability lease；连续画面与接管仍待补。

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
- 频道优先的桌面和移动端界面，以及创建频道、组合式 Bot、把 Bot 加入频道的完整流程。
- Marvis 式办公室隔离为 `@openbot/office-plugin`，不在当前版本加载。
- 响应式 Web/PWA 基线；移动端使用单栏任务与底部抽屉。

### 过线测试

- 断网环境仍能创建频道、对话、刷新和恢复历史。
- Server 重启不丢 thread/run/approval。
- 浏览器中不存在向 CopilotKit Intelligence 的网络请求。

## M1 — Server + Linux Node 闭环

### 交付

- Node enrollment、WSS 长连接、心跳、吊销（当前为共享启动令牌，独立身份与吊销待补）。
- capability registry 与 deterministic router（首个切片已完成）。
- 两阶段任务分配、并发容量和断线/重启回队（首个切片已完成）。
- Docker browser provider（只读 navigate + screenshot 已完成）。
- run 生命周期、UI progress、结果和小型 PNG 产物回传（已完成）；受限的最新画面 transport 已完成，连续采集待补。
- Run Inspector 的任务、Computer、Progress、Team、临时画面与 Artifacts 投影（已完成）。

### 过线测试

- Server 与 Node 可位于两台不同机器。
- Node 无入站端口仍能领取任务。
- 节点断线后 run 明确失败/等待，不重复外部副作用。
- 更换 Node 后 Bot、频道和历史保持不变。

## M2 — 多设备远程审批与接管

### 交付

- Tailscale-first 部署文档。
- 手机 PWA 的频道、审批和电脑画面。
- Attention 审批卡在桌面右栏和手机审批页同时置顶（第一切片已完成）。
- 审批请求、目标指纹、超时、Owner 决定、审计和 Node 恢复握手（第一切片已完成）。
- 一次性 capability lease。
- view token、独占 control lease 和人机互斥。
- Run、审批与 Node 状态的多设备 realtime 同步（已完成）；连续电脑画面待补。

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
