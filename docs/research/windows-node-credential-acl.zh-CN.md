# 研究：Windows Node 凭据 ACL 强制

- 状态：已采纳
- 日期：2026-09-11
- 负责人：@yxflc11
- 相关：DEV-003 / DEV-002 M5
- 验收旅程：在 Windows 上，文件型 Node 身份写入仅允许当前用户与 SYSTEM 的目录/文件 DACL；加载前若出现意外 Allow ACE、继承授权、重解析点或非普通文件则拒绝。
- 安全边界：仅加固文件适配器中的可复制 bearer 凭据。不是 Credential Manager/DPAPI、持有证明，也不能防御特权本机操作者。Linux Secret Service 与 macOS Host 适配器不变。

## 检索证据

- 检索日：2026-09-11
- 主文档：Microsoft Learn `icacls`；.NET `FileSecurity`/`DirectorySecurity`/`SecurityIdentifier`（当前用户与 `S-1-5-18`）
- 复用：Desktop `windows-native-security.ts`；POSIX 凭据权限研究；已有 `write-file-atomic@8.0.0`

## 候选对比

见英文稿。本切片拒绝新 npm ACL 依赖（禁止改 package-lock），拒绝以本地化账户名拼 `icacls` 为主路径。

## 复用决策

- 选择：在 `apps/node` 内本地适配 Desktop 的编码 PowerShell ACL 模式（目录+文件；Owner+SYSTEM）。
- 失败行为：校验失败则拒绝读写；错误只报告固定阶段，不回显凭据明文。

## 验证计划

- 全平台：可注入 ACL helper 的单测；POSIX 旧测保持。
- Windows runner：真实 ACL 保存/加载与过宽 ACL 拒绝。
- 文档：NODE_ENROLLMENT 中英说明 Windows 文件存储现强制 Owner+SYSTEM DACL。

## 未决问题

- 祖先 reparse/junction 拒绝降低可写父路径替换风险，**不宣称**已覆盖全部路径攻击类。
- 已有操作者目录仅校验、不自动改写 ACL。

## 后续（DEV-005 / N2）

ACL/路径边界已抽取至 `@openbot/windows-secret-acl`，供 Server model-settings 与 plugin-store 复用；见 [server-windows-secret-acl.zh-CN.md](server-windows-secret-acl.zh-CN.md)。
