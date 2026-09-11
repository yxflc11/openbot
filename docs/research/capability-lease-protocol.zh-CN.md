# 研究：capability lease 协议（DEV-001 H2）

- 状态：已采纳（设计契约；实现未开始）
- 日期：2026-09-11
- 负责人：@yxflc11
- 相关：DEV-001 H2 / ROADMAP 审批租约里程碑
- 验收旅程：Owner 批准一次 Server 已分类的待定动作后，Server 签发绑定精确
  run/node/provider/action/target 与 `targetFingerprint` 的短 TTL、单次消费 capability lease；
  Node 仅在 Server 侧 consume 成功后才能提交冻结的 `PreparedAction`；重启、吊销、并发与重放均
  fail closed；在本协议实现并测通前，真实副作用 Provider 保持禁用。
- 安全边界：Server 是唯一签发、消费授权与吊销权威。Node 与 Provider 仍不可信。仅有 Owner 决定
  通知不等于允许产生副作用。本地 Provider 证据核对（如截图相等）不能替代 Server lease。本设计
  不启用 Provider、不授予 Node 持有证明身份、也不替代人工独占 control lease。

## 当前代码证据（基线 `09392b301dda906b6be2c24e1926e15b252c16f1`）

只读勘察（本切片无运行时改动）：

| 区域 | 证据 | 相对 H2 的缺口 |
| --- | --- | --- |
| 协议 `approval.resolved` | `packages/protocol` 仅含决定字段 | 无租约声明、签名、TTL、指纹或消费令牌 |
| Server 投递 | `NodeRegistry.resolveApproval` 发送通知 | 通知 ≠ 能力 |
| Dispatcher | `RunDispatcher.resolveApproval` 投递失败则 `node_disconnected` | 无签发/消费路径 |
| Node 客户端 | 按 `requestId`/`runId` 恢复等待者 | 不复核 `targetFingerprint` |
| 指纹 | DB/领域持久化；`approvalTargetFingerprint` 在 `requestApproval` 计算 | 批准后从不重算或比对 |
| 受控点击 | Docker reviewed-click 本地冻结并复核后单击 | 文档已声明无签名单次执行租约 |
| 披露 | ADR-0028、API、ARCHITECTURE、DEV-001 H2、ROADMAP、SECURITY | 契约已禁止在租约协议前启用真实副作用 Provider |

完整候选表、标准链接与恶意用例矩阵以英文稿为准；中文稿固定同一结论。

## 检索证据

- 检索日：2026-09-11
- 标准：RFC 9449 DPoP、RFC 9396 RAR、SPIFFE/SPIRE、PASETO v4、Branca、macaroons、Node.js `crypto`
- 精确版本（拉取于 2026-09-11）：`paseto@4.0.1`/`5c7812e818c1`；`jose@6.2.12`/tag `99eaf5ed`；
  `macaroons.js@0.3.9`/`0a036117`；`branca@0.5.0`/`498bb5f7`；SPIRE `v1.15.3`/`2f7861ae`；
  libmacaroons tip `ca0211d8`（2021）
- 已核对：ADR-0028、DEV-001 H2、API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER、OPEN_SOURCE_REUSE

## 复用决策

- 选择：采纳 RFC 9449/9396 的单次证明与细粒度绑定语义，在 OpenBot 内用 Node `crypto` +
  PostgreSQL 实现 Server 签发/消费的本地缺口；v1 **不**引入 SPIRE、OAuth AS、PASETO、jose、
  macaroons 或 Branca 依赖。
- 最小编码切片（后续 PR）：`capability_leases` 表；扩展 `approval.resolved`；`lease.consume`；
  Node 指纹重算 + 提交前消费；吊销钩子；恶意矩阵测试。真实副作用 Provider 仍默认禁用。
- 失败行为：无租约密钥则启动失败；无效/过期/已吊销/已消费一律拒绝；不得回退到裸
  `approval.resolved`。

## 验证计划

- 设计阶段：英文研究记录 + ADR-0045 + 复用台账。
- 实现阶段：英文稿中的恶意/并发/重启矩阵与现有审批、reviewed-click、Run 迁移测试。
- 支持级别：仅设计契约；无运行时 lease 支持声明。

## 未决问题

- 首个实现选择 HMAC-SHA256 不透明令牌还是 Ed25519 可验证令牌（两者都要求 Server consume 权威）。
- 多 Provider Node 上 `providerId` 是否 v1 必填。
- 与未来独占 control lease 的抢占次序。
- consume 成功但副作用前崩溃：不复活租约，需重新审批。
