# 上游选择与集成策略

评估日期：2026-08-31。

## 最终分工

| 项目 | OpenBot 中的角色 | 采用方式 |
| --- | --- | --- |
| [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot) | **产品底座候选**：UI、频道、Bot、policy、audit、电脑、routine、handoff | 已先接 `agent-computer` HTTP provider；其余继续 spike，合格后才 fork |
| [Cua](https://github.com/trycua/cua) | macOS 原生操作与 Lume VM | OpenBot Node provider；固定版本和 managed policy |
| [OpenClaw](https://github.com/openclaw/openclaw) | 可选 Agent runtime、技能和 CLI adapter | 通过 AG-UI/adapter 接入；不做第二控制面 |
| [OpenMausBot](https://github.com/milind-soni/OpenMausBot) | Cua、CLI Agent 和 Grok-like UX 参考 | 参考/贡献，不双运行 |
| [Rakazo](https://github.com/elie222/rakazo) | computer provider 与多端产品参考 | 参考 provider contract，不双运行 |
| [Multica](https://github.com/multica-ai/multica) | `coder` 的可选任务执行器 | M4 adapter；不 vendor，先审查附加许可证 |

## 为什么 CopilotKit/OpenBot 升级为底座候选

用户要求：

- 频道完全本地化；
- 手机、平板、笔记本直接远程控制；
- Mac Mini 可以被普通服务器替换；
- 仍能在需要时连接一台 Mac 操作原生软件。

这意味着 Web 产品壳、频道、动作网关、远程电脑和审计比第三方聊天入口更核心。CopilotKit/OpenBot 已覆盖这些能力的大部分，因此比“OpenClaw 后端 + 从零 Console/Policy”减少更多重复开发。

## 不能原样采用的原因

上游当前要求 CopilotKit Intelligence API、realtime gateway、project key 和机器 license。其 `.env.example` 明确说明：

- 没有 Intelligence 不提供降级模式；
- Intelligence 保存 durable threads 和 memory；
- 自托管 Intelligence 是 Enterprise、非 self-serve。

这与“频道、线程和记忆完全本地”直接冲突。因此正式 fork 的前提是能以清晰 seam 替换 Intelligence，而不是绕过 license 校验继续调用其服务。

## 拟保留的上游模块

- `app/` 中的频道、Bot、电脑、审批、审计界面；
- `server/` 中的 auth、CEL policy、audit、credential 和 grants；
- `agent-computer/` 与 `supervisor/` 的容器电脑实现；
- routine queue、handoff 和 MCP governance；
- 测试与安全默认值。

## 已落地的第一条集成

当前兼容基线固定为 CopilotKit/OpenBot commit [`257c1280`](https://github.com/CopilotKit/openbot/commit/257c1280d684089be9adb0b35cce262efc7064bf)。本仓没有复制上游源代码，也没有引入第二套 Server；`providers/docker` 只适配其 token 保护、按 Bot 隔离的 `/navigate` 和 `/screenshot` HTTP 表面，`agent-computer` 仍作为 Node 机器上的独立进程或容器运行。

这条接缝证明可以先复用成熟“电脑手”，同时保留我们自己的本地频道、数据库、调度和远程 Node。后续若必须修改上游 supervisor、policy 或 live-screen，需单独 ADR 决定 fork/submodule；不能在没有版本和许可证边界的情况下把多个仓库复制进来。

## 拟新增或替换

- `local-threads`：本地 thread/memory/realtime；
- `node/`：可远程注册的执行节点 daemon；
- Node provider contract：Docker/Cua/Lume/Coder；
- Tailscale-first PWA 访问和远程接管；
- CLI Agent adapters。

## 代码与许可证规则

1. OpenBot 上游仓本身是 MIT，但依赖服务/包要单独审查。
2. fork 保留原 copyright、LICENSE、NOTICE 和来源历史。
3. 不复制 CopilotKit Showcase 等 source-available/非竞争许可代码。
4. 不破解、伪造或绕过 Intelligence license；只通过合法替换接口移除依赖。
5. 通用 bug fix 优先回 upstream。
6. 所有外部二进制记录版本、来源、许可证、checksum 和 SBOM。

## 名称风险

如果正式 fork CopilotKit/OpenBot，我们不能继续以另一个同名 OpenBot 对外发布。代码仓本地名可以暂留，公开前必须确定新的产品名、GitHub slug 和域名。
