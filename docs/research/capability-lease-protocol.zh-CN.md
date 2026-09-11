# 研究：capability lease 协议（DEV-001 H2）

- 状态：提议中（设计草稿；编码/算法已 **CONVERGE**；**设计闸门未关闭**，待维护者 Accept；实现未开始）
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

完整候选表、标准链接、声明字段表、原子事务、consume/cancel 竞态表与恶意用例矩阵以英文稿为准；中文稿固定同一结论。

## 检索证据

- 检索日：2026-09-11（同日完成 jose 选型与 Ed25519 alg 固定复核）
- 标准：RFC 9449 DPoP、RFC 9396 RAR、RFC 7515/7519 JWS/JWT Compact、SPIFFE/SPIRE、PASETO v4、
  Branca、macaroons、Node.js `crypto`
- **jose@6.2.12**：npm MIT、**无运行时依赖**；GitHub 注释 tag 对象 `99eaf5ed086cbee3fe49fcdf68681f68b1f122f7`
  剥到真实提交 **`505a55b8f73536082367b2614cb77e927ba96ec1`**（`gh` 已核实）
- jose 文档：[`JWTVerifyOptions`](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md)
  支持固定 `algorithms` allowlist，以及 `issuer` / `audience` / `typ` / `requiredClaims`；`alg: "none"`
  永不接受
