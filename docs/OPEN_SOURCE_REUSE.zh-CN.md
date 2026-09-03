# 开源优先工程规则

[English](OPEN_SOURCE_REUSE.md) · [简体中文](OPEN_SOURCE_REUSE.zh-CN.md)

## 规则

OpenBot 在设计任何非简单功能前，必须先调研成熟的开源实现。目标是优先复用持续维护的标准、
依赖、协议和窄服务，避免再造一套不兼容系统。

调研不等于直接复制看起来相似的仓库。每项功能都要记录：用户结果与安全边界；候选仓库或开放
标准；维护状态、平台/API 适配和测试质量；候选及其传递依赖许可证；最终选择依赖、适配、向上游
贡献、保留署名移植，还是只开发有证据的差集；以及固定版本/commit 和升级替换方案。

如果兼容代码已经解决问题，应通过其公开契约使用。只有 OpenBot 特有的策略、编排、持久化或
调研明确证明的集成缺口才适合本地实现。

许可证未知、source-available、限制商业使用或其他不兼容许可证会阻止代码引入。复制或实质改编
MIT/Apache 代码时，必须在 `THIRD_PARTY_NOTICES.md` 或对应 vendor 目录保留版权和许可证要求。
即使只采用理念、公开 API 或互操作方式，也要引用来源，方便贡献者理解设计脉络。

## 决策顺序

按顺序选择第一个能满足验收和安全要求的方案：采用开放标准；使用发布依赖或独立服务；编写
固定版本的薄适配器；向上游贡献通用缺口；维护窄 fork；最后才实现剩余的 OpenBot 特有差集。

任何上游都不能成为 Employee 身份、授权、审计或路由的第二真相源。外部代码必须位于 Server
策略边界和类型化 Provider 契约之后执行。

## 当前代码审查

审查日期：2026-09-04。以下 commit 只是调研基线，不会自动成为依赖。

| OpenBot 范围 | 调研来源 | 许可证 | 决定与现状 |
| --- | --- | --- | --- |
| 员工进化与学习图谱 | [NousResearch/hermes-agent `63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d)，重点参考 `agent/learning_graph.py` 的技能/记忆模型 | MIT | 采用“技能与记忆分离、学习技能保留来源和使用证据、个人页展示关系”的产品思想。OpenBot 的 TypeScript/PostgreSQL 实现为本地代码，没有复制 Hermes 源码。 |
| 技能写入审核 | [Hermes write-approval gate](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/tools/write_approval.py) | MIT | 将待审核语义适配为 Server 记录：新技能只能是候选，登录 Owner 才能验证、暂停或撤销。完整 diff 和队列生命周期仍待实现。 |
| 可迁移技能格式 | [Agent Skills 规范 `69ef37e9`](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379) 与 `skills-ref` | 代码 Apache-2.0；文档 CC-BY-4.0 | 采用开放标准，不自创技能包。当前元数据已采用其名称和简介限制；尚未实现可执行 `SKILL.md` 归档和官方校验器接入。 |
| 第三方技能安全 | [OpenClaw `428fa8e0`](https://github.com/openclaw/openclaw/tree/428fa8e0d3dac835628f6ac6466bb65ce175b249) 的技能隔离与扫描说明 | MIT | 采用第三方内容默认不可信、激活前检查、路径约束和明确授权。现有员工包检查只读，不能激活导入内容。 |
| 浏览器电脑 | [CopilotKit/OpenBot `agent-computer` `257c1280`](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer) | MIT | 通过薄 Provider 使用其 Token HTTP 接口，上游进程独立运行，不复制控制面。 |
| 跨平台电脑操作 | [Cua `986b6f25`](https://github.com/trycua/cua/tree/986b6f257b1afddef0cbd4815bb2744eab7eadba) | MIT；可选组件另有许可证 | 计划用于 Windows、macOS、Linux Provider；未经独立分发审查不启用可选 AGPL 或模型组件。 |
| 办公室可视化 | 项目所有者提供的腾讯 Marvis 产品图片 | 未找到可复用源码许可证 | 只作视觉启发，不引入 Marvis 代码或资源；办公室继续作为延期插件。 |

## 已落实的审查结果

- 技能名采用 Agent Skills 兼容的“小写、连字符、最多 64 字符”子集，简介上限为 1,024 字符。
- 候选、已验证、暂停、撤销由 Server 明确管理，客户端不能直接创建已验证技能。
- 验证必须由已登录 Owner 明确审核，产生只追加进化事件，且不能修改工作主机能力、策略或授权。
- 并发创建和状态变更以冲突失败，不会静默覆盖审核。
- 当前证据快照有界，完整审核原因继续保存在不可变进化事件中。
- 员工导入继续执行校验和、严格 schema、只读和隔离规则。

## 尚未解决

- 当前技能记录只描述员工能力，尚未保存或执行符合开放规范的完整技能目录。
- 自动学习前必须增加提案过期/替代、通知和完整 diff 审核。
- 技能归档必须检查路径穿越、符号链接、解压大小、可执行内容、许可证、来源、签名和静态风险。
- 官方 `skills-ref` 需要 Python 3.11+，应在隔离检查 Worker 中运行，而不是放进权威 Server 进程。
- 每个 Provider 必须通过可重复的一致性 fixture，平台才可以标记为支持。

## Pull Request 必备信息

每个非简单功能 PR 都要链接调研记录或 ADR，并回答：评估了什么上游或标准；为什么选择依赖、
适配、fork 或本地差集；审查了哪个版本和许可证；是否复制/实质改编源码及其 NOTICE 在哪里；
当上游缺失、不兼容或被攻破时如何 fail closed。
