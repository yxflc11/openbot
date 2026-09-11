# 研究：capability lease 协议（DEV-001 H2）

- 状态：提议中（设计草稿；**设计闸门未关闭**；实现未开始）
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

完整候选表、标准链接、原子事务定义、consume/cancel 竞态表与恶意用例矩阵以英文稿为准；中文稿固定同一结论。

## 检索证据

- 检索日：2026-09-11（同日复核 jose 固定算法 allowlist API）
- 标准：RFC 9449 DPoP、RFC 9396 RAR、SPIFFE/SPIRE、PASETO v4、Branca、macaroons、Node.js `crypto`
- jose 文档核实：[JWTVerifyOptions.algorithms](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md)
  支持 `algorithms?: string[]` 固定算法允许列表；`alg: "none"` 永不接受。**因此不能仅以
  “algorithm agility” 为由拒绝 jose。**
- 精确版本（拉取于 2026-09-11）：`paseto@4.0.1`/`5c7812e818c1`；`jose@6.2.12`/tag `99eaf5ed`；
  `macaroons.js@0.3.9`/`0a036117`；`branca@0.5.0`/`498bb5f7`；SPIRE `v1.15.3`/`2f7861ae`；
  libmacaroons tip `ca0211d8`（2021）
- 已核对：ADR-0028、DEV-001 H2、API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER、OPEN_SOURCE_REUSE

## 复用决策

- 选择：采纳 RFC 9449/9396 的单次证明与细粒度绑定语义，在 OpenBot 内用 Node `crypto` +
  PostgreSQL 实现 Server 签发/消费的本地缺口；v1 **不**引入 SPIRE、OAuth AS、PASETO、jose、
  macaroons 或 Branca 依赖。
- **拒绝 jose 的真实理由（已核实文档后）**：新增运行时依赖成本；不匹配 Server 自有租约密钥
  生命周期/双钥轮换/启动 fail-closed；无法提供 PostgreSQL 单次消费与吊销存储语义；JWT 编码
  本身不能关闭 WS 协议与指纹复核缺口。**不是**因为算法敏捷性——jose 支持固定 `algorithms`
  allowlist；若日后选择 JWT 编码，jose 仍可作为带显式允许列表的候选。
- **密封算法未决（UNDECIDED）**：HMAC-SHA256 不透明令牌 vs Ed25519 可公开验证令牌。本设计
  **不假装已选定**。编码 ADR 须按英文稿决策标准表择一；两者都要求 Server consume 仍为副作用
  唯一授权。
- `providerId`（非随意可选）：对一切副作用动作的签发与消费 **必填**；缺失/不匹配则 fail closed
  （不提交 approve+lease，或拒绝 consume）。仅当未来明确存在非副作用探测路径且目录可证明唯一
  Provider 时才可省略；在此之前省略一律禁止。多 Provider Node 始终必填。
- **签发与批准原子事务**：`decideApproval(approved)` 与插入 `issued` 租约行必须在同一数据库事务
  （或等价原子单元）中成功或一并回滚；密封失败则回滚，不得出现“已批准但无租约行”或向 Node
  发出带 lease 的 `approval.resolved`。
- **consume vs cancel/revoke 竞态**：对同一 `issued` 行的条件更新，先成功者胜；另一路径得到
  deny 或幂等 no-op。同一 `leaseId` 至多一次成功 consume；重复 consume 为非成功 deny；重复
  revoke 对已吊销幂等成功，对已消费为幂等 no-op。每次尝试写入审计（leaseId、主体、原状态、
  结果）。consume 成功后副作用前崩溃不复活租约，需重新审批。
- 最小编码切片（后续 PR）：`capability_leases` 表；扩展 `approval.resolved`；`lease.consume`；
  Node 指纹重算 + 提交前消费；吊销钩子与竞态规则；恶意矩阵测试。真实副作用 Provider 仍默认禁用。
- 失败行为：无租约密钥则启动失败；无效/过期/已吊销/已消费一律拒绝；不得回退到裸
  `approval.resolved`。

## 验证计划

- 设计阶段：英文研究记录 + ADR-0045（Proposed）+ 复用台账。
- 实现阶段：英文稿中的恶意/并发/重启/原子事务/providerId 矩阵与现有审批、reviewed-click、Run
  迁移测试。
- 支持级别：仅 **Proposed** 设计草稿；设计闸门未关闭；无运行时 lease 支持声明。

## 未决问题

- **密封算法（UNDECIDED）**：首个实现选择 HMAC-SHA256 还是 Ed25519（两者都要求 Server consume
  权威）；按英文决策标准表在编码 ADR 中选定，此处不选定。
- 与未来独占 control lease 的抢占次序。
- consume 成功但副作用前崩溃：不复活租约，需重新审批。
- 是否存在任何非副作用 lease 路径；在明确规范前，`providerId` 省略仍禁止。
