# 数据库运维

[English](DATABASE.md) · [简体中文](DATABASE.zh-CN.md)

OpenBot 把频道、员工、Run、审批、审计记录、Session 和 Artifact 元数据保存在 PostgreSQL；
Artifact 原始文件位于独立对象目录。可用的恢复集必须同时包含两者。

Migration `0015_employee_memory_lifecycle.sql` 为员工记忆增加乐观 revision 与无内容生命周期
审计。删除记忆会移除标题和正文所在记录，审计只保留员工 ID、记忆 ID、动作、revision、变化
字段、操作者和时间。备份仍包含其他未删除私人记忆，保护等级必须与凭据相同。

Migration `0017_request_throttle_buckets.sql` 增加短时、经摘要化的登录与 Node 登记滥用控制桶。
它只保存范围、域分隔客户端地址摘要、有界计数和时间，不保存原始 IP、密码、登记令牌或 Node 凭证。

## Migration 契约

- 不得修改已经应用的 migration；只能新增带序号的 SQL 文件和 journal 条目。
- `npm run migrations:check` 校验仓库 journal 和 SQL 文件集合。
- Server 启动时先取得 PostgreSQL advisory lock，确认数据库历史是仓库计划的精确前缀，再执行
  Drizzle migration，并验证最终历史完整。
- 哈希、时间戳、缺失条目或数据库超前都会阻止启动。不得手工修改 Drizzle 表来绕过检查。
- `npm run db:verify` 只允许运行在名称以 `_test` 结尾的数据库，并验证并发与重复启动。

重要数据出现漂移时，应对照已部署版本调查并恢复经过验证的备份。一次性本地数据库只有在确认
不再需要其中数据后才可重建。

## 备份边界

捕获完整恢复集前必须停止 Server 写入。PostgreSQL `pg_dump` 能提供一致数据库快照，但无法与
另一个卷中正在写入的 Artifact 文件自动协调。

1. 停止 OpenBot Server，但保持 PostgreSQL 运行。
2. 使用 `pg_dump --format=custom --no-owner --no-privileges` 创建 PostgreSQL 自定义格式归档。
3. 在 Server 仍停止时快照 `OPENBOT_OBJECT_STORE_PATH` 或对应 volume。
4. 在两个产物旁记录 OpenBot 版本、PostgreSQL 主版本、migration 数量、校验和与备份时间。
5. 加密恢复集并复制到 Server 主机之外，绝不能提交到 Git。
6. 重启 Server 并确认健康状态。

`pg_restore --list backup.dump` 只能证明 PostgreSQL 可以读取归档目录，不能证明备份可恢复，也
不能证明配套 Artifact 快照完整。

## 恢复演练

恢复演练必须使用隔离数据库和 Artifact 目录，不能使用线上目标。

1. 创建名称以 `_test` 结尾的空数据库。
2. 使用 `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges` 恢复。
3. 让非生产 OpenBot 构建连接恢复后的数据库和隔离 Artifact 副本。
4. 运行 `npm run db:verify`，并抽查频道、员工、Run、审批、审计记录和 Artifact 下载。
5. 记录耗时和结果，再删除隔离环境。

生产恢复应先写入全新的空数据库和对象目录，验证后再切换部署，不能覆盖正在运行的 OpenBot
数据库。

## 当前限制

- OpenBot 尚不会定时创建、加密、上传、保留或清理备份。
- 尚无时间点恢复或 WAL 归档流程。
- 本地对象存储与 PostgreSQL 之间还没有事务级快照协议。
- 备份凭证和存储 Provider 不属于员工包或工作主机。

这些仍是 M6 工作。相关贡献必须先做上游审查，并证明数据库与 Artifact 能完整恢复，不能只证明
归档创建成功。
