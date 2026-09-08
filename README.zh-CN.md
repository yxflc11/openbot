# OpenBot

**一套用于常驻数字员工的自托管控制平面。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Node.js 22.22.2+](https://img.shields.io/badge/Node.js-22.22.2%2B-339933.svg)](package.json)
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
> OpenBot 仍处于 pre-alpha 阶段。自动浏览器任务仍为只读；Owner 可以明确接管员工浏览器并手动操作。请勿连接付款方式、主账号或生产凭证。对外部署前请先阅读
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

员工进化与学习方向明确受
[Hermes Agent learning graph](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/agent/learning_graph.py)
启发。OpenBot 使用自己的 Server 权威证据、审核、权限和迁移模型，不会把学习图谱概念说成
OpenBot 原创。

## 项目状态

OpenBot 已经跑通“本地频道 → 远程执行 Node → 结果回到频道”的受测试垂直切片。下表刻意
区分已落地代码与未来能力。

| 领域 | 当前已经可用 | 下一步 |
| --- | --- | --- |
| 控制平面 | 本地 Owner 认证、带漂移检查的 PostgreSQL migration、Bot、频道、成员、消息、Run、审批、产物、员工记忆生命周期、不含正文的多设备档案失效通知和审计事件 | 持久 routine、记忆检索/保留、自动恢复工具和多用户信任模型 |
| 频道界面 | 响应式频道优先 Web UI、指定 Bot、Bot 身份结果、引用回复、富文本/表格、任务 Inspector、审批、工作主机管理、有界 SSE 与快照恢复、可访问员工 Tab 和原生模态焦点管理 | 可安装 PWA、通知投递、真实屏幕阅读器/缩放证据和本地化完善 |
| Bot 身份 | 五层组合外观已随 Bot 持久化，并统一用于频道和员工主页 | 更多部件和社区外观包 |
| 员工档案 | 七视图个人主页、带 revision 冲突检查的职责/简介编辑、受 Hermes 启发且可按类型和时间检查完整证据引用的进化档案、Owner 技能审核、带无内容审计的 Owner 管理分类记忆、保留简介并精确绑定审核后下载的安全模板导出、隔离导入、审核后生成新身份，以及实验性 DSSE 签名 | 显示名/主机/外观策略编辑、记忆检索/保留和自主提案、系统钥匙串/KMS 与公开信任适配器、带完整 diff 审核的可执行 Agent Skills 包、选择性复制、注册表分发和所有权转移 |
| Node 协议 | 出站 WebSocket 登记、Owner 界面配对/列表/吊销、可单独吊销的凭证、心跳、容量、精确能力主版本路由、两阶段分配、显式启动、进度、画面、完成和断线恢复 | 持有证明身份、mTLS、轮换、防重放、系统密钥库适配和真实设备一致性报告 |
| 浏览器执行 | 明确 URL 截图任务；内置员工浏览器面板、持久登录配置、PNG 刷新、导航和人工输入 | 模型自主 observe/fill/act、视频帧率、下载和标签页管理 |
| 人类控制 | 持久 Run 审批，以及有期限、独占、无正文审计的 Owner 浏览器接管 | 自动动作的单次签名 capability lease 和更广泛的桌面接管 |
| Provider | 支持只读任务和人工接管的 Docker/browser 适配器；有类型的 Cua、Lume 和 coder 包边界 | 跨平台浏览器、Windows、macOS、Linux 桌面、受管理 Android 和隔离编码 Provider |
| 模型对话 | Owner 管理模型连接，支持 11 家服务预设、已授权自定义地址、按员工选择模型、API Key 加密、有界文本回复、持久化 Run 和实时更新；无需工作主机 | 逐 token 输出和独立授权的工具 |
| 办公室视图 | 与核心应用无依赖的 `@openbot/office-plugin` 隔离包 | 等频道工作流成熟后再建设可选插件生命周期 |

### 当前版本不作出的承诺

- 不执行无人值守的表单提交或任意桌面动作。
- 审批后还不会签发加密的单次 capability lease。
- 尚不提供连续远程桌面控制。
- Node 已能独立登记与吊销，但当前凭证仍是保存在 Owner-only 文件里的 bearer secret；它还不是
  持有证明身份、mTLS 或系统密钥库存储，只能通过 WSS 与可信私网使用。
- 模型尚不能自主写入或检索长期记忆，也没有保留期限执行、选择性复制员工经验、注册表分发或
  所有权转移。登录 Owner 已可以手动新增、编辑和删除有界记忆；所有 v1 员工包仍排除记忆。
- Owner 已可编辑员工职责和说明性简介；它们只是路由上下文，不是模型策略、技能、主机绑定或
  权限，并发编辑使用 revision 检查拒绝旧版本覆盖。
- 员工导出默认仍不签名。运维者可以启用实验性的 DSSE 签名：私钥加密保存于文件密钥库，轮换与
  撤销只能通过离线命令执行，外部发布者公钥必须显式信任；导出下载会绑定到审核过的精确包字节，
  导入激活仍须绑定预览摘要、由 Owner 明确确认、生成新身份，并让全部技能保持候选禁用，且不带
  记忆或主机权限。
- Cua、Lume 和 coder Provider 目前是扩展边界，不是已完成的运行时。
- 可选办公室可视化不进入当前产品导航和 Web 构建。

## 快速开始

### 环境要求

- Node.js 22.22.2+、24.15.0+ 或 26+
- npm 10 或更高版本
- Docker 与 Docker Compose

### 本地运行

```bash
git clone https://github.com/yxflc11/openbot.git
cd openbot
cp .env.example .env
```

编辑 `.env`，替换 Owner 密码占位值：

```dotenv
OPENBOT_OWNER_PASSWORD=<至少-12-个字符的随机密码>
```

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

本地 Node 默认会诚实地上报“没有执行能力”。在配置兼容 Provider 前，电脑类型的消息仍会保存为
排队中的 Run；模型对话按下文说明在 Server 上执行。运行 `npm run db:stop` 可以停止 PostgreSQL。
升级、备份或恢复部署前请先阅读[数据库运维](docs/DATABASE.zh-CN.md)。
如需为可迁移员工模板签名，请按实验性的[员工包签名手册](docs/EMPLOYEE_SIGNING.zh-CN.md)
初始化；默认不开启签名。

### 配置模型服务

在 Web 应用打开“模型服务”，选择服务商和签发 API Key 的地区，为连接命名并保存 Key。
预设覆盖 OpenAI、Anthropic/Claude、Google Gemini、DeepSeek、Kimi/Moonshot、OpenRouter、
硅基流动、阿里云百炼、智谱/Z.AI、MiniMax 和火山方舟。Server 会填入已审查的 API 地址和协议。

保存连接不会调用付费推理。支持时可获取模型列表，也可选择推荐 ID 或手动填写模型 ID。
自动获取只读取一页、最多显示 256 个 ID，上游响应不超过 2 MiB；列表不可用或不完整时仍可手填。
推荐和列表不保证账号拥有调用权限，也不保证每个条目都适合文本对话。“测试模型”会明确发送一条
简短推理请求，可能产生服务商费用。

在“创建 Bot”中选择模型对话类型，再选择连接和模型。已有模型对话员工可在主页修改选择。
频道 Run 排队时会固定连接 ID 和模型 ID；后续修改员工配置不会改变已排队 Run 的选择。
已保存连接缺失、停用或未获授权时，Run 会明确失败，不会自动换到其他服务。连接地址和协议创建后
不可修改；更换时需新建连接。通过 `enabled` 停用已有连接，当前没有删除连接操作。

API Key 使用 AES-256-GCM 加密后保存在 PostgreSQL。Server 会自动创建单独的本地加密密钥文件，
路径由 `OPENBOT_MODEL_CREDENTIAL_KEY_PATH` 指定，默认 `./data/model-credentials.key`，相对于
Server 进程工作目录。**备份数据库时必须同时备份该密钥文件。** 已有保存连接但密钥文件丢失时，
Server 会拒绝启动，不会生成替代密钥。文件权限限制为 POSIX `0600`；这是文件系统密钥边界，
不是系统钥匙串或 KMS。API 响应、Node、审计事件和员工导出均不接收连接密钥；本地连接绑定也不会
随员工包导出。

使用其他兼容 OpenAI 的服务前，Server 管理员需先在 `.env` 中授权精确的 HTTPS API 基础地址，
Owner 才能在“自定义”中选择它：

```dotenv
OPENBOT_MODEL_CUSTOM_BASE_URLS=https://models.example.com/v1,https://gateway.example.com/api/v1
```

该逗号分隔列表默认为空。预设只接受已审查地址，自定义连接只接受列表中的精确地址；比较前会去除
末尾斜杠。URL 内嵌凭据、查询参数、fragment、明文 HTTP 和重定向都会被拒绝。浏览器不能自行
授权任意外部请求地址。

Server 默认使用 `OPENBOT_MODEL_MAX_TOKENS=4096`、`OPENBOT_MODEL_TIMEOUT_MS=90000` 和
`OPENBOT_MODEL_MAX_CONCURRENT_RUNS=2`，不会自动重试付费请求。每次请求将当前消息及同一员工、
同一频道最近最多十轮已完成问答作为引用上下文；历史序列化后最多 24,000 字符，可见回复最多
16,000 字符，上游聊天响应最多 256 KiB。私有推理不会展示或持久化。所有支持工具调用的模型现在都通过 Server 共享
`web_search` 和 `fetch`。OpenAI 兼容协议与 Claude 原生协议都支持完整工具续轮，推理和签名
只保留在当前任务内存中；最终回答仍由员工选择的模型生成。

检索服务与回答模型分开配置，优先级如下：

1. `TAVILY_API_KEY`：独立 Tavily 搜索和网页提取，供所有已配置模型使用。
2. `OPENBOT_WEB_SEARCH_CONNECTION_ID`：明确指定一个已启用的官方 Kimi 连接；
   `OPENBOT_WEB_SEARCH_MODEL` 默认为 `kimi-k3`。
3. 已有 `MOONSHOT_API_KEY`：自动复用为共享检索服务。Kimi 可直接使用 Formula，其他模型通过
   Kimi 转接获得可读来源摘要。

没有检索服务时，其他模型保持文本对话，不会随意选用某个已保存账户。转接只接收已校验的公开
检索请求，不接收员工聊天历史；Kimi 密文和检索凭据不会发送给回答模型。每次转接最多一次
Formula 执行和两次 Kimi 推理，因此会产生相应检索与推理费用。所有模型共用每项任务四次工具
上限和总超时；公开检索无需逐个网址授权，失败明确报错，不自动重试付费请求。审计只保存工具名
和阶段。未增加电脑操作、自主记忆访问或逐 token 输出。

所有模型服务预设都有协议契约测试，具体模型 ID 仍须支持工具调用。只有实际使用已授权 Key
测试过的服务，才声明真实调用通过。详见[统一联网工具调研](docs/research/shared-model-web-tools.zh-CN.md)。

### 兼容已有 Kimi 环境配置

已有未绑定连接的模型员工继续兼容 Server 本地、已被 Git 忽略的 `.env` 设置：

```dotenv
MOONSHOT_API_KEY=<你的-kimi-api-key>
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1
MOONSHOT_MODEL=kimi-k3
MOONSHOT_REASONING_EFFORT=low
```

修改后重启 Server。配置存在时，界面将其显示为只读 `legacy-kimi` 连接；只能通过 Server 配置修改，
不能通过 API 编辑。使用与 Key 对应的官方国内或国际（`https://api.moonshot.ai/v1`）地址。
环境 Key 不会复制进已保存连接表。清除员工的显式绑定后会恢复未绑定行为；若没有旧环境凭据，
后续模型 Run 会明确失败。已保存连接的失败不会触发这条兼容路径。

### 启用员工浏览器

配置下面两个值后，在工作主机执行 `npm run browser:up`，再启动已注册的 Node。创建员工时选择
**员工浏览器 · Docker**，从员工主页点击 **打开浏览器**。先接管再导航、点击和输入，完成后交还
员工。配置、会话行为和当前限制见[员工浏览器](docs/EMPLOYEE_BROWSER.zh-CN.md)。

启动命令会构建固定版本的
[CopilotKit/OpenBot `agent-computer`](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer)，
只监听 loopback，并通过命名卷保留员工登录状态。运行时与 Node 使用同一个 computer token：

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
Server 现在会在启动前拒绝远程 HTTP Origin，或拒绝未启用 Secure Cookie 的远程 Origin。
HTTPS 会话使用仅限主机的 `__Host-openbot_session` Cookie 与 HSTS；直接开发默认只监听 loopback。

漏洞报告流程见 [SECURITY.md](SECURITY.md)，当前保证与已知缺口见
[威胁模型](docs/SECURITY.md)。

## 路线图

OpenBot 按用户验收结果推进。贡献应当推动一个完整用户结果，而不是增加彼此隔离的演示能力。

| 里程碑 | 用户结果 |
| --- | --- |
| M0 — 本地控制平面 | 频道、Bot、认证、持久化和审计不依赖专有云服务。目前基础已经可用。 |
| M1 — Server/Node 闭环 | 可替换 Node 接收浏览器任务并回传进度和截图。只读垂直切片已经可用，安全交互仍在开发。 |
| M2 — 远程控制与审批 | 手机访问、签名单次审批、通知和独占人工接管。持久化审批与独占浏览器接管已经可用，自动动作的签名 lease 仍待实现。 |
| M3 — 可迁移员工 | 个人主页、进化档案、技能图谱、类型化记忆、审核绑定的安全员工模板和审核后新身份激活。 |
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
  docker/              支持只读任务和人工控制的浏览器适配器
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
- [OpenClaw](https://github.com/openclaw/openclaw) — 可选运行时、技能与运维参考，不作为第二真相源。
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — 员工进化档案、学习图谱、技能与
  记忆分离以及技能写入审核的产品参考。
- [Agent Skills](https://github.com/agentskills/agentskills) — 未来可执行技能包采用的开放格式与
  官方校验器。
- Codex、Claude 与 Multica — 计划中的隔离编码 Provider 集成。

任何引入的上游代码都必须保留其许可证和版权声明。

## 许可证与命名

OpenBot 使用 [MIT License](LICENSE)。

`OpenBot` 目前是工作项目名，而且已经被包括 CopilotKit/OpenBot 在内的公开项目使用。稳定发布前
必须选择一个可区分的正式名称。本项目与 xAI、腾讯、CopilotKit、OpenClaw 及其他参考项目不存在
隶属关系。
