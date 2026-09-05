# Desktop 首次设置

[English](DESKTOP_ONBOARDING.md)

macOS 源码构建预览提供两种用途：

- **服务电脑：** Desktop 初始化自己的 PostgreSQL 17 数据库、启动随包提供的 Server、创建
  私有 Owner 身份、自动连接，然后进入模型设置。无需 Docker、Homebrew、管理员账户或首次启动下载。
- **远程客户端：** 验证并保存已有 HTTPS Server 地址，再登录对应的 Owner 账户。
  不初始化或启动本地数据库和 Server。

macOS 原生红黄绿按钮融入内容区域，应用内外共用同一个图标。设置包含模型、连接、工作电脑管理
和用途选择；侧栏可以按需展开运行状态。

## 当前边界

这是源码构建预览，尚不是签名、公证后的公开安装包。本机安装已在 macOS arm64 实测。
x64 依赖已锁定但尚未在 Intel 实测；Windows 和 Linux 保留远程客户端能力，本次未提供原生安装器。

内置 Server **目前仅供这台 Mac 使用**。让另一台电脑访问这个原生安装实例，仍需实现经过认证的
HTTPS 接入配置。不能把本机回环地址填到另一台电脑。当前远程使用应连接已有的 HTTPS 部署，
高级部署见下文。关闭 macOS 窗口会保留后台 Desktop；退出应用会停止它自己的 Server 和数据库。
重新打开会使用原有数据。这不等同于登录启动服务、备份、数据库升级或无人值守恢复。

数据保存在 Desktop 用户数据目录的 `openbot/local-server`。macOS safeStorage 加密引导秘密，
数据库使用随机私有凭据和 SCRAM；模型密钥由 Server 使用 AES-256-GCM 加密。模型摘要接口不返回密钥。
资源缺失、钥匙串不可用、数据路径不安全或数据库版本不兼容时会明确失败；重试不会删除已有数据库。
切换为远程客户端会停止本机服务并保留数据，切回后复用数据。

## 模型接口

本机安装后选择 OpenAI 或 Anthropic，输入账户可用的模型 ID 和 API Key。验证只向所选服务的官方
HTTPS 接口查询模型元数据，不调用生成、不上传对话。以后可在设置中替换密钥；过期版本或并发保存
会被拒绝，避免覆盖更新。可以暂时跳过，在设置或下次启动时配置。初版不提供自定义代理地址。

本次实现保存并验证工作空间默认配置，**没有新增 Agent 模型推理循环**，也不会使未实现的 Provider
自动获得执行能力。现有任务执行能力保持原有边界。旧版远程 Server 不支持此设置接口。

## 构建与高级自部署

在仓库根目录安装锁定依赖并运行 `npm run check`，然后在 macOS 执行
`npm run package --workspace @openbot/desktop`。打包会将编译后的 Server、生产依赖、PostgreSQL
和许可通知放入 `native-runtime`，再组装应用。生成目录不会进入 Git。
本地开发启动前也需先运行 `npm run prepare:native --workspace @openbot/desktop`，再执行
`npm start --workspace @openbot/desktop`。首次启动不下载可执行代码。

高级用户可按[根目录源码部署说明](../README.zh-CN.md)分别部署 Server、PostgreSQL、Web 和 Worker。
这些选项放在 GitHub 文档中，不进入 Desktop 首次用途选择。远程使用需配置受信任的 HTTPS 反向代理；
数据库凭据和 Owner 认证留在服务端。

单独部署的 Server 如需模型设置，必须同时设置 `OPENBOT_MODEL_SETTINGS_PATH`（私有持久目录中的
绝对路径）和 `OPENBOT_MODEL_ENCRYPTION_KEY`（32 个随机字节对应的 64 位小写十六进制文本）。
加密主密钥应保存在独立秘密管理工具中；丢失后无法解密原有 API Key。两项均不设置则禁用此接口。
每个配置文件只允许一个 Server 写入。Owner 专用的 `GET`/`POST /api/v1/settings/model` 沿用来源检查；
POST 接收 `provider`、`model`、`apiKey` 和最新 `revision`（首次为 null）。

原生 PostgreSQL 包固定为 `17.10.0-beta.17`。公开发行前仍需审查预发布打包依赖、上游二进制来源、
分发许可、签名和公证；本机功能测试不能替代发行支持证据。
