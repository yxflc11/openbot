# 产品定义

## 1. 一句话

OpenBot 是一个完全自托管的数字员工服务器：它提供自己的频道和远程控制界面，并把工作派给可替换的 Linux、macOS 或代码执行节点。

## 2. 用户体验

- 用户在手机、平板或笔记本浏览器打开自己的 OpenBot PWA。
- 频道、聊天记录、记忆、审批和审计保存在自己的 Server。
- Bot 在后台选择已经声明并在线的 Node 工作。
- 用户可以看屏幕、暂停、批准、拒绝或接管。
- 更换 Mac Mini、迁移 Linux 服务器或增加新 Node，不会丢失频道和 Bot 身份。
- 桌面端默认使用 Marvis 式办公室总览，并保留 Grok Bot 式长期频道与自由新增 Bot；手机端重排为员工卡、单栏频道和底部抽屉。
- 进度、团队、审批、电脑和产物均由结构化 run events 渲染，而不是从聊天文本推断。

## 3. 部署角色

### OpenBot Server

系统的唯一真相源，负责：

- 用户、频道、Bot、线程和记忆；
- Agent runtime 与任务生命周期；
- 节点注册、能力发现和确定性路由；
- 策略、审批、凭证和审计；
- routine、重试、熔断和通知；
- 面向所有设备的 Web/PWA。

Server 可以部署在 Mac Mini、普通 Linux 主机、NAS 虚拟机或云服务器。

### OpenBot Node

可以被替换的执行机，负责：

- 主动连接 Server 并维持心跳；
- 宣告 `docker`、`browser`、`cua`、`lume`、`coder` 等能力；
- 只领取匹配自己 capability 和 policy 的任务；
- 回传状态、屏幕、产物和工具结果；
- 执行短时人工接管租约。

节点不负责频道、审批真相、长期记忆或 Bot 身份。

## 4. 最小角色

| Bot | 责任 | 可用节点 |
| --- | --- | --- |
| `chief` | 拆解、路由、汇总、升级问题 | 无电脑 |
| `ops` | 浏览器、文档和桌面任务 | Linux Docker；必要时 macOS Cua/Lume |
| `coder` | 仓库和代码任务 | 隔离 coder Node；后加 Multica |

## 5. 北极星验收

### 场景 A：节点可替换

1. 用户从手机 PWA 给 `Ops` 下达测试页填表任务。
2. Server 选择在线 Linux Node。
3. Node 完成填写但不提交，回传截图。
4. 用户在同一频道看到结果。
5. 原 Node 下线后，新 Node 注册并完成下一次相同任务。

### 场景 B：远程审批与接管

1. `Ops` 请求提交表单。
2. Server 在副作用发生前创建审批。
3. 用户从另一设备查看目标、动作、风险和画面。
4. 一次批准只允许对应动作；上下文变化立即失效。
5. 用户也可以取得独占接管租约；接管期间 Agent 输入全部拒绝。

### 场景 C：macOS 专属任务

1. `Ops` 收到必须操作 macOS 原生 App 的任务。
2. Server 只能在带 `cua` 或 `lume` capability 的 Apple Node 中选择。
3. 没有合格节点时明确等待，不偷偷降级到宿主 Shell 或普通 Linux。

## 6. V1 必须有

- 完全本地的 Web/PWA 频道，不依赖 Telegram/飞书。
- 本地 PostgreSQL 保存线程、记忆、策略、审批和审计。
- 不连接 CopilotKit Intelligence 时也能完整启动和工作。
- 一个 Server、一台 Linux Node、`chief` 和 `ops`。
- 节点主动出站连接、心跳、断线、重连和撤销。
- 浏览器任务、实时截图和远程审批。
- 所有事件统一关联 `run_id`。
- Tailscale 私网访问作为默认部署方式。

## 7. 明确不做

- V1 不依赖第三方聊天频道。
- 不把 Server 和 Node 状态做成两个真相源。
- 不承诺 Linux 服务器可以操作 macOS 专属软件。
- 不开放 Node、Docker supervisor、Cua 或数据库公网端口。
- 不做观察用户操作后自动学习。
- 不支持自主支付、转账或主密钥操作。
- 不要求原生 iOS/Android App；优先做好 PWA。

## 8. Grok Bot 能力映射

| 用户可感知能力 | 阶段 | 实现路径 |
| --- | --- | --- |
| 具名 Bot 和本地频道 | M0 | Adapt CopilotKit/OpenBot app/server |
| 持久线程和记忆 | M0 | Local Threads + PostgreSQL |
| 每个 Bot 有电脑 | M1/M3 | Remote Node + Docker/Cua/Lume |
| 一直在线 | M1 | Server service + Node daemon |
| 任意设备访问 | M2 | HTTPS PWA + Tailscale |
| 看着它工作 | M1/M2 | 节点屏幕流经 Server relay |
| 人接管 | M2 | 独占短时 control lease |
| 敏感动作审批 | M2 | Action Gateway + local channel approval |
| Bot 间交接 | M4 | 结构化 handoff |
| 例行工作 | M4 | 本地 worker + durable queue |
