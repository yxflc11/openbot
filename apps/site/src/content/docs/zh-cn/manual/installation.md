---
title: "安装 OpenBot"
description: "安装 OpenBot — OpenBot"
---

OpenBot 桌面版可以在本机运行私人工作区，也可以连接已有的 OpenBot 服务电脑。本次新增适配以 Windows x64 为目标。模型需要单独配置；安装软件不会自动开始付费推理。

## Windows 安装

1. 打开 [GitHub 发布页](https://github.com/yxflc11/openbot/releases)，选择当前版本的 Windows x64 `.exe`，核对文件名和发布页 `SHA256SUMS` 中的校验值。
2. 运行安装器，从开始菜单打开 OpenBot。桌面本地模式按当前用户安装，不需要管理员权限。
3. 首次选择“作为服务电脑”，将数据库和服务放在本机；已有服务时选择“连接服务电脑”。
4. OpenBot 首次准备内置 PostgreSQL 和本地服务，无需安装 Docker 或 Node.js。
5. 进入设置，选择模型提供方，保存 API 密钥和模型，明确启用 Agent。然后创建 Bot 和频道。

未签名预览包可能触发 Windows 系统信任提示，软件不会绕过系统策略。此安装器不包含 Windows ARM64，也不会自动授权工作电脑控制。

## 再次打开

日常启动复用已有安装、加密身份、模型设置和数据库，仅显示简短连接状态。首次安装的检查清单不会反复出现。升级时保留原用户目录；手动备份数据库前先退出 OpenBot。卸载应用不等于删除工作区数据。

也可连接独立部署的 Server。插件中的 localhost 始终指服务电脑，不一定是当前客户端。详细平台证据见 [Windows 说明](https://github.com/yxflc11/openbot/blob/main/docs/WINDOWS_DESKTOP.zh-CN.md)。
