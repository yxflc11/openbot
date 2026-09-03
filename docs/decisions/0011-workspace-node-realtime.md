# ADR-0011：Workspace Node 实时投影

状态：Accepted

## 背景

Node 是工作区级资源，不属于单个频道。只在 `GET /workspace` 时读取会导致远程电脑上线、占满或断开后，其他设备必须刷新才能看到真实状态；把 Node 事件复制到每个频道 SSE 又会制造重复和不一致。

## 决策

- 保留频道 SSE，负责消息、Run、Progress 和 Artifact 投影。
- 新增鉴权的 `/api/v1/workspace/events`，只负责全局 Node 拓扑与容量。
- 订阅建立后先发送 `workspace.ready`，其中包含当前在线 Node 的权威快照；之后发送 `node.upserted` 和 `node.removed`。
- Node Registry 在连接、心跳、任务占用变化和断开时发布快照。Web 按 Node ID 与 `lastSeenAt` 合并，并以当前数组长度派生在线数量。
- 当前单 Server 使用进程内 hub；多副本部署前必须替换为共享事件总线。

## 结果

手机、笔记本和办公室界面无需刷新即可看到执行机变化，同时频道流仍保持局部、可理解。这个流只投影 Server 已认证的 Node 状态，不允许 Client 直连 Node，也不改变 Node 主动出站连接的安全边界。
