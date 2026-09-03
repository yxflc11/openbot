# Node 登记

[English](NODE_ENROLLMENT.md) · [简体中文](NODE_ENROLLMENT.zh-CN.md)

OpenBot 工作主机主动连接 Server。每台 Node 先用一个短时、单次 enrollment token，换取自己独有且
可以单独吊销的凭证。Server 只保存两类值经过域分隔的 SHA-256 摘要。

这是 M1 的启动身份边界，不是生产级设备认证。当前签发的仍是 bearer credential。Server 与 Node
必须放在可信私网中；所有非 loopback 连接必须使用 `wss:`，Node 必须使用专用系统账户。

## 登记一台 Node

1. 配置 `OPENBOT_OWNER_PASSWORD`，启动 PostgreSQL 与 Server。
2. 登录 Web，从侧栏打开**节点**，为准确的 Node id 创建令牌。可信 Server 主机也提供同一 CLI 操作：

   ```bash
   npm run node:enrollment-token -- office-linux-01
   ```

3. 在工作主机上配置同一个 `OPENBOT_NODE_ID`、Server WebSocket 地址和刚刚输出的单次值：

   ```dotenv
   OPENBOT_NODE_ID=office-linux-01
   OPENBOT_NODE_SERVER_URL=wss://openbot.internal.example/ws/nodes
   OPENBOT_NODE_ENROLLMENT_TOKEN=obenr_...
   ```

4. 首次启动 Node。它会先通过 HTTPS 兑换令牌，再建立 WebSocket；默认把 `identity.json` 写在
   `OPENBOT_NODE_WORK_DIRECTORY` 下。
5. 立即从环境中删除 `OPENBOT_NODE_ENROLLMENT_TOKEN`。重启 Node，确认它能使用已保存身份重连。

令牌默认十分钟过期、只显示一次且不能重放。为同一 Node 创建新令牌时，之前尚未使用的令牌会失效。
凭证文件使用原子写入，在 POSIX 系统上权限为 `0600`。OpenBot 会拒绝符号链接、非普通文件、过大
文件、格式错误的包和签发给其他 Node id 的凭证。

Owner 弹窗只列出安全的有效/已吊销身份元数据，不返回凭证摘要；在线状态与实时 Node 连接投影合并。
配对令牌只保留在当前打开的弹窗中，关闭后不能再次读取。

无状态环境可以直接用 `OPENBOT_NODE_CREDENTIAL` 注入已登记凭证。它是密钥注入接口，不能提交到
Git，也不能放入员工包。`OPENBOT_NODE_CREDENTIAL_PATH` 可以把文件放到运维方控制的 secret volume。

## 吊销或重新登记

已登录的 Owner 可以调用 `POST /api/v1/nodes/:nodeId/revoke`。Server 会持久化吊销状态、追加身份
审计事件，并断开匹配的在线 Node。吊销后应删除或隔离旧的本地凭证文件。

要重新登记同一个 Node id，创建新令牌，并在不加载旧凭证的情况下启动 Node。新凭证会替换已吊销
记录，并立即断开仍使用旧凭证的会话；所有旧值继续无效。

## 运维规则

- 不要通过公开聊天、Issue、日志平台或 Git 传递 enrollment token。
- 不要在 Node id 之间复制 `identity.json`，也不要把它放入可移植员工包。
- 安全备份 Server 数据库；其中只有凭证摘要与身份审计事件，没有可恢复的明文凭证。
- 丢失 Node 凭证时应吊销后重新登记，不能“找回”。
- 登记成功不代表系统隔离、物理主机所有权或 Provider 权限可信。
- 原生桌面 Provider 必须通过对应平台的权限审查后才能启用。

## 当前安全边界

协议 `0.9.0` 能在连接时验证每台 Node 对独立 bearer 值的持有，并支持单节点吊销。它还不能证明
Node 持有不可导出的私钥，不能轮换短时证书、给每条消息绑定序号，也没有接入 Windows DPAPI、
macOS Keychain 或 Linux Secret Service。Node 通道进入不受信任网络前必须补齐这些控制。详见
[ADR-0023](decisions/0023-one-time-node-enrollment.md)与[安全模型](SECURITY.md)。
