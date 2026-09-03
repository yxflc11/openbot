# 贡献者任务包

[English](CONTRIBUTOR_TASKS.md) · [简体中文](CONTRIBUTOR_TASKS.zh-CN.md)

这些任务把路线图拆成可以独立审查的贡献。实现前请使用对应表单创建 Issue，链接固定版本的上游
调研，并把支持声明限制在测试真正证明的最低等级。

## 入门：无障碍回归检查器

- **结果：**构建后的 Web 应用可以重复检查键盘、名称/角色/状态和高置信 WCAG 回归。
- **路径：**`apps/web`、`.github/workflows`、`docs/ACCESSIBILITY.md`。
- **先调研：**比较 `axe-core`、Playwright 无障碍工具和维护中的 Vitest 集成，固定版本与许可证。
- **验收：**确定性本地命令、CI Artifact、无实时网络、记录误报，并用一个故意违规 fixture 证明
  门禁会失败。
- **不包含：**只凭自动化就宣称屏幕阅读器或 WCAG 合规。

## 入门：翻译一致性检查

- **结果：**英文原文与维护中的语言文件不会静默丢失安全警告、命令或配置名。
- **路径：**`scripts/check-docs.mjs`、`README*.md`、`docs/*.md`。
- **先调研：**增加本地规则前先比较文档 lint 与本地化一致性工具。
- **验收：**fixture 缺少警告/链接时必定失败，输出具体文件与缺少契约，不调用机器翻译。
- **不包含：**判断译文文采或自动改写翻译。

## 中级：Provider 一致性 runner

- **已有基础：**`openbot.provider-conformance/v1`、严格 schema、预期失败语义、确定性构建器和
  单元 fixture 已实现。
- **结果：**独立 runner 执行 Provider 场景集，发布带可复现隔离或真实设备证据的有界 JSON
  报告。
- **路径：**新 runner 包、`packages/provider-sdk`、Provider 集成测试和 `.github/workflows`。
- **先调研：**[开源复用审查](OPEN_SOURCE_REUSE.zh-CN.md)已固定的 MCP、Kubernetes、OCI 来源，
  以及当前仍维护的 runner 库。
- **验收：**复用共享构建器；Artifact 不含原始秘密；明确预期失败；过期/陈旧基线失败；确定性
  fixture；不能自我认证。
- **不包含：**托管认证服务或真实设备 CI 集群。

## 中级：Agent Skills 隔离检查 Worker

- **结果：**隔离 Worker 使用官方 `skills-ref` 检查有大小上限的技能目录，不安装、不执行。
- **路径：**新检查 Provider/Worker，不能放在 Server 进程内。
- **先调研：**Agent Skills 验证器、OpenClaw 隔离指导、归档解压库和沙箱方案。
- **验收：**路径穿越、符号链接、解压膨胀、未知文件、非法元数据和验证器失败全部 fail closed；
  Server 只收到有界报告。
- **不包含：**激活、主机授权、自主执行技能或网络访问。

## 已完成基线：签名员工包设计

- **已交付：**ADR-0014 与 ADR-0024 定义签名信封、加密本地密钥库、显式信任、轮换、撤销和
  `openbot.employee/v1` 离线验证。
- **路径：**`docs/decisions`、`apps/server/src/employee-package.ts`、`packages/domain`。
- **先调研：**Sigstore、in-toto、DSSE、TUF 和现有 Agent 包签名方案。
- **待共建：**系统钥匙串/KMS 适配、发布密钥过期、TUF 连续信任和公开身份/透明度，且不得改变
  DSSE 员工包契约。
- **仍不包含：**激活或所有权转移。

## 高级：审核后激活员工

- **结果：**只有 Owner 明确命令和不可变审核收据才能把隔离预览变成新的本地员工。
- **路径：**`apps/server`、`packages/db`、`apps/web`。
- **先调研：**供应链审核队列和事务型导入模式。
- **验收：**新员工 ID、技能默认禁用、没有记忆或主机绑定、幂等键、审计收据，并发/重放失败。
- **不包含：**自动信任发布者、复制现有本地身份或所有权转移。

## 高级：每 Node 独立注册

- **结果：**把当前可单独吊销的 bearer credential 升级为可轮换、具有持有证明的工作主机身份。
- **路径：**`apps/server`、`apps/node`、`packages/protocol` 和部署文档。
- **先调研：**SPIFFE/SPIRE、mTLS 引导、短期证书轮换与设备注册威胁模型。
- **验收：**保留单次登记与吊销；增加不可导出密钥支持、挑战应答、轮换、防重放测试、Server
  审计，并且 Node 不开放公网端口。
- **不包含：**员工身份或操作系统账户创建。

## 平台：Windows、macOS 或 Linux 原生 Provider

- **结果：**一个窄原生 Provider 通过真实目标平台证据从 Declared 提升到 Integrated。
- **路径：**`providers/<name>`、`packages/provider-sdk`、`docs/CROSS_PLATFORM.md`。
- **先调研：**先填 Provider Issue 表单，比较成熟操作系统自动化项目，再写适配器。
- **验收：**精确能力主版本、隔离负向测试、真实设备报告、本地权限诊断、审批边界、有界产物与
  fail-closed 取消。
- **不包含：**宣称其他平台、任意管理员权限或绕过 Server 路由/审批。
