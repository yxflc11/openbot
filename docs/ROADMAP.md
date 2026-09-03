# 实施路线图

## 当前进度

M1 第二切片已完成：Server 会自动执行 PostgreSQL migration；频道、Bot、频道成员、频道消息、任务、结构化事件、Owner Session、结果和 Artifact 元数据会真实落库；Web 可以本地登录、创建组合式 Bot、创建频道、把 Bot 加入频道并指定 Bot 提交任务。任务完成结果会作为 Bot 回复保存到频道，频道 SSE、多浏览器即时同步、回复关系、富文本表格、断线检测和自动重连已跑通。任务再以 Bot 固定的 execution profile 匹配有容量的 Node。

Node 已通过出站 WebSocket 上报真实可执行能力和并发容量；两阶段 offer/accept/confirm、显式 start、progress、frame、completed/failed/settled、数据库条件转换、节点断线恢复已通过进程级链路验证。首个 Docker provider 已用薄适配层接通 CopilotKit/OpenBot `agent-computer`：当前只打开任务中明确的公开 URL 并回传一张 PNG。Workspace SSE 已让 Node、Run 与审批状态在所有设备实时同步；结构化 progress 与最新临时画面已进入 Run Inspector。

M2 第一切片已完成：Node/provider 可发送结构化 `approval.request`，Server 原子保存审批和目标指纹并把 Run 切换为 `waiting_approval`；桌面 Attention 与手机审批页可批准一次或拒绝，决定会审计并回传原 Node。重复决定、过期审批和失联 Node 均 fail closed。下一步是接入真正的交互式 provider，并把当前请求/决定握手升级为可验证、可消费一次的 capability lease；连续画面与接管仍待补。

M3 基础切片已完成：员工进化事件、版本化技能、技能依赖和分类记忆已经落库；七视图员工主页
可以从 Bot 列表、频道成员和消息作者进入。安全模板导出已有严格 schema、默认排除项、疑似敏感
文本阻止、SHA-256 校验和 Owner 鉴权下载。只读导入预览也已完成严格 schema、1 MiB 上限、
完整性与技能语义检查、敏感文本检查和在线主机兼容报告；它不能创建员工或获得工作主机权限。
当前模板仍未签名且不含记忆。Agent Skills 兼容的技能元数据现在只能先成为候选，再由登录
Owner 验证、暂停或永久撤销；每次变化都会追加进化事件，不会改变主机权限。下一步是可执行
技能目录的隔离检查、完整 diff 审核，以及签名/审核后激活设计。

## 当前持续目标的执行顺序

本轮 Codex 目标至少持续八小时，并按小步可验证提交推进：

1. **产品基线：**更新双语定位、跨平台工作主机模型、数字员工档案与安全迁移规范。
2. **协议泛化：**去除只支持 Linux/macOS 的硬编码，加入 OS、架构、设备类型、隔离等级和
   版本化能力，同时为旧 Node 保留明确兼容边界。
3. **员工领域模型：**建立 profile、evolution event、skill、skill relation、memory 和 portable
   package 的共享类型与数据库 migration。
4. **读取闭环：**提供员工主页 API，把已有 Run、产物和审批投影为可解释工作记录。
5. **界面切片：**从频道 Bot 入口打开员工主页，先交付概览、进化、技能、运行和记录视图。
6. **安全导出：**实现不包含凭证、Session、Node 身份、租约和私人记忆的模板导出/导入预览。
7. **工程收口：**补齐协议、数据库、API 和 UI 测试，运行 `npm run check`，更新文档并通过 PR
   合并。

任何阶段未通过验收都不能通过扩大宣传或跳过测试来“完成”。

## M0 — 本地控制平面（基础已完成）

### 已交付

- 本地 Owner 认证、PostgreSQL、频道、Bot、消息、Run、审批、产物和审计。
- 频道优先的响应式 Web UI、组合式 Bot 外观和多设备实时同步。
- 办公室隔离为未加载的 `@openbot/office-plugin`。

### 剩余过线项

- 可安装 PWA、通知投递、恢复工具和更完整的无障碍支持。

## M1 — 跨平台 Server/Node 基础

### 交付

- Linux x64/arm64 生产 Server 镜像，可运行在 Linux、NAS、云、macOS 或 Windows 容器主机。
- 结构化 Worker Host 身份、版本化 capability 和确定性能力路由。
- Windows、macOS、Linux Node daemon 的共同生命周期和兼容测试。
- 独立 Node enrollment、证书轮换、吊销和防重放。

