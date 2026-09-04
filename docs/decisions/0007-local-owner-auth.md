# ADR-0007：单 Owner 本地认证与数据库会话

- 状态：Accepted；密码长度与限速条款由 [ADR-0029](0029-durable-login-client-identity.md) 更新
- 日期：2026-09-03

## 背景

OpenBot 的目标是从手机、平板和笔记本远程控制自托管 Server。频道、消息、Node 和后续审批都属于敏感控制面数据，因此不能继续依赖“只监听本机”作为身份边界。同时 M0 不需要团队账号、OAuth 或第三方身份云。

## 决策

1. M0 采用单 Owner 模型。Owner 显示名和密码由 Server 环境变量提供；密码至少 15 个字符，不写入数据库。
2. 登录成功后生成 256-bit 随机 Token，通过 `HttpOnly`、`SameSite=Strict`、`Path=/` Cookie 返回。HTTPS 部署必须启用 `Secure`，并使用 `__Host-openbot_session`；loopback HTTP 开发保留 `openbot_session`。
3. PostgreSQL 只保存 Token 的 SHA-256 摘要、Owner ID、创建时间、过期时间和撤销时间。
4. 所有 `/api/v1` 数据接口默认要求有效 Session；只有健康检查、会话状态和登录公开。
5. 所有非只读请求必须携带精确匹配 `OPENBOT_ALLOWED_ORIGINS` 的 Origin。
6. Session 默认 12 小时过期，登录连续失败五次后临时限制五分钟，退出立即在数据库撤销。
7. Web 根据公开会话状态显示登录页，并根据 `expiresAt` 或任意 API 的 `401` 回到登录页。

## 原因

这一方案不依赖外部身份服务，也不在浏览器可读存储中保存长期密钥。环境变量密码适合单 Owner 自托管部署；数据库 Session 提供跨 Server 重启的连续性、主动撤销和后续审计扩展点。精确 Origin 校验与严格 SameSite Cookie 共同构成 M0 的 CSRF 基线。

## 后果与限制

- 部署者必须管理一个长随机 Owner 密码，并为远程访问配置 HTTPS、Secure Cookie 和准确的 Origin 白名单。
- 登录限速已由 ADR-0029 迁移到 PostgreSQL，并按直接对端 IP 的域分隔摘要分桶；仅接受唯一显式可信代理提供的单跳 `Forwarded`。它仍不是人或设备身份，NAT 共享和临时锁定风险仍存在。
- 远程 Origin 的 HTTPS/Secure Cookie 启动校验、安全响应头和有界 SSE 恢复由 [ADR-0016](0016-control-plane-web-security.md) 补充。
- 当前不支持多用户、密码找回、WebAuthn、设备清单或高风险操作重新验证。
- 修改 Owner 密码不会自动撤销数据库中的既有 Session；部署者应先从设备退出，未来将增加全局 Session 版本或“退出所有设备”。
