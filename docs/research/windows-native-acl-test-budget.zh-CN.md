# 调研：Windows 原生 ACL 测试超时预算

- 状态：已采纳
- 日期：2026-09-11
- 负责人：@yxflc11
- 相关：[Server Windows 机密 ACL](server-windows-secret-acl.zh-CN.md)（DEV-005 / N2）原生测试
- 验收路径：托管 Windows CI 能跑完真实原生 ACL 套件，不再被 60s 测试夹具超时打断；全部断言仍打真实 Owner+SYSTEM DACL；每次 PowerShell 启动仍有上限。
- 安全边界：**仅测试** Vitest 截止时间，以及原生测试 `broadenAcl` 的 `execFile` 超时。生产包 `@openbot/windows-secret-acl` 的 `executeFile` 仍是 `timeout: 15_000`。ACL 结果指纹缓存保持关闭（`cacheVerifiedState` 默认 `false`）。原生文件不使用 mock ACL。

## 搜索证据

- 搜索日期：2026-09-11
- 失败 CI：[PR #37](https://github.com/yxflc11/openbot/pull/37) alpha.7 head
  `956699aa3676d1852886c3814e38a7506cfcb110`，
  [run 34601031115](https://github.com/yxflc11/openbot/actions/runs/34601031115) /
  [Portable (Windows x64) job 103268086588](https://github.com/yxflc11/openbot/actions/runs/34601031115/job/103268086588)。
  `server-windows-secret-acl.native.test.ts` 第一条
  「model settings: ACL-only file DACL change after read fails the next read」耗时 **60009ms**，超过 **60000ms** 夹具（`Error: Test timed out in 60000ms`）。其余 7 条通过。
- 先前绿灯、已接近上限：[PR #36](https://github.com/yxflc11/openbot/pull/36)
  [run 34598489450](https://github.com/yxflc11/openbot/actions/runs/34598489450) /
  [Portable (Windows x64) job 103259793174](https://github.com/yxflc11/openbot/actions/runs/34598489450/job/103259793174)。
  同一条 model ACL-only 测试 **55648ms**；8 条合计 174783ms。
- 生产每次 spawn 上限：`packages/windows-secret-acl/src/index.ts` 中 `timeout: 15_000`。

## 调用次数（`cacheVerifiedState` 默认关闭）

每次 `protectDirectory` / `verifyDirectory` / `protectAndVerifyFile` / `verifyFile` 都会启动一次 PowerShell。默认不做 verify* 结果缓存。

### Model settings ACL-only（save + summary + broaden + 失败的 summary）

| 步骤 | PowerShell 次数 |
| --- | ---: |
| `save()` 时文件不存在的 `#read` | 0 |
| `ensureProtectedSecretDirectory` → `protectDirectory(created=true)` | 1 |
| `protectSecretFile` → `protectAndVerifyFile` | 1 |
| `save()` 末尾 `summary()` → `verifyDirectory` + `verifyFile` | 2 |
| 显式 `summary()` | 2 |
| 测试 `broadenAcl`（一次 `execFile`） | 1 |
| 失败的 `summary()` → `verifyDirectory` + `verifyFile`（可能提前失败） | ≤2 |
| **最坏** | **≤9** |

生产预算：9 × 15s = **135s**。托管 runner 实测墙钟已达 55.6s–60.0s。

### Plugin `.key` ACL-only（persist + read + broaden + 新 store 首次失败读）

| 步骤 | PowerShell 次数 |
| --- | ---: |
| `transaction` 时 store 文件不存在的 `#load` | 0 |
| `#encryptionKey` → `ensureProtectedSecretDirectory`（新建） | 1 |
| `protectSecretFile`（`.key`） | 1 |
| `transaction` 再次 `ensureProtectedSecretDirectory`（已存在，仍会 spawn） | 1 |
| `protectSecretFile`（store 文件） | 1 |
| `first.read()` → `verifySecretFileAccess(store)` | 2 |
| 测试对 `.key` 做 `broadenAcl` | 1 |
| `restarted.read()` → `verifySecretFileAccess(store)` | 2 |
| `#encryptionKey` → `ensureProtectedSecretDirectory`（已存在） | 1 |
| `verifySecretFileAccess(.key)`（文件校验失败） | ≤2 |
| **最坏** | **≤12** |

同一绿灯 run 实测 **25888ms**（#36）/ **25884ms**（#37）。托管 spawn 通常约 3–6s，而不是 15s 上限。

## 候选比较

| 候选 | 适配 | 决定 |
| --- | --- | --- |
| **只**把原生测试 Vitest 截止时间提到 9 × 15s + 45s 余量（**180_000ms**），并为 `broadenAcl` `execFile` 加上与生产相同的 15s spawn 上限 | 与调用次数一致；断言仍真实；不改生产包 | **选用** |
| 重新打开 ACL 结果指纹缓存 | 会让仅改 DACL 的 Everyone 授权逃过下次读取 | 拒绝 |
| 在原生文件里 mock ACL | 丢掉 Windows DACL 契约 | 拒绝 |
| 改生产 `timeout: 15_000` | 超出本切片；不是生产挂死 | 拒绝 |
| 无上限 / 全局把 `testTimeout` 拉到数分钟 | 掩盖无关 stall | 拒绝 |

## 复用决定

- 选择：按 N 次生产 spawn × 15s + 开销，给出**有界**测试截止时间。
- 选用超时：文件内全部原生测试 `NATIVE_TIMEOUT_MS = 180_000`。
  - Model：9 × 15_000 + 45_000 runner/争用余量 = 180_000。
  - Plugin `.key` 理论上 12 × 15s 只有在每次 spawn 都顶满生产上限时才会碰到该截止；托管证据约 26s，因此 180s 仍是上限而不是无限等待。
- `broadenAcl` 的 `execFile` 设置 `timeout: 15_000`（与生产 `executeFile` 相同）。
- 失败行为：卡住的 spawn 仍在 15s 被杀掉；卡住的测试仍在 180s 失败。

## 源码引入

- 是否复制或实质改编源码：否。
- 无新依赖。

## 验证计划

- 原生断言不变（仅改 DACL 则下次读取必须失败；ACL 仍为 Owner+SYSTEM 时保留读成功）。
- Linux/macOS：`describe.skipIf(process.platform !== "win32")`；本 PR 不改 workflow YAML。
- 不要推到 PR #37；对 `main` 开独立 Draft PR 供 Codex 合入。

## 未决问题

- Server Vitest Windows 任务的 `maxWorkers=2` 是否应为本文件降到 1。本切片在有界 per-test 截止已覆盖争用后保持不变。
