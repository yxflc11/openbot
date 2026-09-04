# 技术基线

[English](TECHNOLOGY.md) · [简体中文](TECHNOLOGY.zh-CN.md)

审查日期为 2026-09-04。精确版本是本次审查快照；升级必须通过单独、经过测试的依赖变更，不能
静默浮动。

## 一句话决定

OpenBot 使用 TypeScript 编写共享产品代码，以 Electron 提供可安装 Desktop 客户端，以 React 和
Vite 共享界面，以 Node.js 运行 Server 和可移植 Worker 逻辑，以 PostgreSQL 保存权威状态，并且
只在操作系统确实需要时使用很薄的 Swift 或 C# 适配器。

## 产品入口

| 入口 | 用户安装或打开的内容 | 角色 |
| --- | --- | --- |
| OpenBot Desktop | 在 Windows、macOS 或 Linux 上安装各平台对应的软件包，但使用同一个 OpenBot 产品 | 始终是 Client；也可以把这台电脑配置成 Server、Worker Host 或同时承担两者 |
| OpenBot Web | Server 托管的响应式 Web 应用 | 完整的远程 Client，也是没有安装 Desktop 的模块化自部署用户的主要 Client |
| OpenBot Server | 由 Desktop 引导安装，或由用户独立部署的服务 | 身份、频道、路由、策略、审批、审计和持久状态的唯一权威 |
| OpenBot Worker Host | 由 Desktop 引导安装，或由用户独立部署的服务 | 向 Server 提供已经声明的电脑能力；永远不会成为第二个权威 |
| Agent 适配器 | 由 Server 管理的 OpenBot、Hermes、Pi、OpenClaw 或未来 Agent 连接 | 执行有界委派任务；不能自行取得频道、电脑、凭证或审批 |
| 插件 | 未来通过能力范围明确的插件系统安装并审核的软件包 | 可以扩展 UI、主题、频道、Agent、工具、Provider 和自动化，但不能绕过 Server 策略 |

Desktop 首次引导提供同一产品的四种组合：

1. **使用 OpenBot：**仅安装 Client，并连接已有 Server。
2. **使用并工作：**在这台电脑上同时启用 Client 和 Worker Host。
3. **托管 OpenBot：**在这台电脑上启用 Client 和 Server，Worker Host 可选。
4. **高级自部署：**独立安装 Server 与 Worker 服务，再使用 Web 或 Desktop。

“我会再添加五台电脑”只会生成五台设备的配置清单。它不是授权数量限制，也不会安装不同的
应用。每台 Worker 电脑仍然可以作为用户正常使用 OpenBot 的 Client。

目前实现的 Desktop 引导已经能把四种组合保存为严格的本地安装计划，生成可见清单，支持规划最多
100 台 Worker 电脑，并在重启后恢复。这个数字只是界面的安全上限，不是授权限制。下一屏会接收一个
已有 Server origin，验证 `/health`、显示原生确认、只保存这个公开 origin，然后打开共享的登录和
频道界面。远程 Server 必须使用 HTTPS；本机开发可以使用 HTTP。更换 Server 会清除 Desktop 的
独立浏览器 Session。保存计划绝不会安装、登记、连接、授权 Server 或 Worker Host，也不证明平台
支持；这些真实操作仍属于下一段引导切片。

## 选择的语言与运行时

| 边界 | 选择 | 原因 |
| --- | --- | --- |
| 共享领域、协议、Server、Worker、适配器和工具 | TypeScript `7.0.2` | 一个有类型的语言已经覆盖仓库主体，也是后来者最容易参与的路径。 |
| 独立开发运行时 | Node.js `24.20.0` LTS | 这是 2026-09-04 审查时的当前 LTS；Current 版本不作为生产默认值。 |
| Desktop 外壳 | Electron `44.2.0` | 可以复用现有 Web 技术栈，并在不同桌面系统上交付同一套经过测试的 Chromium/Node 基线。 |
| Desktop 打包与加固 | `@electron/packager` `20.3.0` 与 `@electron/fuses` `2.1.3` | 这两个当前稳定 Electron 软件包提供 OpenBot 所需的窄打包/ASAR 和严格 fuse API，同时避开 Forge 7 不兼容且含已知漏洞的开发依赖图。安装器、签名和发布仍使用后续单独审查的发布适配器。 |
| Desktop Server 传输与配置 | Electron `44.2.0` 自定义协议、专用 `Session.fetch`、类型化 IPC、`write-file-atomic` `8.0.0`，以及只在构建时验证清单的 `@electron/asar` `4.3.0` | 安装包 renderer 保持同源；main process 只连接一个已经验证并确认的 Server。归档只携带经过审查的精确运行时依赖闭包。 |
| Desktop 安装计划 | React `19.2.8` 原生表单控件、类型化 Electron IPC 与现有受限 `write-file-atomic` 存储 | 四种角色组合与 Worker 清单只需要一个可辨识计划，不需要新增表单或状态机依赖。main process 验证并保存公开意图；renderer 不能把它变成服务权限。 |
| 共享 UI | React `19.2.8` 与 Vite `8.2.2` | 这些精确版本已经在当前仓库中锁定、构建并通过测试。 |
| Server HTTP 运行时 | Node.js 上的 Hono | 当前 Server、安全中间件、SSE 和停机流程已经使用并测试这个边界。 |
| 权威数据 | PostgreSQL 17 | 已有 migration、条件状态变更、调度、审批和审计需要唯一事务真相源。 |
| macOS 专属服务接入 | Swift | 只用于 Keychain、Service Management、与签名绑定的注册和其他 Apple 专属契约。 |
| Windows 专属服务接入 | .NET 上的 C# | 只用于 SCM、Credential Manager、Job Object、安装器接入和其他 Windows 专属契约。 |
| 外部 Agent 内部实现 | 保留上游语言 | Hermes 可以继续使用 Python，其他 Agent 也可以使用 Rust、Go 或 TypeScript；OpenBot 通过有类型的进程或网络适配器接入。 |

