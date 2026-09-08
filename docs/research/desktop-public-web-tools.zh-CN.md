# 调研：安装版 Desktop 原生 Agent 的公开联网工具

[English](desktop-public-web-tools.md) · [简体中文](desktop-public-web-tools.zh-CN.md)

状态：已接受。日期：2026-09-08。验收目标是让当前安装版 `ops` 在没有用户提供网址的情况下搜索公开资料、读取来源并返回带证据的答复。

根因是两套运行路径没有集成：源码分支 `9cc73c9` 的搜索实现未进入安装版 Desktop。Desktop 的来源基线为 `cca7f36`，使用 AI SDK ToolLoopAgent，工具表没有搜索，并明确限制只能读取本条消息中的网址。

实现前重新搜索了 `vercel/ai moonshotai tool reasoning_content`、`vercel/ai ToolLoopAgent`、`MoonshotAI web_search`，核对 [AI SDK 文档](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)、[Kimi 官方工具](https://platform.kimi.com/docs/guide/use-official-tools)、[Tavily 搜索](https://docs.tavily.com/documentation/api-reference/endpoint/search)、已安装 SDK 源码和许可证，以及上游 issue 17798。完整候选比较、固定提交和维护证据见英文记录。

复用 ai 7.0.93 / `6359fd58fe68eaade096b5d923bac26de84ca3bd`、@ai-sdk/moonshotai 3.0.45 / `8a09c78c039e2c092468eaeff97faaabf3b77366`（Apache-2.0），通过薄适配器接入官方检索。无需新依赖，不复制外部上游源码，现有许可证继续随安装包分发。

明确设置的 Tavily 密钥优先，返回跨模型可读的文本。否则只有所选官方 Kimi 模型可以复用自己的密钥执行 Formula 搜索，密文只交回该 Kimi 模型。不会猜测其他账户、把其他模型密钥发给 Kimi 或跨服务发送 Kimi 密文。没有检索服务的其他模型仍可读取已知公开 HTTPS 来源。

网页读取复用现有 DNS 固定、IP 分类和 TLS 身份检查，不开放私网、重定向、登录态或电脑输入。联网前重新检查 Run 权限和配置，并先提交无正文的开始审计；失败即终止任务，不以旧知识冒充实时结果。提示词说明当前实际能力，并纠正历史“不能联网”的答复。

每任务最多四次联网调用，共享原有八次工具、五轮模型和 90 秒截止时间。检索响应最多 256 KiB，Kimi 原始证据最多 100,000 字符且序列化后最多 128 KiB；密文不可截断。其他工具保持 16 KiB 投影上限。官方 Formula 的 `latest` 是可变托管契约，不宣称远端实现可复现。

验证覆盖无网址搜索续轮、公共来源读取、调用白名单、审计先于网络、撤销、调用上限、响应大小、取消、超时和跨模型凭据隔离。完成 Desktop 工作树全量 `npm run check`，重新打包后核对安装版运行文件与签名，保留原有用户资料，再执行真实公开搜索验收。本机安装证据限 macOS arm64。

## 验证结果

Desktop 工作树全量 `npm run check` 通过：Server 339 项通过，26 项既有数据库集成用例因未配置测试数据库而跳过；Desktop 202 项、Web 138 项通过。检索适配器的 31 项测试包含响应读取停滞时的取消与超时。旧的按编号读网页入口也纳入四次联网预算，并有回归测试。

本机安装版已替换，打包产物和安装后的应用均通过 `codesign --verify --deep --strict`，仅为开发签名，不声明公证。安装文件哈希见英文记录。替换前后加密模型配置和启动身份文件哈希相同，既有工作区正常恢复。

通过实际安装版界面提交了一条 NVIDIA 官方规格的公开搜索测试，未提供网址、未要求读取频道历史。任务详情记录北京时间 20:20:18 的 `Started web_search`、20:20:20 的 `Completed web_search`，20:20:27 完成。仍使用 `moonshot / kimi-k3`，两轮模型调用，已报告输入 3,762、输出 179 Token，答复包含 NVIDIA 官方来源链接。

这证明安装版 Kimi 的一次真实搜索续轮与持久化进度，不证明其他模型账户的真实可用性，也不验证当前零售价。记录不包含私有会话、凭据或截图。
