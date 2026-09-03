# ADR-0005：PostgreSQL 是本地控制面的系统真相源

## 状态

Accepted — 2026-09-03

## 决策

OpenBot Server 启动时自动运行仓库内已提交的 migration。频道、Bot、频道成员、消息、事件、Run、审批和产物元数据全部以 PostgreSQL 为系统真相源；Web 只读取 Server 投影，Node 不保存业务真相。

频道创建和初始 Bot roster 必须使用同一事务，并同步记录结构化事件。外键列必须建立与读取方式匹配的索引；频道消息和事件使用 `(channel_id, created_at)` 复合索引。

## 原因

这一边界让 Server 可以从 Mac Mini 移到任意 Linux/云服务器，也让执行节点可以被替换而不迁移频道历史。事务与数据库约束比依赖模型或前端自觉更可靠，也为后续 realtime、审计和重放提供稳定事件源。

## 后果

- M0 开发环境启动前需要 PostgreSQL；
- migration 一旦合入不再改写，只追加新文件；
- Node 的在线状态在 M1 完成 durable enrollment 前仍是进程内投影；
- 登录和 session middleware 完成前，API 只能部署在可信私网。
