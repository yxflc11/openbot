# Windows 桌面版

Windows x64 桌面版可以在本机运行 OpenBot Server 与 PostgreSQL，也可以连接已有 Server。本机进程属于当前用户的桌面会话；安装应用不会自动注册 Worker Host，也不会授予电脑控制权限。

## 安装与启动

使用带版本号的 `openbot-desktop-<版本>-win32-x64.exe`，并与该版本 `SHA256SUMS` 核对 SHA-256。NSIS 安装器按当前用户安装，不申请管理员权限，创建开始菜单快捷方式，卸载时保留应用数据。开发安装器尚未签名，保留 Windows 信任提示；OpenBot 不绕过 SmartScreen、系统策略或杀毒软件。

打开 OpenBot，选择将这台电脑作为 Server。应用会初始化私有 PostgreSQL 17 数据库，在回环地址启动随包携带的 Server，迁移数据库结构并登录本机 Owner。让 Bot 工作之前，先在设置中配置模型。本机模式无需 Docker、PowerShell 安装脚本、单独安装 Node.js，也不开放公网监听端口。

下载安装包后，安装本身不需要网络。远程模型和外部工具可能需要联网。数据库可执行文件已包含在安装包中，首次使用不会再下载数据库程序。

## 数据与退出

数据位于 Electron 当前用户应用数据目录下的 `openbot/local-server`，包含数据库、上传对象、模型设置与加密的初始化身份。Electron `safeStorage` 使用 Windows DPAPI 加密初始化身份。数据目录设置仅当前用户可访问、可继承的 NTFS DACL；已有目录出现意外授权时会拒绝使用，不自动修复。DPAPI 的边界是用户登录身份，不能阻止同一身份下的恶意软件。

正常退出先通过私有父进程通道通知 Server 关闭，再调用支持 Windows 的 `pg_ctl stop` 停止数据库。重新打开后复用原有身份与数据。手工备份前应退出 OpenBot 并确认数据库进程已经停止；数据库和加密初始化文件需要一起保留。将数据复制到另一登录身份不是已支持的迁移方式，PostgreSQL 大版本升级也需要明确迁移。

## 验证与限制

Windows CI 会构建 NSIS 安装器，在唯一临时目录中完成安装，核对安装后的 ASAR 哈希，通过 Electron 对**安装后的运行时**验证 DPAPI、真实数据库、结构迁移、Owner 登录、退出、数据保留与重启，最后卸载。单独的 Windows 测试检查真实 NTFS 权限。应查看对应源码提交的实际 CI 结果；写好工作流不等于工作流已经通过。

本次开发主机是 macOS，本地可移植测试已通过，Windows 原生执行仍需对应 Windows CI 验证。验证脚本复用实际控制器与安装后的运行时，但没有操作安装后应用的窗口。Windows 桌面界面、SmartScreen、代码签名、无障碍与真实电脑控制仍需分别验收。当前安装包只针对 Windows x64，不支持 Windows ARM64。

Windows Worker Host 服务是单独审查的组件，桌面版安装不能证明其 SCM 安装、服务身份和真机验收已完成。发布前需核对实际 CI 的来源清单、随包许可证与代码签名结果，详见[研究记录](research/windows-desktop-completion.md)。本阶段未增加 macOS 或 Linux 适配。

Windows PostgreSQL 改为从固定的官方 17.11 源码使用 Meson/MSVC 构建，关闭非必需依赖并静态链接 MSVC runtime。打包必须提供源码构建清单，并校验每个文件；不再接受原 npm 二进制包。实际发布依据仍是该提交的 Windows CI、产物来源与签名证据。