### 过线测试

- 三种桌面平台的模拟 Node 都能注册、心跳、领取匹配任务并安全断线。
- Node 不开放公网入站控制端口。
- 更换工作主机后，员工、频道和历史保持不变。

## M2 — 安全浏览器、审批与接管

### 交付

- 跨平台语义浏览器 Provider 的 observe/fill/act 循环。
- 审批前冻结动作、一次性 capability lease 和上下文指纹复核。
- 连续画面、短时 view token、独占 control lease 和人机互斥。
- 手机 PWA 审批、通知和接管。

### 过线测试

- 未批准的 commit 不发生；批准不能重放，超时或目标变化立即拒绝。
- 一台 Client 接管后，其他 Client 和 Agent 都不能输入。
- Client 无法绕过 Server 直连工作主机。

## M3 — 员工档案、技能与可迁移模板

### 交付

- 员工个人主页：概览、进化档案、技能图谱、运行轨迹、记忆、记录和配置。
- 有来源、版本、验证状态和证据的技能注册表。
- 类型化记忆、敏感等级、保留和删除控制。
- 安全默认的员工模板导出、导入预览和本地重新授权。

### 过线测试

- 每项进化和技能都可以追溯证据。
- 决策轨迹不暴露私有思维链、密钥或凭证。
- 默认员工包不含私人记忆、设备身份、电脑权限、Session 或租约。
- 导入员工在新 Owner 授权前不能操作任何工作主机。

完整模型见[可迁移数字员工模型](EMPLOYEE.zh-CN.md)。

## M4 — Windows、macOS、Linux 原生工作主机

### 交付

- Windows UI Automation/PowerShell Provider 与 Windows Service。
- macOS Cua/Lume Provider、权限诊断与 launchd 服务。
- Linux Shell/File Provider，随后认证支持的 Linux 桌面环境。
- 全部 Provider 使用相同 prepare/approve/commit 和一致性测试。

### 过线测试

- 同一员工可以在策略允许时更换 Windows、macOS 或 Linux 工作主机。
- 缺少对应 Provider 时不会错误路由或静默降级。
- 工作主机使用员工专用账户，不复用 Owner 主账号和主密码库。

平台矩阵见[跨平台工作主机](CROSS_PLATFORM.zh-CN.md)。

## M5 — 多 Bot、Routine、Coder 与所有权转移

### 交付

- `chief` / `ops` / `coder` 结构化 handoff。
- durable queue、并发限制、幂等、重试、熔断和长期记忆。
- Codex/Claude CLI adapter 与可选 Multica Provider。
- 经认证的员工所有权转移、来源端撤销和双方收据。

### 过线测试

- `chief` 无电脑权限，只能派活和汇总。
- Routine 在 Server 重启后不重复执行副作用。
- `coder` 不能读取 `ops` 的浏览器配置或原生桌面凭证。
- 完成转移后，来源端不能继续使用员工身份或权限。

## M6 — 移动设备、发布与运维

### 交付

- 受管理 Android Node 与 iOS/Android 伴侣端。
- Server Docker Compose、Linux systemd、Windows Service 和 macOS launchd 安装。
- 固定版本、签名、checksum、SBOM、第三方 notice、备份、恢复和回滚。
- Provider 模板、支持等级、兼容矩阵和社区认证流程。

### 过线测试

- 新 Server 能从备份恢复员工、频道、策略和审计。
- 升级失败能回滚且不重新消费审批。
- Experimental、Supported、Certified 能力不会在产品和文档中混淆。

## 下一批 Issue

1. `Skills: validate quarantined SKILL.md directories with the official skills-ref worker`
2. `Skills: add bounded proposal expiry, supersession, notification, and full-diff review`
3. `Protocol: publish cross-platform Provider conformance fixtures`
4. `Routing: reject unsupported capability versions without fallback`
5. `Security: design publisher keys and signed Employee archives`
6. `Import: add explicit Owner review receipts before activation`
7. `Memory: add retention, redaction, deletion, and selective export controls`
8. `Node identity: replace shared enrollment token with per-Node credentials`
9. `Approval: issue single-use capability leases bound to target fingerprints`
10. `Web: add accessible internationalization for Employee portability flows`