Python、Rust 和 Go 都不是 OpenBot 核心语言。只有调研证明某个持续维护的上游方案比现有技术栈
更好地解决了明确缺口，未来依赖才能引入其中一种语言。

已经生成来源证明的 Worker Host 发布运行时继续使用 Node.js `22.22.2`。只有单独的发布迁移重新
生成哈希、SBOM、声明、安装包、一致性证据和回滚数据后，才能升级它。为新开发选择 Node.js 24
不会静默改写已有发布证据。

## Desktop 安全契约

Desktop 是受信任的本地 Client，不是新的权威：

- 它只加载安装包内的 renderer 资源，不从 Server 加载可执行 UI 代码；
- 所有 renderer 都启用 `nodeIntegration: false`、`contextIsolation: true` 和 `sandbox: true`；
- preload 只暴露小型、有类型的操作，不暴露原始 `ipcRenderer`、文件系统、Shell、进程、环境变量
  或不受限制的网络能力；
- main process 会检查每个 IPC 请求的发送者、schema、大小、状态和权限；
- 导航、新窗口、权限、下载和打开外部 URL 默认拒绝；
- 严格的 Content Security Policy 让 renderer 只能连接安装包应用 origin；main process 另行强制
  执行唯一已经声明的 Server 连接；
- 即使 Desktop 启动了本地 Server、Worker Host、外部 Agent 或插件进程，它们的动作仍然必须通过
  Server 策略和审批；
- 密钥只保存在平台密钥库或独立服务边界，不进入 renderer 状态或浏览器 local storage；
- 发布打包会关闭未使用的 Electron fuse、校验 ASAR 完整性，并在签名后发布；
- 未签名的本地构建只能作为开发证据，不能称为可分发版本。

Agent 使用的不可信网页运行在 Worker Provider 边界内，绝不会放进有权限的 OpenBot Desktop
窗口中渲染。

## “当下最好用”的判断方式

“最好”指满足 OpenBot 兼容性、安全性、维护状态、贡献者体验和证据要求的最新稳定版或 LTS，
不代表自动使用预发布版本，也不代表软件包发布当天就无测试升级。

- 至少每月一次，并在每次 Desktop 发布前检查 Node.js LTS 与仍受支持的 Electron 主版本。
- Electron 受支持版本的安全补丁走加速但仍经过测试的 Pull Request。
- 当前 Electron 主版本成为最老受支持版本前，必须完成下一主版本审查。
- lockfile 中的依赖保持精确；发布构建不能解析浮动版本。
- 每次运行时变更后重新执行打包、IPC 负向、更新、回滚和真实设备检查。
- 只有安装包大小、内存、无障碍、安全维护或平台行为经过测量仍无法达到已接受要求时，才重新
  比较 Desktop 外壳。

## 对贡献者的影响

大部分贡献者只需要 `.nvmrc` 固定的 Node.js LTS 与 npm。Desktop 贡献者还需要对应平台的打包工具链。
Swift 只用于 macOS 适配器，.NET 只用于 Windows 适配器。开发外部 Agent 适配器不要求贡献者把
Agent 重写成 TypeScript。

长期决定与候选证据见 [ADR-0041](decisions/0041-desktop-application-foundation.md)和
[Desktop 基础调研](research/desktop-application-foundation.md)。已经实现的 Server 连接边界见
[ADR-0042](decisions/0042-desktop-server-connection.md)及其
[调研证据](research/desktop-server-connection.md)。四模式安装意图及其无副作用边界见
[ADR-0043](decisions/0043-desktop-setup-intent.md)和
[安装计划调研](research/desktop-setup-plan.md)。
