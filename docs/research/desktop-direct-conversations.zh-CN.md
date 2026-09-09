# 调研：Server 管理的 Bot 单独对话

- 状态：已采纳，进入实现
- 日期：2026-09-09
- 负责人：@yxflc11
- 验收流程：反复或同时点击同一个 Bot，打开相同的持久对话；消息始终分配给该 Bot 的真实标识。
- 安全边界：沿用 Owner 身份验证与可信 Origin 检查。Server 设置 `directBotId`、创建固定成员关系并拒绝修改；名称和描述不承担授权作用。

## 检索证据

GitHub 检索词：`drizzle-team drizzle-orm 0.45.2 onConflictDoNothing`。官方文档检索词：`site.postgresql.org docs 17 INSERT ON CONFLICT unique index row lock`。已检查既有 Channel、成员、消息和 Run 存储，以及复用清单中的 PostgreSQL 迁移完整性与频道侧栏条目。

[PostgreSQL 17 INSERT](https://www.postgresql.org/docs/17/sql-insert.html) 与[行锁](https://www.postgresql.org/docs/17/explicit-locking.html)明确唯一约束和并发事务行为。[Drizzle 发布记录](https://github.com/drizzle-team/drizzle-orm/releases)及问题 [#2474](https://github.com/drizzle-team/drizzle-orm/issues/2474)说明 `DO NOTHING RETURNING` 不会返回现存行，不能将空返回误判为实体不存在。

## 候选与复用决定

使用项目已锁定的 PostgreSQL 17（`ec3f6a6a7dd82a8ce455a0710ef75172f9f318d1`）、Drizzle ORM 0.45.2（`e7dfa14519f363229ccc3ead7b1b2f2051937efb`）和 Postgres.js 3.4.9。许可证分别为 PostgreSQL License、Apache-2.0 和 Unlicense。项目已有真实数据库迁移及并发测试；本次采用标准数据库约束与薄适配，无新依赖，也未复制或实质改编上游源码。

唯一的项目专用缺口是将一个 Bot 标识映射到一个固定成员 Channel。创建前锁定 Bot 行，实现跨进程串行创建；数据库唯一索引补充保护。普通频道名称仍保持唯一，与单独对话名称独立。Bot 不存在、试图修改成员或选择其他 Bot 时均拒绝。现有技术栈已经可行，无需引入外部消息服务而重复身份、路由及审计权限。

## 验证

覆盖身份验证与 Origin 拒绝、重复打开、固定成员、精确标识路由，以及专用临时 PostgreSQL 中的并发创建、审计去重、跨实例持久性、同名普通频道和 Bot 重命名。交付前运行项目检查。这些证据仅覆盖 Server 行为；平台构建和界面验收由桌面主任务单独完成。

## 已验证证据

Server、领域与数据库包构建通过。41 项 Server API 测试及 3 项迁移历史单元测试通过。专用 PostgreSQL 集成测试在隔离的本地临时数据库通过：两个数据库客户端并发打开 12 次，只返回一个频道及一份创建审计；持久性、固定成员、路由、重命名稳定性与普通频道名称唯一性均通过。
