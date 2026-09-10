<p align="center">
  <img src="docs/design/openbot-readme-banner.png" alt="OpenBot" width="100%">
</p>

# OpenBot

**让有名字的 Bot 在频道里协作的自托管工作区。**

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)

创建有独立身份、职责、经审核记忆和技能的同事。在频道交代任务，让 Bot 邀请另一位 Bot 帮忙，查看回复过程并下载成果。Desktop 与 Web 共用真实 React 工作区，Server 负责身份、权限、路由、审批和审计。

**当前源码候选版本为 Desktop `0.1.0-alpha.6`。** 频道协作、丰富附件、MCP 扩展接口和双语官网均已实现，但本候选版**尚未发布**：最终源码推送、Windows 原生 CI 结果和官网公开部署仍需完成。[逐功能交付清单](docs/RELEASE_COMPLETION.zh-CN.md)列出实现、证据和这三个发布关口。开发安装包未签名，没有自动更新通道，也不宣称任意桌面控制已获认证。

本次官网部署目标：[English](https://yxflc11.github.io/openbot-website/) · [简体中文](https://yxflc11.github.io/openbot-website/zh-cn/)。这些是待部署地址，不代表本候选版已上线。现在可先阅读[源码文档索引](docs/README.zh-CN.md)。当前候选版维护英文与中文文档，日文和葡萄牙文 README 仍对应较早快照。

## 可以做什么

| 部件 | 当前行为 |
| --- | --- |
| 频道与私聊 | 选择一位或多位 Bot、引用回复、保留草稿与阅读位置、查看任务历史、管理群组成员。 |
| Bot 分工 | 以接收方自己的身份启动子任务，继续独立工作，并在最终交付前汇总同事结果。最多六个根任务并发，每棵树两层委派、四个后代。 |
| 任务操作 | 提供方真实文字草稿、任务详情、停止/重新提交；每个原生任务累计最多八条明确追加指令，在模型步骤边界生效。MiniMax 保留受控最终回复路径。 |
| 消息操作 | 悬停或聚焦气泡侧边显示表情、回复和更多；复制与详情放入菜单。表情目前属于单一工作区 Owner。 |
| 附件与语音 | 添加原件、本地提取 Office/PDF 文字、本地图片 OCR、明确选择媒体转写、录音试听、下载原件/成果和管理回收站。 |
| Bot 档案 | 编辑职责/简介；查看证据与演化记录；增删改类型化记忆，明确选择模型可使用的记忆，审核经验提案和技能版本。 |
| 技能 | 导入单个 `SKILL.md`，审核完整版本后允许 Agent 在现有工具范围内使用；不执行任意脚本，也不额外授予权限。 |
| 分享 Bot | 预览并下载可移植档案和已验证技能元数据；导入创建新身份并经过审核。包内不含记忆、对话、凭据、实时授权或技能指令文件。 |
| 插件 | 接入标准 MCP 工具、文本资源、Owner 选择的提示词和隔离 Apps；审阅声明/更新，按 Bot 授权并审批配置为需确认的外部操作。 |
| 自动化 | 创建固定间隔计划，暂停/恢复/删除，查看最近结果并避免任务重叠；Server 需要持续运行。 |
| 设置 | 11 家模型服务预设、保留加密凭据、单独启用 Agent，以及工作区外观、导航和发送偏好。 |
| 官网 | 产品介绍、可搜索的中英文手册、扩展协议/贡献指南，以及复用真实频道组件的隔离交互演示；公开部署待完成。 |

这些是有明确边界的功能，不代表无限 Agent、任意电脑输入、多真人协作、完整 MCP、崩溃后自动重放或 Grok 所有状态逐像素一致。详细行为和源码依据见[交付清单](docs/RELEASE_COMPLETION.zh-CN.md)。

## Windows 候选版与已有平台

本次新增原生平台工作只面向 **Windows x64**。alpha.6 源码提供按用户安装的 NSIS 安装器、内置 Server/PostgreSQL、DPAPI 初始化凭据、私有数据 ACL、正常停止和保留数据重启。已提供针对安装后运行时的 Windows CI 验证程序，实际结果仍待运行。安装 Desktop 不会登记 Worker，也不会授予电脑控制权。见 [Windows Desktop](docs/WINDOWS_DESKTOP.zh-CN.md)。

保留已有 macOS arm64 本地服务/companion 和 Linux 远程客户端代码；本次不新增 macOS/Linux 适配，也不扩大其一致性结论。Worker Host 与电脑 Provider 仍有独立的登记和验证边界。

精确文件名与升级方式见 [Desktop 安装](docs/DESKTOP_INSTALLATION.zh-CN.md)。只从目标 commit 对应的成功 [GitHub Actions](https://github.com/yxflc11/openbot/actions/workflows/ci.yml) 获取构建产物，或从实际含有对应安装包与 `SHA256SUMS` 的 [Desktop Release](https://github.com/yxflc11/openbot/releases) 下载。存在构建脚本或源码 tag 不等于安装器已发布。

## 构建与运行

使用 CI 基线 **Node.js 22.22.2、npm 10.9.9**，或满足 [package.json](package.json) 的 Node 版本，按锁文件安装：

```sh
git clone https://github.com/yxflc11/openbot.git
cd openbot
npm ci
npm run check
npm run package --workspace @openbot/desktop
```

在目标操作系统构建 Desktop，输出位于 `apps/desktop/out/`。Windows 原生准备需要 [Windows Desktop](docs/WINDOWS_DESKTOP.zh-CN.md) 所述的已验证 PostgreSQL 源码构建包，托管 workflow 会生成并校验。重新构建应用不会替换工作区配置和数据。

单独运行 Server、PostgreSQL 和 Web：

```sh
cp .env.example .env
# 将 OPENBOT_OWNER_PASSWORD 设置为至少 15 个字符的随机密码。
npm run db:up
npm run dev:server
# 另开终端：
npm run dev:web
```

打开 <http://localhost:5173>，配置支持的模型并明确启用原生 Agent，然后创建 `none` 配置的 Bot 与频道。原生模型任务不需要 Worker；电脑任务需要单独登记的 Worker 和可执行 Provider，见 [Node 登记](docs/NODE_ENROLLMENT.zh-CN.md)和 [Provider 一致性](docs/PROVIDER_CONFORMANCE.zh-CN.md)。容器部署见 [Server 容器](docs/SERVER_CONTAINER.zh-CN.md)。

运行 `npm run build --workspace @openbot/site` 构建官网，过程包含独立产品演示。演示使用示例数据、禁止外部 API 请求，不连接真实工作区或模型。

## 架构与贡献

```text
Desktop / Web -> Server -> 原生 Agent 与受限 MCP 连接
                   |
                   +-> 已登记 Worker -> 可执行 Provider
                   |
                   +-> PostgreSQL、对象存储与审计
```

Server 是唯一权限中心。模型、附件、网页、技能、插件和 Worker 都是不可信输入，工具能力不等于授权。远程部署使用可信 HTTPS、严格 Origin 与安全 Cookie，数据库和电脑后端保持私有。参见[安全政策](SECURITY.md)与[威胁模型](docs/SECURITY.md)。

从[贡献指南](CONTRIBUTING.zh-CN.md)、[仓库地图](docs/REPOSITORY_MAP.zh-CN.md)、[当前架构](docs/ARCHITECTURE.zh-CN.md)、[工程审查](docs/REPOSITORY_AUDIT.zh-CN.md)和[开源复用规则](docs/OPEN_SOURCE_REUSE.zh-CN.md)开始。插件作者可直接实现标准 MCP Streamable HTTP，不需要专属 OpenBot SDK，见[插件作者契约](docs/PLUGINS.zh-CN.md)及 [openbot-website](https://github.com/yxflc11/openbot-website) `src/content/docs` 中的官网扩展指南。

员工演化和学习方向明确借鉴 [Hermes Agent 的学习图](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/agent/learning_graph.py)，OpenBot 不宣称原创该概念。办公室可视化仍是延期的可选插件。

## 许可与名称

采用 [MIT License](LICENSE)，必要上游声明保存在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。`OpenBot` 是其他项目也在使用的工作名称，稳定版的可区分名称仍需项目决定。本项目与 xAI、腾讯、CopilotKit、OpenClaw 等参考项目不存在隶属关系。
