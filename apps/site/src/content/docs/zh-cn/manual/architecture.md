---
title: "项目如何组织"
description: "项目如何组织 — OpenBot"
---

OpenBot 是把应用与可复用包放在一起的 monorepo。桌面客户端展示工作区，Server 负责 Bot 身份、频道成员、任务路由、权限、审批和审计。PostgreSQL 保存权威记录，附件与成果文件通过元数据和校验值管理。

| 部分 | 职责 |
| --- | --- |
| `apps/web` | React 工作区、频道、Bot 档案、设置、插件和任务视图 |
| `apps/desktop` | Electron 外壳、系统凭据、受控下载、本地服务生命周期和打包 |
| `apps/server` | 认证 API、原生 Agent、协作、插件、附件与调度 |
| `packages/domain`、`packages/protocol` | 共享类型与边界验证 |
| `packages/db` | 数据库结构与有序迁移 |
| Worker Host 与 `providers` | 单独注册、有范围的执行能力，不成为第二套权限中心 |
| `apps/site` | 产品官网和双语使用手册 |

模型输出、网页、文件、插件和工作节点都作为不可信输入。具备能力不等于获得权限，Bot 即使受另一位 Bot 委派也使用自己的身份；需要审批的操作仍需明确批准。

扩展入口和验证命令见 [当前架构](https://github.com/yxflc11/openbot/blob/main/docs/ARCHITECTURE.zh-CN.md)、[仓库地图](https://github.com/yxflc11/openbot/blob/main/docs/REPOSITORY_MAP.zh-CN.md) 和 [工程审查](https://github.com/yxflc11/openbot/blob/main/docs/REPOSITORY_AUDIT.zh-CN.md)。办公室可视化仍是延期的可选插件，不属于本次协作运行核心。
