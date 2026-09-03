# ADR-0001：以 OpenClaw 作为运行脊柱

- 状态：Superseded by ADR-0002
- 日期：2026-08-31

## 背景

> 该决策基于“第三方频道优先、Mac Mini 同时承担控制面和执行面”的旧前提。用户随后明确要求本地 Web/PWA 频道、通用服务器控制面和可替换执行节点，因此由 ADR-0002 取代。本文仅保留为决策历史。

目标是融合开源组件并开发差集，复刻 Grok Bot 的核心体验：具名 Bot、一直在线、真实电脑、人工审批、多 Bot 交接和例行任务。候选脊柱包括 Rakazo、OpenMausBot、OpenClaw、CopilotKit/OpenBot 和 Multica。

## 决策

V1 采用 OpenClaw 作为唯一 Agent runtime/control gateway，并通过 OpenBot 自研层补充：

- 声明式 manifest 与配置 compiler；
- Agent 到 execution profile 的确定性路由；
- 代理 Cua/高权限工具的 Action Gateway；
- 跨工具审批状态机与一次性 capability lease；
- 统一审计和结构化 handoff；
- M3 的 Grok-like Web Console。

Cua Driver 通过 MCP 接在 Action Gateway 后面，不能作为普通未治理 MCP 直接开放给 Agent。

## 理由

OpenClaw 当前已经覆盖第一阶段最难替代的基础能力：常驻 Gateway、Telegram/飞书等频道、多 Agent 路由、cron、沙箱、工具策略、命令审批、launchd 和 Cua 的官方接入路径。其 MIT 许可证也适合作为外部依赖。

这使本项目能够把自主开发集中在 Grok Bot 差集：电脑级治理和产品体验，而不是再次实现频道、scheduler 和 daemon。

## 未选择方案

### Rakazo 作为脊柱

优点是产品完整、多端 UI 和电脑 provider contract 强。未选原因是 V1 的首要风险在 Mac Mini 常驻、频道、策略和审批，而不是 UI；其 This Mac 文档也明确指出 macOS 不会替产品再次弹出权限确认。Rakazo 保留为 M3 产品/provider 参考。

### OpenMausBot 作为脊柱

它是最快看到 Grok-like 形态的方案，也已经包含审批和 Cua。但把它与 OpenClaw 的 Gateway/频道/cron 双运行会形成两个任务、会话和权限真相源。保留为 UX 和 driver SPI 参考。

### CopilotKit/OpenBot 作为脊柱

它的 fail-closed policy gateway 和审计设计非常接近目标，但目前要求 CopilotKit Intelligence 项目与 license token，主要电脑形态也是容器浏览器；这与完全自有、Mac Mini 原生/VM 双路径存在差距。

### Multica 作为脊柱

它优化的是编码 Agent 的 issue/runtime 生命周期，不是 GUI 电脑员工。只在 M3 后作为 `coder` 的可选 adapter。

## 后果

正面：

- M1 能最快验证 Telegram → Mini → 电脑 → 回报；
- 上游职责清晰，更新可以分别测试；
- 不需要维护多个 Agent runtime；
- 自研部分有明确、可开源的价值。

代价：

- M3 需要自建 Bot 名册和电脑面板；
- OpenClaw 的通用工具策略不足以表达所有 GUI 业务语义；
- 必须实现并严格测试 Action Gateway；
- 需要持续跟踪 OpenClaw 与 Cua 的配置和 MCP contract 变化。

## 复审触发条件

出现以下任一情况时重新评估：

- OpenClaw 无法稳定完成 M1 北极星任务或重启恢复；
- 无法在不 fork 核心的情况下获得所需事件/审批 hook；
- Cua 无法在固定身份和最小权限下稳定运行；
- 另一个上游以开放协议完整提供所需控制面，并显著降低维护成本。
