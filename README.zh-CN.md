<p align="center">
  <img src="docs/design/openbot-readme-banner.png" alt="OpenBot" width="100%">
</p>

# OpenBot

**通过 Desktop 与 Web 使用的自托管数字员工工作区。**

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-f59e0b.svg)](#项目状态)

OpenBot 让有名字的 AI 员工在你控制的电脑上工作。频道、对话、员工档案、任务、审批和结果都保存在
自己的工作区。Desktop 和 Web 共用 React 界面，连接同一个具有最终授权权的 OpenBot Server。

同一个 Desktop 可以随着各平台实现的完善，组合启用 **Client（客户端）**、**Server（服务端）**
和 **Worker（工作节点）**。Client 用于指挥与监督；Worker 和 Provider 在已登记电脑上执行；
Server 负责身份、路由、授权和审计。界面能显示桌面，并不代表获得了操作电脑的权限。

> [!WARNING]
> OpenBot 仍处于 pre-alpha。Desktop 产物是未签名开发包，不是经过签名的公开安装器。
> 当前电脑 Provider 只能打开明确的公网 URL 并返回截图；任意桌面点击、输入和无人值守表单提交
> 尚未实现。不要连接支付方式、主账号或生产凭证。

## Windows、macOS 与 Linux Desktop

三端使用相同的 Electron 44.2.0 应用和共享频道工作区。

| 目标平台 | Desktop 客户端 | 本地 Server 安装 | 本地 Worker 集成 |
| --- | --- | --- | --- |
| macOS arm64 | 连接已有 Server、原生导航与工作区界面 | 内置 PostgreSQL 和 Server；应用自行管理本地数据，无需 Docker | 通过随包提供的 macOS Worker companion 引导配对 |
| Windows x64 | 连接已有 Server 与共享工作区界面 | 使用单独部署的 Server | 原生 Windows Host 已有构建与契约测试证据；Desktop 内一体安装仍待实现 |
| Linux x64 | 连接已有 Server 与共享工作区界面 | 使用单独部署的 Server | 单独部署 Node/服务；Desktop 内一体安装仍待实现 |

CI 矩阵构建并打包以上目标。可下载包是**开发验证产物**，不代表真实设备的桌面控制认证。
macOS Intel 和其他 Desktop 架构不在此托管矩阵中。本地 macOS 服务启动已有 arm64 验证；
Windows、Linux 首次启动提供远程客户端流程。

### 下载开发包

在 [GitHub Actions](https://github.com/yxflc11/openbot/actions/workflows/ci.yml) 中打开目标提交对应的
成功运行，下载 `openbot-desktop-<platform>-<arch>-<commit>.tar.gz` 产物。
需要登录 GitHub；产物保留七天。使用 `tar -xzf <archive>` 解压以保留可执行权限和符号链接，
然后打开目录中的 macOS `OpenBot.app`、Windows `openbot.exe` 或 Linux `openbot`。
仍须遵守操作系统对未签名应用的要求。

每个平台仅在本平台包检查通过后上传。这些是应用目录，不是 DMG/MSI/deb 安装器，也没有自动更新
通道。旧的 `v0.1.0-alpha.1` GitHub Release 仍是仅含源码的基础快照。

### 从源码构建

使用 Node.js 24 LTS（满足[声明的版本范围](package.json)）和 npm：

```bash
git clone https://github.com/yxflc11/openbot.git
cd openbot
npm ci
npm run check
npm run package --workspace @openbot/desktop
```

在目标操作系统上构建，输出位于 `apps/desktop/out/`。macOS 包含本地 Server 与固定版本的
PostgreSQL 运行时。普通源码打包默认不含可选 Worker companion，除非
`OPENBOT_DESKTOP_MACOS_WORKER_COMPANION` 指向已验证的应用包；macOS CI 会先构建它。

macOS 可选“作为服务电脑”初始化本地服务，或选“连接服务电脑”接入已有 Server。
Windows、Linux 提供连接流程。远程连接需输入可信的 HTTPS Server 地址并以 Owner 登录。
完整流程与数据生命周期见 [Desktop 安装引导](docs/DESKTOP_ONBOARDING.zh-CN.md)。

## 项目状态

| 领域 | 源码已实现 | 后续工作 |
| --- | --- | --- |
| Desktop 与 Web | 频道、Bot、审批、任务检查器、统一前进/后退导航、原生菜单、对话草稿与滚动恢复、技能库、持久化界面偏好 | 通知、本地化完善和更多无障碍/设备验证 |
| macOS 本地服务 | 应用自有 PostgreSQL 与 Server、加密初始化身份、保留数据重启、显式切换远程客户端 | 跨平台服务引导、经认证的远程共享、备份、升级与登录服务恢复 |
| 模型 / 原生 Agent | Owner 明确启用、加密 OpenAI/Anthropic 配置、有界模型/工具/观察循环、当前频道读取和持久化 Bot 回复 | 真实模型验证、更多受控工具和外部 Agent 适配器 |
| 自动任务 | PostgreSQL 定时记录、暂停/恢复/删除、有界间隔、停机后最多补交一次到期任务、复用授权路由 | 多 Server 协调和更多调度语义 |
| 员工档案 | 职责/简介编辑、带日期进化档案、技能审核、Owner 管理的类型化记忆、绑定审核的导出/导入与实验性 DSSE 签名 | 自主学习、可执行技能、选择性复制和公开信任分发 |
| Worker 协议 | 出站连接、一次性配对、吊销、带版本能力路由、进度、画面和产物 | 持有证明身份、完整服务/设备一致性与签名分发 |
| 电脑执行 | 只读 Docker/browser URL 截图流程 | 安全交互、原生桌面 Provider、签名单次 lease 和独占接管 |

[原生 Agent](docs/NATIVE_AGENT.zh-CN.md) 在 Owner 明确启用后执行新建的 `none` 配置任务。
OpenBot 尚未提供 Hermes/Pi/OpenClaw 运行时适配器、插件安装生命周期
或任意桌面控制。Cua、Lume、coder 仍是扩展边界。可选办公室可视化继续延后。

员工进化和学习方向明确受到
[Hermes Agent 学习图谱](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/agent/learning_graph.py)
启发。OpenBot 自行负责证据、审核和迁移模型，不声称原创了这一概念。

## 开发与独立部署

Desktop 是可选入口。单独运行 Server、PostgreSQL 和 Web：

```bash
cp .env.example .env
# 将 OPENBOT_OWNER_PASSWORD 设置为至少 15 个字符的随机密码。
npm ci
npm run db:up
npm run dev:server
# 另开终端：
npm run dev:web
```

打开 <http://localhost:5173>，创建 Bot 和频道，然后在“节点”中配对 Worker。
Server 主机也可运行 `npm run node:enrollment-token -- local-development-node` 签发一次性令牌。
按 [Node 登记](docs/NODE_ENROLLMENT.zh-CN.md) 启动 `npm run dev:node`，
配对成功后删除初始化令牌。未配置执行 Provider 时任务会保持排队。
使用 `npm run db:stop` 停止 PostgreSQL。

启用现有浏览器流程时，在 Node 的 loopback 地址运行固定版本
[CopilotKit/OpenBot agent-computer](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer)，
配置 `OPENBOT_DOCKER_COMPUTER_URL`、`OPENBOT_DOCKER_COMPUTER_TOKEN` 和
`OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS=false`，再在频道发送明确的公网 URL 获取截图。

容器部署见 [Server 容器](docs/SERVER_CONTAINER.zh-CN.md)。定时工作见
[自动任务](docs/AUTOMATIONS.zh-CN.md)：Server 必须持续运行，定时记录不增加权限；原生执行需单独[启用 Agent](docs/NATIVE_AGENT.zh-CN.md)。

## 安全与架构

```text
Desktop / Web -> Server -> 获授权的任务路由
                   ^                |
                   +-- Worker 主动出站连接 -> Providers
```

Server 是唯一真相源。渲染进程、模型、网页、技能、Provider 和 Worker Host 都不可信。
敏感副作用必须经过显式策略和审批；能力声明不授予权限。
Desktop 使用本地资源、沙箱渲染进程、有类型的 IPC 和经过验证的打包 fuse。

远程部署需要 HTTPS、`OPENBOT_SECURE_COOKIES=true`、收紧
`OPENBOT_ALLOWED_ORIGINS` 并使用可信私网。数据库和电脑后端应保持私有。
Node 凭证仍是 bearer secret；配对不代表持有证明或 mTLS。
参见 [安全政策](SECURITY.md)、[威胁模型](docs/SECURITY.md)与
[Provider 一致性](docs/PROVIDER_CONFORMANCE.zh-CN.md)。

## 贡献与文档

使用功能分支与 PR。变更行为前调研并固定上游版本、保留声明、同步英文与维护中的翻译，
运行 `npm run check` 和 `npm audit`。
先阅读 [贡献指南](CONTRIBUTING.zh-CN.md)和[开源复用规则](docs/OPEN_SOURCE_REUSE.zh-CN.md)。

| 路径 | 职责 |
| --- | --- |
| `apps/desktop`、`apps/web` | Electron 壳与共用 React 界面 |
| `apps/server`、`apps/node` | 权威控制平面与执行 daemon |
| `apps/worker-host-macos`、`apps/worker-host-windows` | 窄原生服务集成 |
| `packages/*`、`providers/*` | 共享领域、协议、存储、策略和执行适配器 |
| `deploy/`、`docs/` | 部署资源、契约、调研与验收证据 |

文档入口：[产品](docs/PRODUCT.md)、[架构](docs/ARCHITECTURE.md)、
[路线图](docs/ROADMAP.md)、[API](docs/API.zh-CN.md)、[跨平台主机](docs/CROSS_PLATFORM.zh-CN.md)、
[数据库运维](docs/DATABASE.zh-CN.md)和[员工包签名](docs/EMPLOYEE_SIGNING.zh-CN.md)。

## 许可证与命名

采用 [MIT License](LICENSE)，上游声明保存在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
`OpenBot` 是工作名称，已有包括 CopilotKit/OpenBot 在内的其他项目使用；稳定发布前需要选定
可区分的名称。本项目与 xAI、腾讯、CopilotKit、OpenClaw 或其他参考项目不存在隶属关系。
