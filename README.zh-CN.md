<p align="center">
  <img src="docs/design/openbot-readme-banner.png" alt="OpenBot" width="100%">
</p>

# OpenBot

**一套面向多频道、多 Agent 数字员工的自托管工作空间。**

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Node.js 22.22.2+](https://img.shields.io/badge/Node.js-22.22.2%2B-339933.svg)](package.json)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-f59e0b.svg)](#项目状态)

OpenBot 是一个早期阶段的开源、自托管平台，用来在你掌控的电脑上运行具名 AI 员工。OpenBot
本身也是一个 Agent，专注于多频道、多 Agent 的任务模式；它可以把有界任务交给外部 Agent，
同时由 OpenBot Server 统一掌握身份、路由、策略、审批、持久化和审计。

目标产品提供两个完整客户端。OpenBot Desktop 是推荐的引导式路径：每台电脑安装同一个应用，
然后自由启用 Client、Server 和 Worker 角色。OpenBot Web 连接同一个工作空间，也可以成为高级
用户拆分部署 Server、Web、PostgreSQL 和 Worker 服务后的主要客户端。

Mac mini 只是一种实用工作主机，不是产品边界。Windows、macOS 和 Linux 电脑都可以同时作为
日常使用电脑和获得授权的工作电脑。OpenBot 参考 Grok Bot 所代表的常驻频道体验和 DeepSeek
Harness 的网页 Agent 管理体验，同时坚持自托管、Provider 中立、自由扩展和明确的人类控制边界。

> [!WARNING]
> OpenBot 目前是 pre-alpha 源代码，并不是下文描述的完整 Desktop 产品。当前电脑 Provider
> 只有只读能力，**不会**填写、点击、提交或控制生产账号。请勿连接付款方式、主账号或生产
> 凭证。对外部署前请先阅读[安全说明](#安全)。

## 为什么做 OpenBot

- **本地频道，而非一次性聊天窗口。** Bot、对话、Run 和结果都保存在你自己的 PostgreSQL。
- **电脑可以跨平台替换。** 员工是持久身份和策略；工作主机可以是 Windows、macOS、Linux、
  VM、容器或受管理设备。
- **员工可以成长和迁移。** 每个员工都有可追溯的进化档案、技能图谱、决策轨迹、记忆、工作
  记录、配置和安全迁移控制。
- **副作用前审批。** 敏感动作必须进入明确且可审计的审批状态，模型不能自行扩大权限。
- **Desktop 与 Web 共享一个工作空间。** 两个客户端使用同一套 Server 管理的频道、Agent、
  任务、审批、设备、插件和历史。
- **每台电脑自由组合角色。** 同一个 Desktop 可以作为 Client、承载 Server、运行 Worker 服务，
  或同时承担多个角色。
- **OpenBot 原生 Agent 加外部 Agent。** OpenBot 负责组织任务，并可以把有界工作交给 Hermes、
  Pi、OpenClaw 和未来适配器。
- **自由扩展但不能自授权。** 插件可以改变呈现方式，或增加工具、频道、Agent 和自动化，但只有
  Server 可以授予权限。
- **可组合的 Bot 身份。** Bot 外观由头型、身体、移动方式、配件和强调色五个独立层保存。
- **通过适配器避免锁定。** 模型、电脑运行时和上游项目通过有类型、带版本的边界接入。

员工进化与学习方向明确受
[Hermes Agent learning graph](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/agent/learning_graph.py)
启发。OpenBot 使用自己的 Server 权威证据、审核、权限和迁移模型，不会把学习图谱概念说成
OpenBot 原创。

## 目标产品模式

> [!NOTE]
> 本节定义已经确认的产品方向，但不代表 Desktop、引导式服务安装、外部 Agent 适配器或插件
> 平台目前已经可用。

| 使用入口 | 目标体验 |
| --- | --- |
| OpenBot Desktop | macOS、Windows 和 Linux 的推荐完整客户端，负责引导创建工作空间、连接、服务安装、权限、诊断和恢复。 |
| OpenBot Web | 远程访问同一工作空间的完整浏览器客户端，也可以作为模块化自部署的主要客户端。 |
| 模块化自部署 | 不安装 Desktop，分别安装 Server、Web、PostgreSQL 和一个或多个 Worker 服务的高级路径。 |

Desktop 角色是可以组合的能力，不是不同产品版本：

| 角色 | 责任 |
| --- | --- |
| Client | 频道、消息、任务、审批、设置和观察。 |
| Server | 工作空间真相、身份、路由、策略、审批、持久化和审计。 |
| Worker | 通过明确授权的 Provider 在当前电脑后台执行任务。 |

一台电脑可以同时启用三个角色。“五台电脑”只是接入进度，不是许可证或权限上限；每台电脑都
独立登记，也可以被单独撤销。

OpenBot 接入外部 Agent 的第一种方式是有界任务委派。只有在身份、记忆、生命周期和权限行为
通过与原生 OpenBot Agent 相同的一致性测试后，外部 Agent 才会成为频道的直接成员。

插件将支持 UI/主题、频道、Agent 适配器、工具/Provider、自动化和可选体验。插件可以在已经
授予的能力内决定功能如何呈现和运行，但不能决定自己拥有什么权限。

## 项目状态

OpenBot 已经跑通“本地频道 → 远程执行 Node → 结果回到频道”的受测试垂直切片。下表刻意
区分已落地代码与未来能力。

| 领域 | 当前已经可用 | 下一步 |
| --- | --- | --- |
| 控制平面 | 本地 Owner 认证、带漂移检查的 PostgreSQL migration、Bot、频道、成员、消息、Run、审批、产物、员工记忆生命周期、不含正文的多设备档案失效通知和审计事件 | Desktop 引导、持久 routine、记忆检索/保留、自动恢复工具和多用户信任模型 |
| 客户端 | 响应式频道优先 Web UI、指定 Bot、Bot 身份结果、引用回复、富文本/表格、任务 Inspector、审批、工作主机管理、有界 SSE 与快照恢复、可访问员工 Tab 和原生模态焦点管理 | 共享 React UI 的沙箱化 Electron Desktop、角色设置引导、可安装 Web/PWA、通知和本地化完善 |
| Bot 身份 | 五层组合外观已随 Bot 持久化，并统一用于频道和员工主页 | 更多部件和社区外观包 |
| 员工档案 | 七视图个人主页、带 revision 冲突检查的职责/简介编辑、受 Hermes 启发且可按类型和时间检查完整证据引用的进化档案、Owner 技能审核、带无内容审计的 Owner 管理分类记忆、保留简介并精确绑定审核后下载的安全模板导出、隔离导入、审核后生成新身份，以及实验性 DSSE 签名 | 显示名/模型/主机/外观策略编辑、记忆检索/保留和自主提案、系统钥匙串/KMS 与公开信任适配器、带完整 diff 审核的可执行 Agent Skills 包、选择性复制、注册表分发和所有权转移 |
| Node 协议 | 出站 WebSocket 登记、Owner 界面配对/列表/吊销、可单独吊销的凭证、心跳、容量、精确能力主版本路由、两阶段分配、显式启动、进度、画面、完成、断线恢复，以及带契约测试 Secret Service 的实验性 Linux 系统/用户服务配置 | Worker 角色安装引导、持有证明身份、mTLS、轮换、防重放、原生密钥库、签名安装器和真实设备一致性报告 |
| 浏览器执行 | 通过固定版本的 CopilotKit/OpenBot `agent-computer` 打开明确的公网 HTTP(S) URL，并返回有界 PNG 截图 | Observe/fill/act 循环、连续画面、安全表单交互和重试语义 |
| 人类控制 | 绑定 Run、Node、动作、目标指纹、风险和过期时间的持久审批请求/决定 | 单次签名 capability lease 和独占远程接管 |
| Provider | 可工作的只读 Docker/browser 适配器；有类型的 Cua、Lume 和 coder 包边界 | 跨平台浏览器、Windows、macOS、Linux 桌面、受管理 Android 和隔离编码 Provider |
| Agent runtime | Server 掌握的 Bot、频道、Run、结果、档案、技能、记忆和审计基础 | OpenBot 原生 Agent、持久多 Agent 交接，以及有界 Hermes、Pi 和 OpenClaw 适配器 |
| 插件 | 与核心应用无依赖的 `@openbot/office-plugin` 隔离包 | 权限清单、生命周期、沙箱化 Host API、UI 插槽、本地开发和未来可信分发 |
| 分发 | 源代码和一个较早的源码基础预览 | GitHub Releases 中的签名 Desktop 安装包、Worker 产物、升级/回滚证据，以及可独立使用的 SDK 或容器包 |

### 当前版本不作出的承诺

- 目前没有公开的 OpenBot Desktop、引导式多角色安装器、可安装 Worker Host 或 GitHub
  Packages 产物；旧 `v0.1.0-alpha.1` 只是源码基础预览，不代表当前仓库或目标 Desktop 产品。
- 不执行无人值守的表单提交或任意桌面动作。
- 审批后还不会签发加密的单次 capability lease。
- 尚不提供连续远程桌面控制。
- Node 已能独立登记与吊销，但当前身份仍是可复制的 bearer secret。Linux 专用登录用户可以明确
  选择 Secret Service 且不会退回文件，但真实密钥库/systemd 设备证据仍待完成。它还不是持有
  证明身份或 mTLS，只能通过 WSS 与可信私网使用。
- 模型尚不能自主写入或检索长期记忆，也没有保留期限执行、选择性复制员工经验、注册表分发或
  所有权转移。登录 Owner 已可以手动新增、编辑和删除有界记忆；所有 v1 员工包仍排除记忆。
- Owner 已可编辑员工职责和说明性简介；它们只是路由上下文，不是模型策略、技能、主机绑定或
  权限，并发编辑使用 revision 检查拒绝旧版本覆盖。
- 员工导出默认仍不签名。运维者可以启用实验性的 DSSE 签名：私钥加密保存于文件密钥库，轮换与
  撤销只能通过离线命令执行，外部发布者公钥必须显式信任；导出下载会绑定到审核过的精确包字节，
  导入激活仍须绑定预览摘要、由 Owner 明确确认、生成新身份，并让全部技能保持候选禁用，且不带
  记忆或主机权限。
- Cua、Lume 和 coder Provider 目前是扩展边界，不是已完成的运行时。
- Hermes、Pi 和 OpenClaw 目前只是计划集成，不是当前构建中可用的适配器。
- 目前还没有插件安装、权限、沙箱、更新或回滚生命周期。
- 可选办公室可视化不进入当前产品导航和 Web 构建。

## 快速开始

以下是当前 Web/Server/Node 切片的开发者源码安装方式，不是计划中的 Desktop 安装流程。

### 环境要求

- Node.js 22.22.2+、24.15.0+ 或 26+
- npm 10 或更高版本
- Docker 与 Docker Compose

Server 容器固定使用 Node.js `24.20.0` LTS，以多阶段构建和非 root 进程运行。Compose 命令、
旧数据卷注意事项与当前证据边界见 [Server 容器部署与验证](docs/SERVER_CONTAINER.zh-CN.md)。

### 本地运行

```bash
git clone https://github.com/yxflc11/openbot.git
cd openbot
cp .env.example .env
```

编辑 `.env`，替换 Owner 密码占位值：

```dotenv
OPENBOT_OWNER_PASSWORD=<至少-15-个字符的随机密码>
```

Server 只把直接对端 IP 用作经摘要化的登录/登记限速键。如果前面恰好有一层反向代理，请把
`OPENBOT_TRUSTED_PROXY_ADDRESS` 设置为该代理的准确 IP；只有此时才接受单个 RFC 7239
`Forwarded: for=...` 值。不要把它配置为代理网段或多跳代理链。

安装依赖、启动 PostgreSQL，然后分别启动 Server 与 Web：

```bash
npm install
npm run db:up
npm run dev:server
# 另开一个终端：
npm run dev:web
```

登录 Web 后，从侧栏打开**节点**即可创建短时、单次配对令牌。Server 主机上的 CLI 提供同一操作：

```bash
npm run node:enrollment-token -- local-development-node
```

把输出的 `OPENBOT_NODE_ENROLLMENT_TOKEN` 放进 `.env`，运行 `npm run dev:node`；首次成功启动
后立刻从 `.env` 删除该令牌。Node 会用 Owner-only 权限把新凭证保存在
`./data/node/identity.json`，以后启动直接复用。打开 <http://localhost:5173>，使用
`OPENBOT_OWNER_PASSWORD` 登录，创建 Bot、频道并将 Bot 加入频道。远程主机配对前请阅读
[Node 登记](docs/NODE_ENROLLMENT.zh-CN.md)。

本地 Node 默认会诚实地上报“没有执行能力”。在配置兼容 Provider 前，消息仍会保存为排队中的
Run。运行 `npm run db:stop` 可以停止 PostgreSQL。
升级、备份或恢复部署前请先阅读[数据库运维](docs/DATABASE.zh-CN.md)。
如需为可迁移员工模板签名，请按实验性的[员工包签名手册](docs/EMPLOYEE_SIGNING.zh-CN.md)
初始化；默认不开启签名。

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
Desktop（计划）--+
                 +--> OpenBot Server --> OpenBot Agent / 有界适配器（计划）
Web（已可用）----+       唯一真相源              |
                                                v
                                  Worker 主动出站连接 --> Providers
                                  Windows / macOS / Linux
```

| 组件 | 负责 | 不负责 |
| --- | --- | --- |
| Desktop / Web Client | 交互、观察、配置和提交审批决定 | 策略决定或执行授权 |
| Server | 身份、频道、Run、路由、策略、审批、审计和持久化 | 特定宿主机的电脑能力 |
| OpenBot Agent / Agent 适配器 | 规划、有界任务、结构化进度和结果 | 授予权限、设备授权或审计真相 |
| 工作主机 / Node | 能力发现、本地容量、Provider 执行、进度和产物 | 员工身份、技能、长期记忆或授权策略 |
| Provider | 一个窄执行后端，例如 Docker/browser、Cua、Lume 或 coder | 跨 Node 路由或权限升级 |
| 插件 | 在声明并获准的能力内改变呈现或行为 | 自行授权或绕过 Server 策略 |

Server 是唯一真相源。Node 主动连接 Server，不需要开放公网管理端口。路由是确定性的：Run
固化的 execution profile 与在线 Node 能力求交集，模型不能选择未获授权的机器。

详细设计见[系统架构](docs/ARCHITECTURE.md)和
[Server/Node 决策记录](docs/decisions/0002-local-channel-server-node.md)。

## 开发技术基线

OpenBot 尽量减少语言数量，让大多数贡献者只需 Node.js 和 npm：

| 范围 | 基线 |
| --- | --- |
| 共享产品代码 | Web、Server、Node、协议、Agent 适配器、插件 SDK 和测试统一使用 TypeScript |
| 用户界面 | Web 和计划中的 Electron Desktop 共用 React 与 Vite |
| JavaScript 生产运行时 | 推荐 Node.js 24 LTS；当前源码仍遵循 `package.json` 中更宽的 engine 范围 |
| 持久化 | PostgreSQL 和经过审核的 SQL migration |
| macOS 专属集成 | 只用一层很薄的 Swift 处理 Keychain、服务生命周期、权限和原生控制 |
| Windows 专属集成 | 只用一层很薄的 C#/.NET 处理 Service、受保护凭证、进程监管和原生控制 |
| 外部 Agent | 保留上游语言并放在有类型的 OpenBot 适配器之后；Hermes 使用 Python 不会让 Python 成为 OpenBot 核心语言 |

Electron 是已经接受的 Desktop 方向，因为它可以最大程度复用现有 TypeScript/React 系统；正式
实现前仍必须按照仓库调研与 ADR 流程固定精确版本。Rust 不是核心语言，除非以后有经过证据确认的
平台缺口必须引入。

## 安全

OpenBot 假设模型、提示词、网页、技能和执行环境都可能不可信。预期安全边界如下：

1. Server 授权，Node 执行。
2. Run 固定关联 Bot、频道、Node 和 execution profile。
3. 写入、破坏性和特权动作必须在审批前 fail closed。
4. 产物和实时事件必须经过大小限制与验证后才能发布。
5. Node 主动连接 Server；管理服务、数据库、Docker socket 和电脑后端不得暴露到公网。

在 loopback 以外使用时，请启用 HTTPS、设置 `OPENBOT_SECURE_COOKIES=true`、收紧
`OPENBOT_ALLOWED_ORIGINS`，并将服务放在 Tailscale 等私有网络后。
Server 现在会在启动前拒绝远程 HTTP Origin，或拒绝未启用 Secure Cookie 的远程 Origin。
HTTPS 会话使用仅限主机的 `__Host-openbot_session` Cookie 与 HSTS；直接开发默认只监听 loopback。

漏洞报告流程见 [SECURITY.md](SECURITY.md)，当前保证与已知缺口见
[威胁模型](docs/SECURITY.md)。

## 路线图

OpenBot 按用户验收结果推进。贡献应当推动一个完整用户结果，而不是增加彼此隔离的演示能力。

| 里程碑 | 用户结果 |
| --- | --- |
| 基础——当前已可用 | 本地频道、Bot、认证、PostgreSQL 持久化、审计、员工档案、Node 路由、审批和只读浏览器闭环。 |
| R0——产品与技术契约 | 对齐双语文档，记录 Desktop/Web/角色模型，并固定经过调研的技术决策。 |
| R1——共享 Desktop 与 Web | 在沙箱化 Electron Desktop 中复用 React UI，同时保留完整浏览器客户端。 |
| R2——引导式角色与多电脑 | 创建或加入工作空间，启用 Client/Server/Worker 角色，安装服务，逐台配对、诊断和撤销电脑。 |
| R3——模块化自部署 | 不安装 Desktop 也能运维 Server、Web、PostgreSQL 和 Worker，并具备备份、恢复和私网指引。 |
| R4——原生 OpenBot 与外部 Agent | 让 OpenBot 成为持久协调 Agent，再把 Hermes、Pi 和 OpenClaw 作为有界适配器接入同一权限边界。 |
| R5——插件平台 | 提供有权限控制的 UI、主题、频道、Agent、工具/Provider、自动化和可选体验插件，并支持生命周期与回滚。 |
| R6——安全电脑控制 | 提供 observe/fill/act、单次 capability lease、连续画面、独占接管和有真实证据的原生 Provider。 |
| R7——分发 | 通过 GitHub Releases 提供签名 Desktop 安装包、经过验证的 Worker 产物、SBOM、升级、回滚、备份和恢复。 |

在 R1 实现开始前，聚焦的产品、架构与路线图文档将与这套已确认顺序同步。同步任务通过审核前，
[docs/ROADMAP.md](docs/ROADMAP.md)继续保留现有能力过线标准。

## 参与共建

OpenBot 的目标是开放共建。你不需要先理解整个系统才能参与。

大多数贡献者只需要推荐的 Node.js 24 LTS 和 npm。只有修改 macOS 原生代码时才需要 Swift，
只有修改 Windows 原生代码时才需要 .NET；跨平台验证由托管 CI 承担。

可以从这些方向开始：

| 你的兴趣 | 建议入口 |
| --- | --- |
| Desktop 与 Web 共享体验 | `apps/web`、未来的 `apps/desktop`、[界面方案](docs/INTERFACE.md) |
| API、持久化与实时通信 | `apps/server`、`packages/db`、[API 文档](docs/API.zh-CN.md) |
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

请使用 fork 或聚焦的功能分支提交 PR，功能代码不直接进入 `main`。贡献者只需安装自己修改的
平台专属代码所要求的工具链。

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
  provider-conformance-runner/ 有界 Provider 场景证据
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
| 基于 API 开发或集成 | [本地 API](docs/API.zh-CN.md) |
| 审查安全保证 | [威胁模型](docs/SECURITY.md) |
| 参与频道体验开发 | [界面方案](docs/INTERFACE.md) |
| 审查或改进键盘与辅助技术行为 | [无障碍基线](docs/ACCESSIBILITY.zh-CN.md) |
| 设计员工身份和迁移 | [可迁移数字员工模型](docs/EMPLOYEE.zh-CN.md) |
| 运维签名员工包 | [员工包签名手册](docs/EMPLOYEE_SIGNING.zh-CN.md) |
| 增加操作系统或设备 | [跨平台工作主机](docs/CROSS_PLATFORM.zh-CN.md) |
| 检查工作主机或 Provider 声明 | [Provider 一致性测试](docs/PROVIDER_CONFORMANCE.zh-CN.md) |
| 理解上游选择 | [上游策略](docs/UPSTREAMS.md) |
| 遵循开源优先审查流程 | [开源复用规则与当前审查](docs/OPEN_SOURCE_REUSE.zh-CN.md) |
| 领取可独立审查的共建任务 | [贡献者任务包](docs/CONTRIBUTOR_TASKS.zh-CN.md) |
| 查看一项决策的原因 | [架构决策记录](docs/decisions/) |

## 上游项目

OpenBot 通过窄接口融合现有开源工作，不会把多个控制平面复制进同一个仓库：

- [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot) — 当前 `agent-computer` Provider
  边界与产品研究来源。
- [Cua](https://github.com/trycua/cua) 与 Lume — 计划中的 macOS 执行 Provider。
- [OpenClaw](https://github.com/openclaw/openclaw) — 计划中的有界适配器候选、技能与运维参考，
  永远不作为第二真相源。
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — 第一项外部 Agent 适配器候选，
  也是员工进化档案、学习图谱、技能与记忆分离以及技能写入审核的明确署名产品参考。
- Pi——计划中的外部 Agent 适配器候选；实现前必须在调研记录中确定准确上游和版本。
- [Agent Skills](https://github.com/agentskills/agentskills) — 未来可执行技能包采用的开放格式与
  官方校验器。
- Codex、Claude 与 Multica — 计划中的隔离编码 Provider 集成。

任何引入的上游代码都必须保留其许可证和版权声明。

## 许可证与命名

OpenBot 使用 [MIT License](LICENSE)。

`OpenBot` 目前是工作项目名，而且已经被包括 CopilotKit/OpenBot 在内的公开项目使用。稳定发布前
必须选择一个可区分的正式名称。本项目与 xAI、腾讯、CopilotKit、OpenClaw 及其他参考项目不存在
隶属关系。
