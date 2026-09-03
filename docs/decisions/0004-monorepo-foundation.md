# ADR-0004：基础阶段采用单一 monorepo

## 状态

Accepted

## 决策

基础阶段只维护一个 `openbot` 仓库，使用 npm workspaces 管理 Web、Server、Node、共享协议和 providers。上游项目默认作为依赖或研究来源，不预先创建 fork。

## 原因

- Server–Node 协议仍在快速变化，同仓原子提交更安全；
- 一个 CI 可以同时验证协议、策略、Server、Node 和 Web；
- 避免早期跨仓发布、版本矩阵和权限管理成本；
- monorepo 不妨碍 Server 与 Node 部署到不同机器。

## 未来拆分

当 Node 需要独立签名、发布节奏或贡献权限边界时，可以拆出 `openbot-node`。公开官网只有在拥有独立发布周期后才拆出 `openbot-site`。
