# OpenBot

**一套用于常驻数字员工的自托管控制平面。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg)](package.json)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-f59e0b.svg)](#项目状态)

OpenBot 是一个早期阶段的开源、自托管平台，用来在你掌控的电脑上运行具名 AI 员工。你在
持久化本地频道中与员工对话；OpenBot Server 将每项任务路由到获得授权且可以替换的工作主机，
并把身份、技能、记忆、消息、审批、产物和审计事件保存在你自己的系统中。

Mac mini 是第一种实用工作主机，不是产品边界。Windows、macOS 和 Linux 主流电脑都可以通过
同一套 Server 授权的 Node 协议成为员工的工作电脑。Server 可以运行在 Linux、macOS、NAS
或云主机上，你可以通过私有网络从任意浏览器访问。

OpenBot 希望复现 Grok Bot 等产品所代表的常驻、频道式数字员工体验，同时坚持自托管、
模型与 Provider 中立，以及明确的人类控制边界。

> [!WARNING]
> OpenBot 仍处于 pre-alpha 阶段。当前电脑 Provider 只有只读能力，**不会**填写、点击、
> 提交或控制生产账号。请勿连接付款方式、主账号或生产凭证。对外部署前请先阅读
> [安全说明](#安全)。

## 为什么做 OpenBot

- **本地频道，而非一次性聊天窗口。** Bot、对话、Run 和结果都保存在你自己的 PostgreSQL。
- **电脑可以跨平台替换。** 员工是持久身份和策略；工作主机可以是 Windows、macOS、Linux、
  VM、容器或受管理设备。
- **员工可以成长和迁移。** 每个员工都有可追溯的进化档案、技能图谱、决策轨迹、记忆、工作
  记录、配置和安全迁移控制。
- **副作用前审批。** 敏感动作必须进入明确且可审计的审批状态，模型不能自行扩大权限。
- **所有设备共享一个控制平面。** 桌面和手机浏览器通过经过认证的实时更新看到同一频道状态。
- **可组合的 Bot 身份。** Bot 外观由头型、身体、移动方式、配件和强调色五个独立层保存。
- **通过适配器避免锁定。** 模型、电脑运行时和上游项目通过有类型、带版本的边界接入。

## 项目状态

OpenBot 已经跑通“本地频道 → 远程执行 Node → 结果回到频道”的受测试垂直切片。下表刻意
区分已落地代码与未来能力。

| 领域 | 当前已经可用 | 下一步 |
| --- | --- | --- |
| 控制平面 | 本地 Owner 认证、PostgreSQL migration、Bot、频道、成员、消息、Run、审批、产物和审计事件 | 持久 routine、记忆、恢复工具和多用户信任模型 |
| 频道界面 | 响应式频道优先 Web UI、指定 Bot、Bot 身份结果、引用回复、富文本/表格、任务 Inspector、审批和 SSE 重连 | 可安装 PWA、通知投递、无障碍和本地化完善 |
| Bot 身份 | 五层组合外观已随 Bot 持久化，并统一用于频道和员工主页 | 更多部件和社区外观包 |
| 员工档案 | 七视图个人主页、安全模板导出，以及严格、只读、隔离的导入检查 | 技能学习/验证、记忆控制、签名员工包、审核后激活、复制和转移 |
| Node 协议 | 出站 WebSocket 登记、心跳、容量、确定性路由、两阶段分配、显式启动、进度、画面、完成和断线恢复 | 独立 Node enrollment、mTLS、吊销、防重放和协议兼容测试 |
| 浏览器执行 | 通过固定版本的 CopilotKit/OpenBot `agent-computer` 打开明确的公网 HTTP(S) URL，并返回有界 PNG 截图 | Observe/fill/act 循环、连续画面、安全表单交互和重试语义 |
| 人类控制 | 绑定 Run、Node、动作、目标指纹、风险和过期时间的持久审批请求/决定 | 单次签名 capability lease 和独占远程接管 |
| Provider | 可工作的只读 Docker/browser 适配器；有类型的 Cua、Lume 和 coder 包边界 | 跨平台浏览器、Windows、macOS、Linux 桌面、受管理 Android 和隔离编码 Provider |
| 办公室视图 | 与核心应用无依赖的 `@openbot/office-plugin` 隔离包 | 等频道工作流成熟后再建设可选插件生命周期 |

### 当前版本不作出的承诺

- 不执行无人值守的表单提交或任意桌面动作。
- 审批后还不会签发加密的单次 capability lease。
- 尚不提供连续远程桌面控制。
- 尚未具备生产级 Node 身份、mTLS 或凭证轮换。
- 尚不能自主学习或验证技能、编辑记忆、导入员工包、复制员工或转移所有权。
- 当前员工模板只有校验和、尚未签名；它不携带记忆和主机权限，未来导入时仍必须隔离审核。
- Cua、Lume 和 coder Provider 目前是扩展边界，不是已完成的运行时。
- 可选办公室可视化不进入当前产品导航和 Web 构建。

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- npm 10 或更高版本
- Docker 与 Docker Compose

### 本地运行

```bash
git clone https://github.com/yxflc11/openbot.git
cd openbot
cp .env.example .env
```

编辑 `.env`，至少用互不相同的随机密钥替换下面两个开发占位值：

```dotenv
OPENBOT_OWNER_PASSWORD=<至少-12-个字符的随机密码>
OPENBOT_NODE_TOKEN=<随机-Node-登记令牌>
```

然后启动 PostgreSQL 和所有应用工作区：

```bash
npm install
npm run db:up
npm run dev
```

打开 <http://localhost:5173>，使用 `OPENBOT_OWNER_PASSWORD` 登录，创建 Bot、频道，并将 Bot
加入频道。

本地 Node 默认会诚实地上报“没有执行能力”。在配置兼容 Provider 前，消息仍会保存为排队中的
Run。运行 `npm run db:stop` 可以停止 PostgreSQL。

### 启用只读浏览器切片

在 Node 所在机器运行固定版本的
[CopilotKit/OpenBot `agent-computer`](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer)，
并只监听 loopback。使用同一 computer token 配置以下两个值，然后重启 Node：

```dotenv
OPENBOT_DOCKER_COMPUTER_URL=http://127.0.0.1:4100
OPENBOT_DOCKER_COMPUTER_TOKEN=<至少-16-个字符的随机令牌>
OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS=false
```

在频道发送一条包含明确公网 URL 的消息，例如：

```text
打开 https://example.com 并把截图发给我。
```

Server 会将 Run 分配给兼容 Node，流式返回结构化进度和最新画面，保存最终截图，并以所选
Bot 的身份把结果发回频道。

## 系统如何协作

```text
任意设备  ->  OpenBot Server  <- Node 主动出站连接 -  工作主机  ->  Providers
                唯一真相源                         Windows/macOS/Linux 等
```

| 组件 | 负责 | 不负责 |
| --- | --- | --- |
| Client | 交互、观察和提交审批决定 | 策略决定或执行授权 |
| Server | 身份、频道、Run、路由、策略、审批、审计和持久化 | 特定宿主机的电脑能力 |
| 工作主机 / Node | 能力发现、本地容量、Provider 执行、进度和产物 | 员工身份、技能、长期记忆或授权策略 |
| Provider | 一个窄执行后端，例如 Docker/browser、Cua、Lume 或 coder | 跨 Node 路由或权限升级 |

Server 是唯一真相源。Node 主动连接 Server，不需要开放公网管理端口。路由是确定性的：Run
固化的 execution profile 与在线 Node 能力求交集，模型不能选择未获授权的机器。

详细设计见[系统架构](docs/ARCHITECTURE.md)和
[Server/Node 决策记录](docs/decisions/0002-local-channel-server-node.md)。

## 安全

OpenBot 假设模型、提示词、网页、技能和执行环境都可能不可信。预期安全边界如下：

1. Server 授权，Node 执行。
2. Run 固定关联 Bot、频道、Node 和 execution profile。
3. 写入、破坏性和特权动作必须在审批前 fail closed。
4. 产物和实时事件必须经过大小限制与验证后才能发布。
5. Node 主动连接 Server；管理服务、数据库、Docker socket 和电脑后端不得暴露到公网。

在 loopback 以外使用时，请启用 HTTPS、设置 `OPENBOT_SECURE_COOKIES=true`、收紧
`OPENBOT_ALLOWED_ORIGINS`，并将服务放在 Tailscale 等私有网络后。

漏洞报告流程见 [SECURITY.md](SECURITY.md)，当前保证与已知缺口见
[威胁模型](docs/SECURITY.md)。

## 路线图

OpenBot 按用户验收结果推进。贡献应当推动一个完整用户结果，而不是增加彼此隔离的演示能力。

| 里程碑 | 用户结果 |
| --- | --- |
| M0 — 本地控制平面 | 频道、Bot、认证、持久化和审计不依赖专有云服务。目前基础已经可用。 |
| M1 — Server/Node 闭环 | 可替换 Node 接收浏览器任务并回传进度和截图。只读垂直切片已经可用，安全交互仍在开发。 |
| M2 — 远程控制与审批 | 手机访问、签名单次审批、通知和独占人工接管。持久化审批决定已经可用，lease 与接管是下一步。 |
| M3 — 可迁移员工 | 个人主页、进化档案、技能图谱、类型化记忆和安全员工模板。 |
| M4 — 原生工作主机 | Windows、macOS 和 Linux Provider 使用统一能力与审批协议。 |
| M5 — 多 Bot 运营 | 结构化交接、Routine、持久队列、Coder Provider 和认证员工转移。 |
| M6 — 发布 | 受管理移动设备、可复现安装器、签名发布、SBOM、升级、备份和恢复。 |

完整过线标准见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## 参与共建

OpenBot 的目标是开放共建。你不需要先理解整个系统才能参与。

可以从这些方向开始：

| 你的兴趣 | 建议入口 |
| --- | --- |
| 产品与移动端体验 | `apps/web`、[界面方案](docs/INTERFACE.md) |
| API、持久化与实时通信 | `apps/server`、`packages/db`、[API 文档](docs/API.md) |
| Node 协议与可靠性 | `apps/node`、`packages/protocol`、[系统架构](docs/ARCHITECTURE.md) |
| 电脑执行后端 | `providers/*`、`packages/provider-sdk` |
| 策略与安全 | `packages/policy`、[威胁模型](docs/SECURITY.md) |
| 文档与翻译 | `README*.md`、`docs/`、决策记录 |
| 可选体验 | `packages/office-plugin` 和未来插件，不能反向耦合核心应用 |

贡献流程：

1. 阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，选择一个有明确验收路径的小范围改动。
2. 认领已有 Issue，或使用仓库模板提交 Bug/Feature Issue。
3. 所有执行能力都必须位于有类型的 Provider 边界后，并提供 fail-closed 测试。
4. 提交 PR 前运行 `npm run check` 和 `npm audit`。
5. 完整填写 PR 模板，包括验证方式和安全影响。

文档也是功能的一部分。英文是项目的权威原文；维护中的翻译必须保持相同的能力声明、警告与
章节结构。欢迎贡献更多语言。

## 仓库结构

```text
apps/
  web/                 响应式频道界面
  server/              控制平面、API、持久化、路由和审批
  node/                主动出站连接的执行 Node daemon
packages/
  domain/              共享实体
  protocol/            带版本的 Server/Node 消息与 API 校验
  db/                  PostgreSQL schema 与 migration
  policy/              确定性的 fail-closed 策略计算
  provider-sdk/        Provider 契约
  office-plugin/       延后开发的可选可视化
providers/
  docker/              当前只读浏览器适配器
  cua/                 macOS 扩展边界
  lume/                macOS VM 扩展边界
  coder/               编码 Agent 扩展边界
deploy/                 Compose、systemd 和 launchd 资源
docs/                   产品、架构、安全、路线图、API 和 ADR
```

## 文档

| 目标 | 从这里开始 |
| --- | --- |
| 理解产品与边界 | [产品定义](docs/PRODUCT.md) |
| 理解整个系统 | [系统架构](docs/ARCHITECTURE.md) |
| 跟随当前实施顺序 | [目标模式执行计划](docs/EXECUTION_PLAN.zh-CN.md) |
| 查看当前与未来交付 | [路线图](docs/ROADMAP.md) |
| 基于 API 开发或集成 | [本地 API](docs/API.md) |
| 审查安全保证 | [威胁模型](docs/SECURITY.md) |
| 参与频道体验开发 | [界面方案](docs/INTERFACE.md) |
| 设计员工身份和迁移 | [可迁移数字员工模型](docs/EMPLOYEE.zh-CN.md) |
| 增加操作系统或设备 | [跨平台工作主机](docs/CROSS_PLATFORM.zh-CN.md) |
| 理解上游选择 | [上游策略](docs/UPSTREAMS.md) |
| 查看一项决策的原因 | [架构决策记录](docs/decisions/) |

## 上游项目

OpenBot 通过窄接口融合现有开源工作，不会把多个控制平面复制进同一个仓库：

- [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot) — 当前 `agent-computer` Provider
  边界与产品研究来源。
- [Cua](https://github.com/trycua/cua) 与 Lume — 计划中的 macOS 执行 Provider。
- [OpenClaw](https://github.com/openclaw/openclaw) — 可选运行时、技能与运维参考，不作为第二真相源。
- Codex、Claude 与 Multica — 计划中的隔离编码 Provider 集成。

任何引入的上游代码都必须保留其许可证和版权声明。

## 许可证与命名

OpenBot 使用 [MIT License](LICENSE)。

`OpenBot` 目前是工作项目名，而且已经被包括 CopilotKit/OpenBot 在内的公开项目使用。稳定发布前
必须选择一个可区分的正式名称。本项目与 xAI、腾讯、CopilotKit、OpenClaw 及其他参考项目不存在
隶属关系。
