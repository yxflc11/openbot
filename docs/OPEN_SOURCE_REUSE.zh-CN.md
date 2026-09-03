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

本表同时是当前分支已有非简单代码的追溯审查账本。没有在这里、ADR 或对应 Issue 中登记上游与
许可证审查的功能，在补齐记录前不能继续扩展。

| OpenBot 范围 | 调研来源 | 许可证 | 决定与现状 |
| --- | --- | --- | --- |
| 员工进化与学习图谱 | [NousResearch/hermes-agent `63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d)，重点参考 `agent/learning_graph.py` 的技能/记忆模型 | MIT | 采用“技能与记忆分离、学习技能保留来源和使用证据、个人页展示关系”的产品思想。OpenBot 的 TypeScript/PostgreSQL 实现为本地代码，没有复制 Hermes 源码。 |
| Owner 管理员工记忆 | [Hermes Agent `63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d)、[Letta `0.16.7` / `f3332476`](https://github.com/letta-ai/letta/tree/f33324768950e6752f80d6c725873cc92d22f8b2)、[Mem0 `ts-v3.0.5` / `75a37ec9`](https://github.com/mem0ai/mem0/tree/75a37ec93db7278e3bd9aaf2aa3d6e5139e6789d) 与 [LangMem `f8c7ebd6`](https://github.com/langchain-ai/langmem/tree/f8c7ebd6110c124a36995dab645a8cb0eb0b8210) | MIT；Apache-2.0；Apache-2.0；MIT | 采用可见有界变化、人工编辑、稳定 ID/历史、分类记忆和默认关闭自动删除。复用 OpenBot 现有 PostgreSQL/Zod/Hono/React，只补 revision 检查的 Owner 命令与无内容审计；不引入上游运行时或源码。见[调研证据](research/owner-managed-employee-memory.md)。 |
| 技能写入审核 | [Hermes write-approval gate](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/tools/write_approval.py)、[OpenClaw `v2026.7.1-2`](https://github.com/openclaw/openclaw/tree/v2026.7.1-2) 与 [Agent Skills `69ef37e9`](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379) | MIT；MIT；Apache-2.0 代码和 CC-BY-4.0 文档 | 将待审核行为适配到 Server 权威记录，并在 Owner 验证、暂停、恢复或终止撤销前展示元数据、依赖、所需能力和证据。不安装可执行包；完整文件 diff、扫描和提案队列仍在计划中。未复制上游源码，证据见[调研记录](research/owner-skill-review-surface.md)。 |
| 可迁移技能格式 | [Agent Skills 规范 `69ef37e9`](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379) 与 `skills-ref` | 代码 Apache-2.0；文档 CC-BY-4.0 | 采用开放标准，不自创技能包。当前元数据已采用其名称和简介限制；尚未实现可执行 `SKILL.md` 归档和官方校验器接入。 |
| 第三方技能安全 | [OpenClaw `428fa8e0`](https://github.com/openclaw/openclaw/tree/428fa8e0d3dac835628f6ac6466bb65ce175b249) 的技能隔离与扫描说明 | MIT | 采用第三方内容默认不可信、激活前检查、路径约束和明确授权。员工包技能只会作为禁用候选导入。 |
| 审核后激活员工 | [Backstage `v1.51.0`](https://github.com/backstage/backstage/tree/v1.51.0)、[Kubernetes `v1.36.2` API dry-run](https://github.com/kubernetes/website/blob/main/content/en/docs/reference/using-api/api-concepts.md) 与 [OpenClaw `v2026.7.1-2`](https://github.com/openclaw/openclaw/tree/v2026.7.1-2) | Apache-2.0；Apache-2.0；MIT | 采用“预览 → 审核 → 创建”、无副作用预览和第三方技能默认不可信。OpenBot 只实现自己的包摘要绑定、新身份、PostgreSQL 原子收据和候选技能赋值；没有复制上游源码。见[调研证据](research/reviewed-employee-import-activation.md)。 |
| 浏览器电脑 | [CopilotKit/OpenBot `agent-computer` `257c1280`](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer) | MIT | 通过薄 Provider 使用其 Token HTTP 接口，上游进程独立运行，不复制控制面。 |
| 跨平台电脑操作 | [Cua `986b6f25`](https://github.com/trycua/cua/tree/986b6f257b1afddef0cbd4815bb2744eab7eadba) | MIT；可选组件另有许可证 | 计划用于 Windows、macOS、Linux Provider；未经独立分发审查不启用可选 AGPL 或模型组件。 |
| Provider 一致性场景 | [MCP Conformance `74edef34`](https://github.com/modelcontextprotocol/conformance/tree/74edef34d674f563537be8c6587cebaa58e830ca) | 许可证迁移中：新代码 Apache-2.0，剩余历史代码 MIT，文档 CC-BY-4.0 | 采用具名可执行场景、按版本冻结要求、显式预期失败和连接两端分别检查的方式。OpenBot 使用本地 Vitest 编写自身协议 fixture，没有复制 MCP 代码或文档。 |
| 平台合规声明 | [OCI runtime-spec `6999a89a`](https://github.com/opencontainers/runtime-spec/tree/6999a89a76a0329f440d5740497bedb9dd431297) | Apache-2.0 | 采用“合规必须绑定明确 OS/架构，任一必需行为失败就不能宣称支持”的原则。本切片不实现或复制 OCI runtime 契约。 |
| 一致性证据打包 | [CNCF Kubernetes Conformance `6fc6e660`](https://github.com/cncf/k8s-conformance/tree/6fc6e66092075b7443c9259629b607c15b7876b9) 与 [OCI runtime-tools `8a4db579`](https://github.com/opencontainers/runtime-tools/tree/8a4db579f5c88af5a0d036fad34bddc9c1f703f3) | Apache-2.0 | 采用明确产品/目标元数据、人工可复现说明、机器可读结果和按平台校验。OpenBot 用有界 JSON 作为 Provider 公共契约，不直接采用 JUnit 或 TAP；没有复制上游源码。 |
| Agent/UI 事件协议候选 | [AG-UI `faee4b13`](https://github.com/ag-ui-protocol/ag-ui/tree/faee4b13eabee191d9974f6b19a91b5668268995) | MIT | 已评估未来 Agent 与用户界面的事件互操作，当前延期：这次加固的是安全敏感的 Server/工作主机协议，不迁移 UI 传输。没有增加依赖或源码。 |
| 员工主页导航与模态弹窗 | [WAI-ARIA APG `7e4034b2`](https://github.com/w3c/aria-practices/tree/7e4034b262bc0d25332e330d8a582aaf34113829)、[React Spectrum `50279a10`](https://github.com/adobe/react-spectrum/tree/50279a10ab998572e240e44aa36f84a15c7c4f99) 与 [WCAG 技术 H102](https://www.w3.org/WAI/WCAG22/Techniques/html/H102) | W3C Software and Document License；Apache-2.0 | 采用标准 Tab 角色/键盘模型和浏览器原生模态生命周期。固定控件不值得引入第二套组件与样式栈，因此只保留薄 React 桥接；没有复制上游源码。 |
| 贡献入口与审查证据 | [OpenClaw `41344e0b`](https://github.com/openclaw/openclaw/tree/41344e0b7dbd5629f797c535c985fd87a323abe5)、[Hermes Agent `63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d)、[MCP `d4a6fc63`](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/d4a6fc63648798ad6dc6daab6f79e73c9df14699) 与 [GitHub Issue Forms](https://docs.github.com/zh/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) | MIT；Apache-2.0/CC-BY-4.0；仅参考文档 | 将 Issue 优先路由、贡献优先级、平台证据、结构化表单和 AI 辅助披露适配到 OpenBot 安全边界；没有复制模板或源码。 |
| 先调研再实现门禁 | [Rust RFC 模板 `f17e8623`](https://github.com/rust-lang/rfcs/blob/f17e8623ee2e2854570dcdb936a9f4ab08c0fcd4/0000-template.md)、[Kubernetes KEP 模板 `6ab9bf71`](https://github.com/kubernetes/enhancements/blob/6ab9bf717d1228928740bdbfe761b6e62b870902/keps/NNNN-kep-template/README.md)、[OpenSSF Scorecard workflow `54d8e4d3`](https://github.com/ossf/scorecard-action/blob/54d8e4d3c579f74e35c422a0a18e16bb58ad9426/.github/workflows/scorecards.yml)、[actions/checkout `11d5960a`](https://github.com/actions/checkout/tree/11d5960a326750d5838078e36cf38b85af677262) 与 [actions/setup-node `49933ea5`](https://github.com/actions/setup-node/tree/49933ea5288caeca8642d1e84afbd3f7d6820020) | Apache-2.0/MIT；Apache-2.0；Apache-2.0；MIT；MIT | 将可追溯的先例、替代方案、验证、兼容性和生命周期证据适配成较小的 OpenBot 调研记录；增加仓库指令和本地 PR 正文门禁，并按 commit 固定现有 CI Action。没有复制上游模板或源码。 |
| 员工包真实性 | [DSSE `1d3370f6`](https://github.com/secure-systems-lab/dsse/tree/1d3370f62565bca041e97c8310b873ac340edc2e)、[Sigstore JS `769a53d8`](https://github.com/sigstore/sigstore-js/tree/769a53d8713248a8bf49edfc2a5d1955b0dcc24d) 与 [in-toto Attestation `2dcd055e`](https://github.com/in-toto/attestation/tree/2dcd055e9f72e746687c306e35f4e59720ff45be) | Apache-2.0 | 采用 DSSE，并固定 `@sigstore/core` 4.0.1 生成预认证编码。OpenBot 只实现员工包特有的 Ed25519 密钥边界和严格解析；in-toto/Sigstore 来源证明及基于 TUF 的分发仍是独立后续适配器。未复制上游源码。 |
| Owner 员工发布密钥生命周期 | [Cosign `v3.0.6`](https://github.com/sigstore/cosign/tree/v3.0.6)、[TUF 规范 `v1.0.35`](https://github.com/theupdateframework/specification/tree/v1.0.35)、[Notary 规范 `v1.1.0`](https://github.com/notaryproject/specifications/tree/v1.1.0) 与 [Node.js `v22.23.2`](https://github.com/nodejs/node/tree/v22.23.2) | Apache-2.0；Community Specification License 1.0；Apache-2.0；MIT | 复用 Node 的 Ed25519 与加密 PKCS#8/SPKI API、Cosign 的公私钥分离、Notary 的带外信任策略以及 TUF 的密钥状态保留概念。OpenBot 只实现文件清单、离线 Owner CLI 和 DSSE HTTP 适配；没有复制上游源码。证据见[调研记录](research/employee-publisher-key-lifecycle.md)。 |
| 浏览器控制面安全 | [Hono `e2740d5a`](https://github.com/honojs/hono/tree/e2740d5a1bd0b4254e517e3af8b60789284bc7bd) 与 [OWASP Cheat Sheet Series `b8586414`](https://github.com/OWASP/CheatSheetSeries/tree/b8586414a5c47ae68911edb97d4e7b7bc6301035) | MIT；文档 CC BY-SA 4.0 | 复用 Hono 4.13.5 的 `secureHeaders`；采用 OWASP 的 Secure/HttpOnly/SameSite、精确 Origin、TLS 与 `__Host-` 指引。远程错误配置现在启动即失败。未复制上游源码或文字。 |
| 实时过载恢复 | [Hono streaming `e2740d5a`](https://github.com/honojs/hono/blob/e2740d5a1bd0b4254e517e3af8b60789284bc7bd/src/utils/stream.ts) | MIT | 保留 Hono 感知背压的 writer，只补 OpenBot 缺失的订阅策略：128 事件上限、溢出断开、权威快照恢复。未复制上游源码。 |
| 员工档案实时失效通知 | [Hermes Agent `63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d)、[Hono `4.13.5` / `e2740d5a`](https://github.com/honojs/hono/tree/e2740d5a1bd0b4254e517e3af8b60789284bc7bd) 与 [Kubernetes client-go `v0.35.1`](https://github.com/kubernetes/client-go/tree/v0.35.1) | MIT；MIT；Apache-2.0 | 采用 Hermes 的类型化详情实时刷新与 Kubernetes 的权威重读恢复，并复用已固定的 Hono SSE。Server 提交后只发送 Bot id、白名单分区和时间；Client 再读取鉴权档案。未复制上游源码，证据见[调研记录](research/employee-profile-realtime-invalidation.md)。 |
| Node 通道权威与存活 | [`ws` 8.21.3 `c791e707`](https://github.com/websockets/ws/tree/c791e707eab3c13dd9a261d2479c3cc4a49a6fed)、[Kubernetes Node heartbeat KEP `e849163a`](https://github.com/kubernetes/enhancements/blob/e849163ac4a0a5241ba626bd9a99820bf1dcd279/keps/sig-node/589-efficient-node-heartbeats/README.md) 与 [Nomad `482b49bf`](https://github.com/hashicorp/nomad/tree/482b49bf1aec006f089bcfc7e632d8f6ac303e5e) | MIT；Apache-2.0；MPL-2.0 | 复用 `ws` 消息上限和 ping/pong，把存活报告与 Server 权威任务分配分开。限制消息与登记时间、拒绝重复 hello，并清退失联 socket。没有复制上游源码。 |
| Node 启动身份 | [SPIFFE `99470b9a`](https://github.com/spiffe/spiffe/tree/99470b9abc825f14aa364dfa2c3b53b02ba5db5b)、[SPIRE 1.15.2](https://github.com/spiffe/spire/tree/v1.15.2)、[Tailscale `92ec1026`](https://github.com/tailscale/tailscale/tree/92ec102673bf46d72bab64b0a278b93c01a47f34)、[Headscale 0.29.3](https://github.com/juanfont/headscale/tree/v0.29.3)、[Kubernetes 1.36.2](https://github.com/kubernetes/kubernetes/tree/v1.36.2) 与 [Smallstep Certificates 0.30.2](https://github.com/smallstep/certificates/tree/v0.30.2) | Apache-2.0；BSD-3-Clause | 采用短时单次启动、Server 只存摘要、独立 Node 状态、吊销和只显示一次。HTTP/文件机制复用 Hono 与 `write-file-atomic`；本地只实现 OpenBot 的 PostgreSQL 事务、协议和审计差集。持有证明、PKI、轮换、系统密钥库和防重放另行审查。没有复制上游源码。 |
| Owner Node 管理 | [Headplane `v0.7.0`](https://github.com/tale/headplane/tree/v0.7.0)、[Headscale `v0.29.3`](https://github.com/juanfont/headscale/tree/v0.29.3) 与 [Tailscale `92ec1026`](https://github.com/tailscale/tailscale/tree/92ec102673bf46d72bab64b0a278b93c01a47f34) | MIT；BSD-3-Clause | 采用设备列表、显式添加、单次启动、持久机器状态和独立破坏性操作流程。OpenBot 复用现有原生弹窗、Owner Session、实时投影与 Node 身份服务，因为其他控制平面不能安全成为本地身份权威。没有复制上游源码，证据见[调研记录](research/node-management-console.md)。 |
| 敏感文件原子写入 | [`npm/write-file-atomic` 8.0.0](https://github.com/npm/write-file-atomic/tree/v8.0.0) | ISC | 直接使用发布依赖完成 fsync、原子 rename、同目标串行化和失败临时文件清理，不再本地维护这些机制。Artifact 与 Node 凭证文件均保持经测试的 `0600` 权限；没有复制上游源码。 |
| 不可信 PNG 校验候选 | [`image-js/fast-png` 8.0.0](https://github.com/image-js/fast-png/tree/v8.0.0) 与 [`sharp` 0.35.0](https://github.com/lovell/sharp/tree/v0.35.0) | MIT；Apache-2.0 | 完整解码和归一化暂缓。`fast-png` 没有输入像素资源上限；`sharp` 有上限，但原生包必须先通过 Server 的 Linux x64/arm64 打包矩阵。当前签名检查明确不代表 PNG 完整有效。 |
| Node 协议输入校验 | [Zod 4.5.4 `e8e206fa`](https://github.com/colinhacks/zod/tree/e8e206fa33ac5fe7ce20a2beb12d57b1cb3df653)、[OWASP Cheat Sheet Series `b8586414`](https://github.com/OWASP/CheatSheetSeries/tree/b8586414a5c47ae68911edb97d4e7b7bc6301035) 与 [MCP TypeScript SDK `5119ee7f`](https://github.com/modelcontextprotocol/typescript-sdk/tree/5119ee7fd7790e335a3fb60ef36f85334e2a6326) | MIT；文档 CC BY-SA 4.0；MIT | 复用现有固定版本的 Zod 实现严格消息与字段边界，并采用 OWASP 的白名单和范围原则。OpenBot 只保留协议特有的有界审批证据遍历；MCP 仅作协议校验先例，不共享 Node 权威语义。没有复制上游源码。 |
| Server 有界停机 | [Node.js HTTP 文档 `2645dc73`](https://github.com/nodejs/node/blob/2645dc73720b1b4f27c49f395d3c66025ce126cc/doc/api/http.md)、[`@hono/node-server` `73c03adf`](https://github.com/honojs/node-server/tree/73c03adfb01928fcd5f5b20faebd5d692f83fc93)、[Fastify 生命周期文档 `af079bd4`](https://github.com/fastify/fastify/blob/af079bd4c60c3cbebedc7640517d7288468fb5eb/docs/Reference/Server.md) 与 [`@godaddy/terminus` `aea2f6de`](https://github.com/godaddy/terminus/tree/aea2f6de06dbc9f631dd4ac8a21b91c052add3ce) | MIT | 复用 Hono 已返回的 Node 原生 close/空闲连接/强制关闭生命周期；本地只补 OpenBot 调度尾任务排空。Terminus 无法观察 Server 权威 Run 提交，因此不新增依赖。没有复制上游源码。 |
| PostgreSQL migration 完整性 | [Drizzle ORM 0.45.2 `e7dfa145`](https://github.com/drizzle-team/drizzle-orm/tree/e7dfa14519f363229ccc3ead7b1b2f2051937efb)、[Postgres.js 3.4.9](https://github.com/porsager/postgres/tree/v3.4.9)、[PostgreSQL 17 `ec3f6a6a`](https://github.com/postgres/postgres/tree/ec3f6a6a7dd82a8ce455a0710ef75172f9f318d1) 与 [Docker Official Image `2603e26e`](https://github.com/docker-library/postgres/tree/2603e26e245e558218728ee14e0a42dcb020dc7f) | Apache-2.0；Unlicense；PostgreSQL License；MIT 加 PostgreSQL 组件 | 保留 Drizzle migrator，并按上游要求使用独立 `max: 1` Postgres.js 客户端；本地只增加数据库 advisory lock 与精确前缀哈希/时间戳校验，弥补已公开的高水位和并发启动缺口。固定 PostgreSQL 17.11 bookworm，在真实 CI 服务中测试。没有复制上游源码。 |
| 登录限速候选 | [hono-rate-limiter `d593af13`](https://github.com/rhinobase/hono-rate-limiter/tree/d593af1315184fdbd172eb9c90fe9021c134596c) 与 [express-rate-limit `c8b3c7ff`](https://github.com/express-rate-limit/express-rate-limit/tree/c8b3c7ff26cc285692f275f26624ad8bfa48f2d7) | MIT | 延期采用。没有经过认证的代理契约时，两者都不能建立可信远程身份。当前小型限速器明确仅属部署级保护；未来适配器必须处理 IPv4/IPv6、共享存储和 fail-closed。 |
| 办公室可视化 | 项目所有者提供的腾讯 Marvis 产品图片 | 未找到可复用源码许可证 | 只作视觉启发，不引入 Marvis 代码或资源；办公室继续作为延期插件。 |

## 追溯覆盖图

当前分支已在 2026-09-04 完成代码范围盘点。“已审查”只表示该机制已映射到上方固定版本条目，
不代表已经达到生产可用。“部分”会阻止继续扩展对应边界，直到缺失审查完成。

| 现有代码边界 | 覆盖状态 | 审查结果 |
| --- | --- | --- |
| 员工领域、个人页、进化、技能、记忆和员工包原语 | 已审查 | 已记录 Hermes、Letta、Mem0、LangMem、Agent Skills、OpenClaw、DSSE、Sigstore、in-toto、WAI-ARIA 与 React Spectrum；README、员工规范、ADR-0026 和记忆调研记录明确标注来源。 |
| Server 浏览器会话、Origin、实时投影、文件产物和进程停机 | 已审查 | 已记录 Hono/OWASP、Hono streaming、Node/Hono 停机、`write-file-atomic` 与 PNG 解码候选。已接受的调度工作会在 PostgreSQL 关闭前排空；分布式登录身份和完整 PNG 归一化仍是公开缺口。 |
| Node 协议、能力路由、存活、配置和启动身份 | 已审查 | 已记录 MCP/OCI conformance、`ws`、Kubernetes/Nomad、SPIFFE/SPIRE、Tailscale/Headscale、Kubernetes/Smallstep、Hono 限制、原子存储和严格 Zod 输入。单 Node 登记与吊销已完成；持有证明仍待实现。 |
| Provider SDK 与当前 Docker 浏览器适配器 | 已审查 | 已记录 CopilotKit/OpenBot `agent-computer`、Cua、MCP conformance、OCI 和平台声明等级；原生 Provider 只能按证据宣称。 |
| GitHub 贡献与 CI | 已审查 | 复用 Issue Form 和 RFC/KEP 证据结构；现有 checkout/setup Action 已固定到审查过的 commit，并关闭 checkout 凭证持久化。 |
| PostgreSQL store 与 migration 生命周期 | 已审查 | 已固定 Drizzle/Postgres.js/PostgreSQL 行为；journal 与数据库历史出现漂移时 fail closed，真实 PostgreSQL CI 覆盖首次并发 migration 和重复启动。 |
| PostgreSQL 与 Artifact 备份/恢复 | 部分 | 已选择原生 `pg_dump`/`pg_restore` 配合 Artifact 快照，并提供双语运维说明；定时、加密、保留、异地适配器和可重复完整恢复工具仍需专项上游审查。 |
| 多 Server 调度与事件分发 | 部分 | 已明确当前只支持单进程；增加第二个 Server 前必须先比较共享队列和事件系统。 |
| 办公室可视化插件 | 延期 | 只有公开产品图，没有找到可复用源码许可证，本版本不继续扩展。 |

## 已落实的审查结果

- 技能名采用 Agent Skills 兼容的“小写、连字符、最多 64 字符”子集，简介上限为 1,024 字符。
- 候选、已验证、暂停、撤销由 Server 明确管理，客户端不能直接创建已验证技能。
- 验证必须由已登录 Owner 明确审核，产生只追加进化事件，且不能修改工作主机能力、策略或授权。
- 并发创建和状态变更以冲突失败，不会静默覆盖审核。
- 当前证据快照有界，完整审核原因继续保存在不可变进化事件中。
- Owner 记忆写入有界、检查 revision、限制在单个员工内并产生无内容审计；凭据样文本和私钥复用
  现有导出扫描器，删除会移除正文，而 v1 员工包继续固定导出零条记忆。
- 员工预览继续执行校验和、严格 schema、只读和隔离规则。激活会重复检查、绑定人工审核过的摘要、
  要求单独接受未签名风险、生成新身份并保存不可变幂等收据。
- 技能来源属于员工赋值而不是共享技能定义，因此复用完全相同的定义时，导入赋值仍会明确显示为
  `imported`。
- Server 已有覆盖实际导入字节的 DSSE/Ed25519 签名验签链路，并增加实验性的加密文件密钥库、
  离线轮换/撤销、外部公钥显式信任、签名导出和验签后隔离预览。系统钥匙串、KMS、公开身份与
  信任分发仍是独立适配器。
- 协议 `0.9.0` 在每个 Run offer 中发送精确能力主版本；Server 与工作主机都会拒绝缺失或
  不兼容版本，旧能力别名不能静默降级契约。
- Provider 声明会在 Node 启动前检查；没有 `execute` 的包不会上报为可执行能力。
- Windows、macOS 和 Linux 具名路由场景明确区分模拟契约覆盖与真实设备支持，详见
  [Provider 一致性测试](PROVIDER_CONFORMANCE.zh-CN.md)。
- Provider 报告现在使用共享严格 schema 和确定性构建器，绑定明确目标；预期失败保持可见、会
  过期、仍不合规，并且报告不能自行授予支持或认证标签。
- 员工主页 Tab 已具备 WAI-ARIA 关系和横向键盘行为；创建、导入、导出弹窗使用原生模态、
  Escape 关闭、焦点限制和焦点返回，详见[无障碍基线](ACCESSIBILITY.zh-CN.md)。
- 浏览器会话现在会拒绝不安全的远程 Origin，复用 Hono 安全响应头，在 HTTPS 下使用 `__Host-`
  Cookie，并为每个 SSE 订阅设置有界队列与快照恢复。
- Node WebSocket 现在限制消息体和登记时间、关闭压缩、使用 ping/pong 判断存活并在 socket 错误时
  失败关闭；心跳不能再改写 Server 权威 Run 分配。
- 文件 Artifact 现在复用 `write-file-atomic` 完成 fsync、rename 和失败临时文件清理，最终权限经
  测试保持为 `0600`。
- Node 协议 `0.9.0` 会拒绝未知消息字段、错误或超长身份信息、重复能力、无界审批证据、格式错误
  的登记凭证，以及远程明文 WebSocket 配置。
- Owner 可以为准确 Node id 创建短时单次令牌。真实 PostgreSQL 并发测试证明只有一次兑换成功；
  Server 只保存摘要、支持单节点吊销并断开已吊销在线 Node，Node 在建立 WebSocket 前原子保存凭证。
- 仓库指令、功能调研模板、未来 ADR 检查和带测试的 PR 正文门禁，要求行为变化在合入前提供
  固定上游、许可证、复用选择、本地差集和源码引入证据。
- 现有 CI 中的 GitHub Action 已固定到完整 commit，checkout 不再保留仓库凭证。
- Server 停机现在会停止新调度、排空已接收的 Node 消息和进行中的 HTTP 请求、单独关闭已升级的
  Node socket，最后再关闭 PostgreSQL。空闲连接立即关闭，其余 HTTP 连接拥有经过测试的 10 秒宽限期。
- PostgreSQL 启动现在使用 Drizzle 要求的单连接 migration client 和稳定 advisory lock；仓库与
  数据库历史会在 migration 前后按精确前缀验证，CI 在 PostgreSQL 17 上测试首次并发启动。

## 尚未解决

- 当前技能记录只描述员工能力，尚未保存或执行符合开放规范的完整技能目录。
- 自动学习前必须增加提案过期/替代、通知和完整 diff 审核。
- 记忆检索、定时保留、自主写入提案、提示注入防护、版本恢复和选择性导出都必须先单独审查。
- 技能归档必须检查路径穿越、符号链接、解压大小、可执行内容、许可证、来源、签名和静态风险。
- 官方 `skills-ref` 需要 Python 3.11+，应在隔离检查 Worker 中运行，而不是放进权威 Server 进程。
- Provider 仍需独立场景 runner、隔离执行测试和可重复真实设备 CI，平台才可标记为
  Supported 或 Certified。
- `npm audit --omit=dev` 当前为零个生产依赖漏洞；完整审计在仅开发使用的
  Drizzle Studio，也不会采用 npm 建议的破坏性强制降级；只有兼容的上游修复版本通过审查后才升级。
- OpenBot 在宣称无障碍合规前，仍需真实屏幕阅读器、强制颜色、缩放/回流和自定义 Overlay
  证据。
- 登录限速尚不是可信的每设备或分布式边界；代理身份、IPv4/IPv6 规范化、共享存储和锁定通知
  语义仍未完成。
- Node 启动仍使用保存在 Owner-only 文件中的可复制 bearer credential。不可导出的持有证明密钥、
  系统密钥库、轮换、mTLS、防重放和持久化对账仍待完成。
- PNG Artifact 已限制大小并检查签名，但还没有解码归一化；未来解码器必须限制像素/通道并通过
  发布架构矩阵。当前本地 Artifact 根目录仍是管理员可信边界，不能与不可信写入者共享。

## Pull Request 必备信息

每个非简单功能 PR 都要链接调研记录或 ADR，并回答：评估了什么上游或标准；为什么选择依赖、
适配、fork 或本地差集；审查了哪个版本和许可证；是否复制/实质改编源码及其 NOTICE 在哪里；
当上游缺失、不兼容或被攻破时如何 fail closed。
