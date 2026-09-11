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

## 续（2026-09-11）：`broadenAcl` 在约 15s 处失败

- 将 180s 夹具合入 #37（`de9ae38`）后的 CI：
  [run 34602659437](https://github.com/yxflc11/openbot/actions/runs/34602659437) /
  [Portable (Windows x64) job 103273480290](https://github.com/yxflc11/openbot/actions/runs/34602659437/job/103273480290)。
  **5 条 ACL-only** 均在测试侧 `broadenAcl` 的 `powershell.exe` 约 15s 后失败
  （`Command failed: powershell.exe ...`）。**3 条保留读取**（不调用 `broadenAcl`）通过。
  这不是 180s Vitest 截止时间问题。
- 生产 `runWindowsSecretAclScript` 已在 `execFile` 后调用 `operation.child.stdin?.end()`，并使用
  inbox `SystemRoot\...\powershell.exe` + `shell: false`。先前测试夹具用 `promisify(execFile)`
  未关 stdin，且调用裸 `powershell.exe` 与 `Get-Acl`/`Set-Acl`（会触发
  Microsoft.PowerShell.Security 模块自动加载）。
- 选用修复（仍仅测试）：对齐生产启动卫生——关闭 stdin、固定 inbox powershell 路径、`shell: false`、
  保持 **15s** spawn 上限；并把 `broadenAcl` 改为固定 inbox .NET
  `GetAccessControl`/`SetAccessControl` + `FileSystemAccessRule`（与生产 ACL 脚本同族），
  不再用 `Get-Acl`/`Set-Acl`。真实负向断言不变。**不再**盲目加大夹具 deadline。

## 后续（2026-09-11）：Node 凭据存储原生套件（main `71b3d3b`）

- 失败 CI：main tip `71b3d3b194165ca8510e72d05984b966d4a06b9f`，
  [run 34608257071](https://github.com/yxflc11/openbot/actions/runs/34608257071)。
  `credential-store.test.ts:149`「natively enforces Owner+SYSTEM ACLs for Windows credential files」
  耗时 **60020ms**，超过 **60000ms** 夹具。同文件「parent directory ACL is broadened」以
  **27136ms** 通过。同次作业中 Server 原生 ACL 套件已绿（#39/#37 的 broadenAcl 卫生修复之后）。
- 根因同类：Node 原生否定仍用裸 `powershell.exe` + `Get-Acl`/`Set-Acl`，经 `promisify(execFile)`，
  未 `stdin.end()`、未 `shell: false`、未套生产 **15s** `execFile` 上限——与上文 Server
  follow-up 已修的挂起同类。
- 调用次数（`cacheVerifiedState` 默认关闭；每条 Node 原生否定 = save + 正向 load + broaden + 失败 load）：

  | 步骤 | PowerShell 次数 |
  | --- | ---: |
  | `save()` → `protectDirectory(created=true)` | 1 |
  | `save()` → `protectAndVerifyFile` | 1 |
  | 正向 `load()` → `verifyDirectory` + `verifyFile` | 2 |
  | 测试 `broadenAcl` | 1 |
  | 失败 `load()` → `verifyDirectory` + `verifyFile`（可能提前失败） | ≤2 |
  | **最坏** | **≤7** |

  生产预算：7 × 15s = **105s**。父目录否定在托管环境已观察到 **27136ms**。
- 选定修复（仅测试、仅 Node 凭据路径）：
  1. 镜像 Server/生产 `broadenAcl` 启动卫生——inbox powershell、`shell: false`、关闭 stdin、
     **15s** 上限、固定 `[IO.FileInfo]`/`[IO.DirectoryInfo]` + `GetAccessControl`/`SetAccessControl`
     （不用 `Get-Acl`/`Get-Item`/`Set-Acl`）。
  2. **仅**把这两条原生 Vitest 截止时间提到 **7 × 15_000 + 15_000 余量 = 120_000ms**。
  3. 保留真实 ACL 正/负断言；生产 `timeout: 15_000` 不变；ACL 指纹缓存保持关闭。
- 不在范围：PR #41 / linux-install-identity、H2、桌面附件、提高生产 broaden 超时、重开 ACL
  指纹缓存、删除否定断言、flaky/sleep 标记。
