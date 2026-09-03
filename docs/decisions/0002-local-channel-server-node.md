# ADR-0002：本地频道与 Server/Node 架构

- 状态：Accepted for spike
- 日期：2026-08-31
- 取代：ADR-0001

## 背景

频道必须由项目本地提供，而不是以 Telegram/飞书为第一入口。用户希望从手机、平板和笔记本远程控制，并希望 Mac Mini 可以被普通服务器替换。

## 决策

1. 系统拆为 OpenBot Server、OpenBot Node 和 Web/PWA Client。
2. Server 是频道、线程、Bot、策略、审批、调度和审计的唯一真相源。
3. Node 是主动出站连接 Server 的可替换执行机。
4. CopilotKit/OpenBot 升级为产品底座候选，先验证后决定是否正式 fork。
5. 必须以本地 PostgreSQL/realtime 实现替换 CopilotKit Intelligence，不绕过其 license。
6. Cua Driver 与 Lume 作为 Apple Node provider；Docker 是通用 Node provider。
7. OpenClaw 只允许作为 Agent adapter，不再负责频道或核心状态。

## 理由

CopilotKit/OpenBot 已实现本项目原计划大量自研的产品和治理层。用户的新前提更看重本地频道、Web 远程电脑、策略和审计，而不是第三方聊天接入。因此从它的 MIT 产品基线出发、替换云依赖并泛化 computer supervisor，理论上比从 OpenClaw 重建完整产品层更省工作。

## 限制

- Linux 服务器可以替代控制面和普通 Docker Node，但不能替代 macOS 原生应用能力。
- 必须有 Apple hardware Node 才能提供 Cua/Lume macOS profile。
- 正式 fork 前必须证明 Intelligence 依赖存在可维护的替换 seam。
- 远程控制不得让 Client 直连 Node 或暴露 supervisor/Cua 端口。

## 后果

正面：

- 频道和历史真正归用户所有；
- 多设备只面对一个 Server；
- 执行节点可增加、替换和吊销；
- Mac Mini 从单点系统变成可选能力节点；
- 可以复用成熟 policy/audit/remote-computer UX。

代价：

- 需要实现本地 thread/memory/realtime；
- 需要设计版本化 Server-Node 协议；
- fork 上游会带来持续同步成本；
- 屏幕 relay、节点身份和多设备接管增加安全复杂度。

## 复审条件

- Intelligence 无法在清晰边界上替换；
- 上游许可证或依赖阻止所需发布方式；
- remote Node 改造需要重写大部分 server/computer；
- 真实 spike 表明从独立协议重新组合反而更小。

