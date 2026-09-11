# 研究：Server model/plugin 共享 Windows 机密 ACL（DEV-005 / N2）

- 状态：已采纳
- 日期：2026-09-11
- 负责人：@yxflc11
- 相关：DEV-005 / N2（承接 DEV-003 Windows Node 凭据 ACL）
- 验收旅程：在 Windows 上，Server `model-settings` 与 `plugin-store`（含 `.key`）使用与 Node
  文件凭据相同的 Owner+SYSTEM DACL、路径边界与 Allow ACE 规则；已有目录仅校验不改写；新建专用目录在写入机密前保护；ACL 正确时既有机密文件仍可读。
- 安全边界：仅加固 Server 本地加密配置/插件状态的文件适配器。不是 Credential Manager/DPAPI、PoP/mTLS，也不能防御特权本机操作者。

## 复用决策

- 选择：抽取工作区包 `@openbot/windows-secret-acl`（仅收件箱 PowerShell/.NET，无新外部依赖），Node 与 Server 共用；禁止在 Server 再复制一份实现。
- 失败行为：校验失败则拒绝读写；错误只报告固定阶段。

## PowerShell 启动成本

- 仅在 load/save 路径校验；缓存进程 Owner SID；Server 服务内持有长寿命 ACL 助手实例以便复用 SID。
- **默认关闭** verify* 的 ACL 结果指纹缓存（`cacheVerifiedState` 默认为 `false`），每次 load/save 都重新校验 DACL；仅允许显式性能实验选择开启，且不得声称 mtime 能发现仅 ACL 变更。
- **不为临时目录夹具削弱权限检查**；测试使用嵌套专用目录 + `trustRoot`。

## 验证计划

- 共享包单测；Node 凭据测试保持通过；Server 在非 Windows 上注入 mock ACL。
- 真实 Windows Server 负向/保留读测试（`skipIf(process.platform !== "win32")`）覆盖 model settings、bootstrap key、plugin store/key：首次成功读取后仅改 DACL 则下次读取必须失败；新进程实例在 ACL 正确时仍可读。本 PR 不新增 workflow YAML。
