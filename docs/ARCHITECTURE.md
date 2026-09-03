# 系统架构

## 1. 核心判断

OpenBot 必须拆成 **Server、Node、Client** 三部分：

- Server 保存系统真相并作出所有授权决定；
- Node 提供可以替换的计算机能力；
- Client 只通过 Server 查看和控制。

这使 Mac Mini 从“整套系统”变成“可选 macOS Node”。

```mermaid
flowchart LR
    subgraph Client["Clients"]
      PWA["Responsive Web / PWA"]
    end

    subgraph Server["OpenBot Server"]
      APP["Local channels & Bot UI"]
      RT["Local threads · memory · realtime"]
      AG["Agent Gateway"]
      PG["Policy · approval · audit"]
      NR["Node registry · router · scheduler"]
      DB[(PostgreSQL)]
    end

    subgraph NodeA["Linux Node"]
      ND1[Node daemon]
      DK[Docker browser / shell]
    end

    subgraph NodeB["Apple Node"]
      ND2[Node daemon]
      CUA[Cua Driver]
      LUME[Lume VM]
    end

    PWA -->|HTTPS| APP
    APP --> RT --> AG --> PG --> NR
    APP & RT & PG & NR <--> DB
    ND1 -->|Outbound WSS/mTLS| NR
    ND2 -->|Outbound WSS/mTLS| NR
    ND1 --> DK
    ND2 --> CUA & LUME
```

## 2. 产品底座

以 [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot) 作为 fork/上游基线候选，保留其：

- React/Vite 频道与 Bot UI；
- Hono server、认证和角色；
- PostgreSQL 数据模型；
- per-Bot computer、live screen 和 takeover UX；
- CEL action policy 与 fail-closed decision；
- audit、credential vault、MCP grants；
- routine worker 和结构化 Bot handoff。

必须替换或重构：

- CopilotKit Intelligence → `local-threads`；
- 单机 computer supervisor → Node Registry + provider protocol；
- 仅容器浏览器 → Docker / Cua / Lume provider；
- 桌面优先 UI → 移动端可用的 PWA；
- API-key/AG-UI Agent → 可选 Codex/Claude/Grok CLI adapter。

## 3. Server 组件

### Local Channels

频道是本项目自己的实体，不是 Telegram/飞书映射：

- 一个频道绑定一个或多个 Bot roster；
- 所有设备看到同一 thread/run/approval；
- channel membership 在 Server 校验；
- 消息、附件和组件都使用本地 object/storage contract；
- PWA 可安装到主屏幕，但仍是同一 Web 应用。

### Local Threads & Realtime

替代 CopilotKit Intelligence，至少提供：

- thread/message/event 持久化；
- AG-UI event stream；
- WebSocket/SSE 多设备同步；
- Bot memory 的可插拔存储；
- reconnect cursor 与幂等写入；
- 不依赖云 license 的完整启动模式。

### Node Registry

记录 Node 的：

- node id、owner 和吊销状态；
- OS、架构、版本；
- capabilities 与 provider versions；
- 当前负载、健康状态和最后心跳；
- 可执行的 policy profiles；
- 屏幕/输入 transport 能力。

### Deterministic Router

路由由 Server 决定：

```text
agent policy ∩ task requirements ∩ online node capabilities
  -> exact node + provider + execution profile
```

模型可以描述任务需求，但不能选择未授权节点或扩大 profile。

### Action Gateway

延续 CopilotKit/OpenBot 的“决定和审计先于执行”，再增加跨 Node 的 capability lease：

- `run_id`、agent、node、provider；
- action class 和结构化目标；
- policy id/version 与 decision；
- approval id、目标指纹、max uses、TTL；
- 执行结果、产物和 redaction。

## 4. Node 协议

Node 主动向 Server 建立长连接，避免远程机器开放管理端口。

### 控制消息

- `node.hello` / `node.heartbeat` / `node.capabilities_changed`
- `run.offer` / `run.accept` / `run.reject`
- `run.cancel` / `run.status` / `run.result`
- `approval.lease` / `approval.revoke`
- `control.acquire` / `control.release`

### 数据消息

- 屏幕关键帧与增量帧；
- tool observations；
- 日志和结构化错误；
- 小产物直传；
- 大产物使用 Server 签发的短时上传 URL。

### 身份

- Node 首次使用一次性 enrollment token；
- 注册后换取独立证书/密钥；
- Server 可单独吊销一个 Node；
- Node 凭证不能登录 Web，也不能访问其他 Node；
- 所有消息绑定 connection、node、run 和 sequence。

## 5. Provider contract

每个 Node provider 实现同一最小接口：

```text
describe capabilities
prepare / start / stop / destroy
observe / act
execute command
list / read / write artifact
open / close human-control session
health / version
```

| Provider | 运行位置 | 用途 |
| --- | --- | --- |
| Docker | Linux/macOS Node | 隔离浏览器、Shell、文件 |
| Cua | macOS Node | 宿主机原生 App，默认观察优先 |
| Lume | Apple Silicon Node | 隔离 macOS GUI |
| Coder | 任意合格 Node | Codex/Claude/Multica 工作区 |

## 6. 远程屏幕与接管

Client 不直连 Node：

1. Client 向 Server 请求查看指定 run/computer。
2. Server 校验用户、频道、Bot 和 run 关系。
3. Server 创建短时 view token。
4. Node 经既有长连接或受控 WebRTC relay 回传屏幕。
5. 接管需要单独 control lease；同一电脑同时只有一个输入 owner。
6. 人接管期间 Agent action fail closed，而不是排队。

默认走 Tailscale 私网可减少公网暴露；未来公网部署仍必须 TLS、强认证、速率限制和审计。

## 7. 数据与存储

跨 Node 后不再使用 SQLite 作为系统主库，采用 PostgreSQL：

- channel/thread/message/event；
- agent/profile/grant；
- node/capability/lease；
- run/task/handoff；
- policy/decision/approval/audit；
- routine/work queue；
- credential references。

截图和大产物进入本地 S3-compatible object store 或文件存储，数据库只保存引用、大小、哈希和 redaction metadata。

## 8. 部署形态

### 单机入门

```text
一台 Linux/Mac：Server + PostgreSQL + Node + Docker
```

### 家庭常驻

```text
Linux/NAS Server：控制面 + Docker Node
Mac Mini：Cua/Lume Node
手机/笔记本：Tailscale + PWA
```

### 云控制面

```text
云服务器：Server + PostgreSQL
家中 Mac：出站连接的 macOS Node
其他服务器：按需注册 Linux/Coder Node
```

## 9. 技术栈

- 延续上游的 TypeScript、React/Vite、Hono、Bun/Node 和 PostgreSQL。
- AG-UI 作为 Agent ↔ Server 事件协议。
- 自定义版本化协议处理 Server ↔ Node。
- WebSocket 用于控制与实时状态；WebRTC/WS relay 用于屏幕。
- Cua 通过 MCP/SDK provider 接入。
- Docker Compose 负责入门部署；Linux systemd、macOS launchd 负责 Node daemon。

## 10. 上游策略

- 先做隔离 spike，不立即复制或重写全仓。
- 确认 Intelligence 替换 seam、Apple Silicon 构建和 Node provider 改造量。
- 若可行，建立正式 fork 并保留 CopilotKit MIT notice。
- 通用修复尽量回 upstream；本地化、Node 和 Cua 差集留在本项目。
- OpenClaw 只作为可选 Agent adapter，不再承担频道、线程或审批状态。

