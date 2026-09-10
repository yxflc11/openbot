---
title: "开发第一个插件"
description: "开发第一个插件 — OpenBot"
---

仓库内提供真实 MCP 示例，包含读写工具、资源、提示词和交互视图。不需要外部账户，示例笔记保存在进程内存。

## 运行示例

在源码目录使用 Node 22.22.2、npm 10.9.9 安装锁定依赖：

```sh
npm ci
npx tsx apps/server/src/plugin-example.ts
```

启动 OpenBot Server 前，在**服务电脑**明确配置开发端点：

```dotenv
OPENBOT_PLUGIN_LOCAL_ENDPOINTS=http://127.0.0.1:4318/mcp
```

未明确配置的 localhost 会被拒绝。公开集成使用 HTTPS，并遵循公开地址与禁止重定向的策略。

打开插件管理，预览端点后安装。为一位 Bot 将 `sum_numbers` 设为只读、`append_note` 设为逐次确认；资源和提示词分别选择，再启用。让该 Bot 计算 13 加 29，然后要求添加一条测试笔记，审批准确参数。还可预览资源、填写提示词、打开交互视图。

## 实现自己的服务

使用所选语言的官方 SDK。把查询与写操作拆开，在服务端验证参数，凭据放在连接配置中，描述准确的副作用，返回有边界的结果。除了成功用例，还要测试拒绝、超时、撤销与重复调用。

参考 [示例源码](https://github.com/yxflc11/openbot/blob/main/apps/server/src/plugin-example.ts) 和 [MCP 文档](https://modelcontextprotocol.io/docs/getting-started/intro)。示例是开发服务，不是公开托管的在线端点。
