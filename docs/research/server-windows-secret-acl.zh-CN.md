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

- 仅在 load/save 路径校验；缓存进程 Owner SID；默认对 verify* 做 lstat 指纹缓存以避免每次热路径拉起 PowerShell（protect 始终执行）。
- **不为临时目录夹具削弱权限检查**；测试使用嵌套专用目录 + `trustRoot`。

## 验证计划

- 共享包单测；Node 凭据测试保持通过；Server 在非 Windows 上注入 mock ACL；真实 Windows 负向覆盖沿用 Node 既有 `skipIf` 模式（本 PR 不新增需 workflow 权限的 YAML）。
