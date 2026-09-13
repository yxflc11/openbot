# 研究：Windows 桌面版冷启动符合性

- 状态：已接受实现；仍需原生 Windows 验证
- 日期：2026-09-13
- 负责人：@yxflc11
- 相关议题：alpha.8 Windows 冷启动验收
- 验收旅程：在 Windows x64 完成首次本机初始化后，再进行十次彼此独立的 Electron 进程生命周期：每次启动已安装的本机 Server，证明新的进程身份，核对保留的 PostgreSQL 行与 DPAPI bootstrap 密文，完成 Owner 登录，然后正常退出，并确认上一轮子进程已结束。
- 安全边界：验证仅使用自建临时目录，从不读取交互用户真实的 Desktop 数据目录；不改产品运行时路径。失败时仍清理本轮 Electron/Server/PostgreSQL 子进程，并留下不含密钥的简短摘要。

## 检索证据

- 检索日期：2026-09-13
- 主要来源：Electron `v44.2.0` / `safeStorage`（Windows DPAPI）、既有 PowerShell `Start-Process` 安装门禁、PostgreSQL `postmaster.pid` / `pg_ctl`、以及 `windows-desktop-completion.md` 中的安装后冒烟回执约定。
- 既有复用账本与冒烟脚本仅在同一 Electron 进程内 stop/start 一次，不能作为跨进程冷启动证据。

## 候选对比

| 候选 | 结论 |
| --- | --- |
| 同一进程内控制器 stop/start ×10 | 拒绝作为冷启动证据；最多保留一次同进程重启以免削弱历史断言 |
| 安装门禁编排的十次独立 Electron 进程生命周期 | 采纳 |
| Playwright 驱动完整 UI | 本切片拒绝 |
| 新的进程监督依赖 | 拒绝（禁止新依赖） |

## 复用决定

在已固定的 Electron、Node、PowerShell、`NativeServerController`、`utilityProcess`、`safeStorage` 与 Windows PostgreSQL PID 契约上，只补 OpenBot 编排与断言缺口。不复制上游源码。

## 验证计划

- 可移植 Vitest 覆盖 harness 状态/PID/回执助手；完整十次冷启动仍以 Windows CI 为准。
- 不放宽既有 install/uninstall/encryption 断言；Linux 仅可跑助手单测，完整证据标记为 pending CI。

## 未决问题

- 本分支仍需托管 Windows CI 实际跑完十次冷启动。
