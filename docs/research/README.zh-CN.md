# 功能调研记录

[English source](README.md) · [简体中文](README.zh-CN.md)

OpenBot 的每项行为变化都要先证明已经调研维护中的开源代码和标准，再开始本地实现。当 Issue
或完整 ADR 不合适时，这个目录用于保存轻量、可长期追溯的记录。

实现前请使用[英文模板](TEMPLATE.md)；中文可以参考[中文模板](TEMPLATE.zh-CN.md)。一份记录只
覆盖一条验收路径。星标数量不是唯一标准，维护状态、测试、平台适配、权限模型、API 稳定性和
许可证兼容性更重要。

如果 Issue 已包含模板全部字段且可以永久链接，可以直接作为调研记录。会改变公共契约、信任
边界、持久化格式、依赖或长期架构的选择应写 ADR。纯拼写、翻译和不改变行为的机械格式调整
不需要记录。

只有明确选择以下一种方案后才能开始实现：采用开放标准；使用正式发布的依赖或独立服务；
编写固定上游契约的薄适配器；向上游贡献通用缺口；维护带升级计划的窄 fork；最后才是实现已经
精确定义的 OpenBot 特有差集。

如果没有找到可用项目，必须记录日期、实际搜索词、看过的仓库和不适用原因。不能用“没找到”
逃避署名或许可证审查。

已接受记录包括 [Owner 管理员工记忆](owner-managed-employee-memory.md)：明确将进化/记忆方向
归因于 Hermes，并在选择 OpenBot 现有 PostgreSQL 边界前比较 Letta、Mem0 与 LangMem。
另见[员工档案实时失效通知](employee-profile-realtime-invalidation.md)：它复用现有 Hono SSE，
同时让档案正文继续只通过鉴权 REST 获取。
随后，[Owner 技能审核界面](owner-skill-review-surface.md)把已有的权威技能生命周期映射成可检查
的档案流程，但不会安装可执行代码。[员工进化档案](employee-evolution-archive.md)明确注明 Hermes
的启发来源，并把其真实日期旅程交互适配到 OpenBot 仅追加的 Server 记录。
[Owner 管理员工主页详情](owner-employee-profile-details.md)审查继续复用现有 revision 变化路径及
Hermes/Kubernetes 的冲突语义，只开放说明性字段。
[可迁移员工资料审核](portable-employee-profile-review.md)继续补齐传输安全：接收方会在激活前，
从现有摘要绑定的隔离预览中看清员工简介。
[可迁移员工技能披露](portable-employee-skill-disclosure.md)随后采用 Agent Skills 与 OpenClaw 的
审核边界，在所有导入技能仍被禁用时显示技能说明与依赖。
[员工导出内容预览](employee-export-content-preview.md)补齐发送方边界：下载前先看清将要离开
Server 的完整说明性资料和所选技能元数据。
[可迁移员工技能依赖闭包](portable-employee-skill-dependency-closure.md)随后阻止模板静默丢弃
不在已验证导出集合中的依赖。
