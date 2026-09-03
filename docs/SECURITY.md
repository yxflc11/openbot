# 安全模型

## 1. 基本假设

OpenBot 假设以下组件都会犯错或被不可信内容影响：

- 大模型；
- 浏览器页面、邮件、文档和聊天内容；
- 第三方 Skill、MCP server 与连接器；
- Docker/VM 内的 Agent；
- 任意“我会小心”的自然语言承诺。

安全性来自进程边界、最小权限、确定性策略、人工审批和审计，不来自提示词。

## 2. 信任边界

### 可信

- Owner 身份和批准操作；
- OpenBot manifest 与签名/固定版本的部署配置；
- OpenBot Server / Action Gateway；
- 本机审批与审计存储；
- Tailscale 私网身份。

### 有条件可信

- OpenBot Node：只在被授予的 execution profile 内执行，不能修改 Server 策略；
- Cua Driver runtime：持有 macOS TCC 权限，因此其入口、版本和 policy 必须固定；
- Docker/Lume supervisor：拥有强生命周期权限，必须隔离且不能暴露公网。

### 不可信

- Agent session；
- 网页和附件；
- Docker/VM 工作负载；
- 未审查的 Skill、MCP、浏览器扩展和脚本。

## 3. 动作等级

| 等级 | 例子 | 默认决定 |
| --- | --- | --- |
| Observe | 截图、读取公开网页、列目录、查看状态 | 自动；仍写审计 |
| Prepare | 填草稿、编辑未发送邮件、生成待审文件 | 受限租约；限定目标和 TTL |
| Commit | 提交表单、发邮件/消息、删除、安装、发布、改权限 | 每次审批或人接管 |
| Forbidden | 支付、转账、改系统安全设置、导出主密钥、关闭审计 | V1 永久禁止 |

支付不是“审批后允许”，而是 V1 根本不支持。未来即使开放，也必须是独立设计和独立 threat model。

## 4. 关键规则

1. **默认拒绝。** 未声明的 Agent、工具、电脑、域名或动作不能运行。
2. **路由不可由模型改变。** Agent 只能在 manifest 分配的 execution profile 中工作。
3. **批准是一次性能力。** 绑定目标、动作、上下文、次数和过期时间。
4. **审计先于执行。** Server Action Gateway 必须先写入 `requested/decision`，再向 Node 发放动作租约。
5. **接管互斥。** 人在操作电脑时，Agent 输入必须被拒绝，不能排队偷偷补做。
6. **密钥不可回读。** UI 只显示 configured/not configured；日志不显示原值。
7. **宿主权限最小化。** Bot 使用标准 macOS 用户；控制面和执行面使用不同身份/目录。
8. **生产不拉 main。** 只部署固定版本和校验过的构建。
9. **频道成员由 Server 校验。** Client 或模型指定的 assignee 只有在目标 Bot 已加入频道时才有效；未指定时只从该频道 roster 中确定性选择。

## 5. GUI 审批的真实限制

像素点击本身没有“发送”或“支付”语义。仅凭坐标、按钮文字或模型自报，无法建立可靠的安全边界。

因此 V1 采用以下保守策略：

- 普通网页优先使用可提供 DOM/URL/表单语义的隔离浏览器工具；
- 原生 macOS 默认只开放观察能力；
- prepare 租约只允许指定 app/window，并限制时长；
- 不可逆的原生 GUI 操作必须走专门工具、确定性 routine checkpoint，或交给人接管；
- 若目标窗口、URL、表单摘要或 app 身份变化，既有批准立即失效；
- 对无法识别的动作升级风险，不自动降级。

任何宣传都不能声称“系统能理解所有按钮的后果”。

## 6. Server 与 Node 基线

### Server

- PostgreSQL、频道、线程、策略、凭证和审计只存在于 Server 控制域。
- 默认只经 Tailscale/私网 HTTPS 访问；禁止公开数据库和内部 API。
- M0 使用单 Owner 本地认证：Owner 密码来自 Server 环境变量，不写入数据库；随机 Session Token 只进入 `HttpOnly`、`SameSite=Strict` Cookie，数据库只保存 SHA-256 摘要。
- 所有控制面接口默认要求有效 Session；非只读请求还必须通过精确 Origin 白名单。登录连续失败会被临时限速。
- Session 默认 12 小时过期，支持主动撤销；生产 HTTPS 部署必须启用 Secure Cookie。审批等高风险操作仍需要后续增加重新验证或设备绑定。
- Server 签发的 view/control/upload token 都绑定用户、run、node、用途和 TTL。
- 备份加密并定期在另一台机器验证恢复。

### Node

- Node 主动建立 WSS/mTLS 连接，不接受公网入站控制。
- 每个 Node 使用独立可吊销身份；enrollment token 只能使用一次。
- Node 不能读取其他 Node、Server 数据库或全局凭证。
- Docker supervisor、Cua 和 Lume 只监听 loopback/Unix socket。
- 人接管必须持有 Server 签发的独占 control lease。

### macOS Node

- 专用标准用户；管理员账号只在维护时使用。
- 不登录主 Apple ID、主邮箱、主浏览器 profile 或主密码库。
- FileVault、防火墙、自动安全更新。
- 有线网络、禁止系统睡眠、来电自动启动。
- 屏幕和输入经 Server 的短时 relay/token，不直接暴露 Cua。
- Node 管理服务只监听 loopback/Unix socket。
- TCC 权限只授予固定 Cua runtime identity。
- Node 日志、浏览器 profile、缓存状态和本地产物均加密；长期数据库与备份留在 Server 控制域。

注意：启用 FileVault 后，完全无人值守的冷启动与安全性之间存在取舍。macOS Node 里程碑必须实测目标版本在断电、重启、登录和用户态 launchd 下的恢复行为。

## 7. 必须测试的攻击场景

- 网页提示 Agent 忽略规则并读取宿主文件。
- 邮件要求安装软件或上传 token。
- `chief` 试图直接调用 Cua/Shell。
- `ops` 在运行中要求从 Docker 切换到 This Mac。
- 批准后 URL、窗口或表单内容发生变化。
- 同一 approval 被重复消费。
- 人接管时 Agent 仍发送输入。
- Docker 容器尝试访问 Docker socket、宿主私网或敏感 bind mount。
- 服务重启后错误恢复了已过期批准。
- 日志或截图包含密码、验证码、cookie 或 token。
- 被吊销的 Node 继续领取任务或上传画面。
- 恶意 Node 伪造另一个 Node 或重放旧 sequence。
- Client 绕过 Server 尝试直连 Node/supervisor/Cua。
- 两台设备同时申请人工接管并都获得输入权。

## 8. 开源发布要求

- `SECURITY.md` 提供私密漏洞报告渠道后再公开真实账号支持。
- 发布前生成 SBOM、依赖许可证报告和二进制校验和。
- 示例配置永远使用占位符；CI 扫描 secret。
- threat model、默认策略和已知限制随版本发布。
- 不把 Tailscale、Docker socket、Cua daemon 或数据库端口暴露到公网。
