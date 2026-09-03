# ADR-0009：两阶段 Node 任务分配

- 状态：Accepted
- 日期：2026-09-03

## 背景

持久化的 `queued` Run 需要被远程 Node 领取，但数据库不能假设某个 WebSocket 节点仍在线，也不能在等待网络响应时长期持锁。若先写入节点再询问，离线或满载节点会留下虚假分配；若只相信 Node 的 accept，多个 Server 调度器又可能同时把同一 Run 交给不同节点。

## 决策

Server 使用两阶段握手：

1. 根据 Run 创建时固化的 `executionProfile`，确定所需 capability 与平台；
2. 在在线且未达 `maxConcurrentRuns` 的兼容节点中，选择负载最低、node id 稳定排序最前的节点；
3. 发送 `run.offer`，Node 只校验身份、capability 与本地容量，并回复 `run.accept` 或 `run.reject`；
4. accept 后，Server 在短 PostgreSQL 事务中条件更新仍为 `queued`、仍无 `node_id` 的 Run，并写入 `RUN_ASSIGNED`；
5. 只有数据库认领成功，Server 才发送 `run.assigned` confirm，Node 此时才占用本地槽位；认领失败则发送 `run.cancel`。

Node 断线时，Server 把该节点尚未执行的 `assigned` Run 回到 `queued` 并写入 `RUN_REQUEUED`。Server 启动时同样回收所有 `assigned` Run，因为进程重启后旧的内存确认已经丢失。队列使用只覆盖可分配 Run 的部分索引，按 `created_at, id` 稳定读取。

## 不变量

- Client、模型和 Node 都不能更换 Run 的 execution profile 或指定越权节点；
- 网络 offer 不发生在数据库事务内；
- 一个 Run 只有一次条件认领能成功；
- `run.accept` 不是执行授权，`run.assigned` 也暂不代表 provider 已启动；
- 并发容量由 Node 声明、Server 路由与 Node 本地接受检查共同约束。

## 结果

- 离线、能力不符或满载节点不会得到确认；
- 节点断线与 Server 重启后的未执行任务可以安全回队；
- Web 通过 `run.updated` SSE 投影 `assigned` 与回队状态，并显示节点槽位；
- 后续 provider 执行可以在 confirm 之后增加独立的启动、租约与幂等边界。

## 当前限制

本切片没有启动 Docker/Cua/Lume/Coder provider，因此没有日志、截图、产物或外部副作用。Node 仍使用部署级共享启动令牌；独立 enrollment、证书、吊销、执行租约与全局 Node realtime 将在后续切片完成。