- [panva/jose#262 Node 支持表](https://github.com/panva/jose/issues/262)：Edwards-curve DSA 的 JWS alg 为
  **`EdDSA`** 与 **`Ed25519`**。本地 Node `v22.22.2`：`generateKeyPairSync('ed25519')` 可用；
  `SignJWT` + `alg: "Ed25519"` 发出受保护头 `alg: "Ed25519"`；`algorithms: ['EdDSA']` 与
  `['Ed25519']` **互斥精确匹配**（交叉验证为 `ERR_JOSE_ALG_NOT_ALLOWED`）
- 比较过的其他精确版本：`paseto@4.0.1`/`5c7812e818c1`；`macaroons.js@0.3.9`/`0a036117`；
  `branca@0.5.0`/`498bb5f7`；SPIRE `v1.15.3`/`2f7861ae`
- 已核对：ADR-0028、DEV-001 H2、API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER、OPEN_SOURCE_REUSE、
  AGENTS「优先维护中的已发布依赖」次序；Employee DSSE/Ed25519 为**不同**信任域

## 复用决策（CONVERGE）

- **选定编码库：** `jose@6.2.12`（MIT；提交 `505a55b8…`；无运行时依赖）用于 **JWS Compact JWT**
  签发（`SignJWT`）与校验（`jwtVerify`）。
- **选定算法：** Server 使用 Ed25519 私钥签发；受保护头固定 **`alg: "Ed25519"`**（完全指定标识）。
  校验 allowlist 仅为 `['Ed25519']`。拒绝 `EdDSA`（除非未来签发 API 被迫改发 `EdDSA`——那时冻结为
  单一值并要求精确匹配，绝不双收）、`none` 及其他算法。
- **架构：**
  1. Server 持有私钥并签发；
  2. Node **仅**持有/钉扎公钥，按可信 `kid` 校验；
  3. Server 在 PostgreSQL 中执行**原子 consume**（jose 不负责租约存储语义——这是 OpenBot 缺口，
     **不能**因此拒绝 jose 作为签名编码库）。
- **改写先前对 jose 的拒绝：** 早期草稿以「依赖 / 密钥生命周期 / 租约存储」推迟 jose。在 CONVERGE
  与 OPEN_SOURCE_REUSE/AGENTS 次序下修订为：签名编解码优先采用维护中的库；**「库不提供 OpenBot
  租约存储语义」不是拒绝 jose 做签名编码的理由**。密钥生命周期、`kid` 轮换、竞态与 WS 协议仍由
  OpenBot 自有实现承载。
- 不采用 SPIRE/OAuth/macaroons/Branca；PASETO 作为备选编码推迟。HMAC 不透明令牌不作为主编码。
- `providerId`：对一切副作用动作的签发与消费 **必填**；缺失/不匹配则 fail closed。
- **可信 `kid` 与轮换：** Server 向 Node 发布/钉扎已知 `kid→公钥`；Node 只接受已配置 kid；轮换保留
  上一公钥至多一个 TTL 校验窗；**禁止**根据令牌中的 `jku`/`jwk`/`x5u`/`x5c` 等做远程取钥。
- **令牌上限与声明：** Compact JWT 硬上限 **8192** 字节；必需声明含 `runId`/`nodeId`/`providerId`
  （副作用）/`action`/`targetFingerprint`/`jti`/`iat`/`exp`/`nbf`/`iss`/`aud` 等（详见英文表）。
- **签发与批准原子事务：** `decideApproval(approved)` 与插入 `issued` 租约行同一事务；密封失败则回滚。
- **consume vs cancel/revoke：** 条件更新先胜；至多一次成功 consume；重复 consume 为 deny；重复
  revoke 幂等；全量审计。
- **协议降级拒绝：** 带 lease 的消息有最低 `protocolVersion`；不得向旧客户端省略 lease 仍当作授权；
  Node 在要求 lease 的版本上拒绝裸 `approval.resolved` 作为提交权威。
- **最小编码切片（仅在设计 Accept 之后）：** 添加 `jose@6.2.12`；`capability_leases` 表；扩展
  协议；Server 签发/消费/吊销；Node 公钥校验 + 指纹重算 + 提交前消费；恶意矩阵。真实副作用
  Provider 仍默认禁用。
- 失败行为：无签发密钥或无公钥钉扎则启动失败；无效/错误 alg/kid/过期/已吊销/已消费一律拒绝；
  不得回退到裸 `approval.resolved`。

## 验证计划

- 设计阶段：英文研究记录 + ADR-0045（Proposed / CONVERGE）+ 复用台账。
- 实现阶段（Accept 后）：英文稿恶意/并发/重启/原子事务/providerId/`jku`/`Ed25519` 矩阵与现有审批、
  reviewed-click、Run 迁移测试。
- 支持级别：仅 **Proposed** 设计草稿；设计闸门未关闭；无运行时 lease 支持声明。

## 未决问题

- 维护者 **Accept** ADR-0045 之前不得合并编码切片；尽管编码已 CONVERGE，状态仍为 Proposed。
- 编码切片 CI 须确认 `SignJWT` 实际发出的受保护头 `alg` 仍为 `Ed25519`。
- 与未来独占 control lease 的抢占次序。
- consume 成功但副作用前崩溃：不复活租约，需重新审批。
- 是否存在任何非副作用 lease 路径；在明确规范前，`providerId` 省略仍禁止。
- lease 消息的精确 `protocolVersion` 字面量（编码切片决定）。

## v1 精确契约补充

本补充回应 PR #38 的设计审查，状态仍为 Proposed。没有增加运行时依赖或开启 Provider。
英文稿的 [v1 addendum](capability-lease-protocol.md#review-addendum-exact-v1-profile) 为精确契约。

- 依据 [RFC 8725 §3.11–3.12](https://www.rfc-editor.org/rfc/rfc8725.html#section-3.11)，
  受保护头 `typ` 固定为 `openbot-capability-lease+jwt`，必填 `tokenUse` 固定为
  `capability_lease`。两端都做精确匹配，拒绝通用 JWT、用途缺失、aud 数组和未知版本。
  库校验后仍检查原始受保护头，不能依赖媒体类型归一化；独立密钥与固定 Ed25519 不变。
- 依据 [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) 的 JCS，选定
  [canonicalize 5.0.0](https://github.com/erdtman/canonicalize/releases/tag/v5.0.0)，
  注释 tag `1e0ae5bda3b131033921f194b0569156e9db7b78`，提交
  `7d97c70c79c9f52070e6c24c38a92f0dd9b32a57`，Apache-2.0，无运行时依赖，要求 Node >=22。
  2026-09-11 审阅源码、发布说明、导出与八个测试文件；本机 macOS Node 26.0.0 上
  `npm test` 的 86 项测试通过。Node 22/24 仍由编码切片验证。公开问题 #30/#31 涉及文档和
  发布 provenance。库会接受 toJSON、丢弃部分非 JSON 值，也不能恢复解析器丢失的重复键，
  因此前置严格验证，不能把序列化器当验证器。未来安装时保留许可证及上游 NOTICE。
- 必填 `fingerprintVersion = openbot-action-jcs-v1`。封套精确为
  `{ action, beforeState, providerId, target, version: "openbot-action-jcs-v1" }`；对
  `UTF8("openbot:action-fingerprint:v1\n" + canonicalize(envelope))` 做 SHA-256，输出小写
  64 位 hex。前缀末尾为单个 LF，无 BOM；不在哈希时规范化 URL、路径、大小写或 Unicode。
  run/node/approval/connection 为另外的签名绑定。双方从各自冻结的动作独立构造和核对。
- OpenBot 自定义限额：封套只含上述五键；action/providerId 为 1–128 字符 ASCII catalog ID，
  模式 `[A-Za-z0-9][A-Za-z0-9._:-]{0,127}`；target 非空、至多 2048 UTF-8 字节；beforeState
  为对象或 null。完整规范字符串至多 65536 字节、32 层容器（根算一层）、4096 个值（含根）。
  原始字符串解析前先限字节和深度。二进制状态使用审阅过的内容摘要和有界引用。
- 只接受 JSON 数据值、有限数值、合法 Unicode、稠密数组和普通数据对象；拒绝不安全整数
  （改用字符串）、undefined、函数、symbol、BigInt、稀疏数组、访问器、自定义原型、toJSON
  和循环引用。负零规范为零。验证不是执行任意 Provider JS 对象的沙箱。
- 新准备协议以规范 JSON **字符串**传封套；限额内解析、验证、重新序列化后，要求 UTF-8
  字节完全一致，拒绝重复键、空白变体和非规范编码。还需与本地冻结动作逐字段核对，不能
  只相信收到的规范字符串或 Server 摘要。
- 新审批及租约持久化版本；旧无版本指纹保留历史，不能直接签发 v1。必须重新准备和让
  Owner 审批，不能静默重算或退回旧 JSON.stringify 算法。两端未来共用
  [正负向量](capability-lease-v1-vectors.json)；这只是契约数据，不冒充已实现验证器。
- iat/nbf/exp 为整数 epoch 秒，nbf=iat，iat<exp，exp 不超过 iat+120 或审批到期秒数。
  Server 签发和消费使用数据库时钟，严格 `nbf <= now < exp`，零授权宽限，等于 exp 即拒绝。
- 每次认证 WebSocket 由 Server 生成不可预测的 256-bit connectionId，写入签名与租约行；
  重连换新 ID，消费按真实连接核对，不能信任客户端自报。断线吊销未消费租约。
- Node 每次消费生成独立 consumeRequestId UUID；请求和响应同时绑定请求、lease、run、node、
  provider、connection、fingerprintVersion、targetFingerprint，响应另带 Server exp/consumedAt（数据库转移时捕获的整数 epoch 毫秒）。
  只在原 socket 回应，禁止广播、缓存复用成功结果。Node 只保留一个等待者，成功后原子移除并
  本地标记已用；提交前再核对连接、取消和本地到期。
- 拒绝无等待者、重复、错绑定、旧连接、单调时钟等待达到 5 秒或本地 now>=exp 的响应。
  两端 JWT 时间宽限为零；与认证 Server 时间相差超过 5 秒时停用提交直到恢复时钟健康。
  5 秒是拒绝阈值，不延长授权。调用前独立要求
  `consumedAt + 从发送请求起的单调时钟毫秒数 < exp * 1000`，保守包含双向网络延迟；
  不可收到回执后才开始计时，consumedAt 必须在令牌有效期内。该约束限制开始提交的权限，
  不承诺外部动作在 exp 前完成。可信时钟是运行前提，不能防住已完全失陷的 Node。
- 数据库最多成功消费一次，不保证跨崩溃恰好执行一次。丢回执、消费后未执行或执行中崩溃，
  都不能自动重试；需要新的经审阅批准。

新增验收包括用途/版本错误、重复键、非法 JS 值、限额边界、旧审批、到期相等、错连接、
延迟/重复成功回执、重连、提交前取消、时钟健康失败及消费后崩溃；原有算法、密钥、竞态测试
继续保留。维护者采纳设计、编码与恶意用例全部通过之前，不宣称 H2 已修复。
