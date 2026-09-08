# 员工浏览器

[English](EMPLOYEE_BROWSER.md) · [简体中文](EMPLOYEE_BROWSER.zh-CN.md)

OpenBot 的内置浏览器是工作主机上属于员工的持久浏览器。你可以从员工主页或浏览器任务详情打开，
查看真实远程页面。它不在 Web 中嵌入目标网站，也不使用 Owner 的个人浏览器配置。

## 启动运行时

在工作主机的项目 `.env` 中配置：

```dotenv
OPENBOT_DOCKER_COMPUTER_URL=http://127.0.0.1:4100
OPENBOT_DOCKER_COMPUTER_TOKEN=<至少16个字符的随机令牌>
OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS=false
```

然后运行：

```bash
npm run browser:up
npm run browser:status
npm run dev:node
```

Node 需要先[完成注册](NODE_ENROLLMENT.zh-CN.md)。首次启动会构建固定提交
`257c1280d684089be9adb0b35cce262efc7064bf` 的 CopilotKit/OpenBot 运行时及其 Playwright 1.62.1
镜像，并下载浏览器。构建配方改编自上游 Dockerfile，固定 Bun 1.4.2 和源码归档/镜像摘要，并在镜像中保留上游许可证；
安装脚本和系统软件仓库尚未全部固定，不能宣称
构建完全可复现，正式分发时还需固定这些输入。

容器只开放 `127.0.0.1:4100`，通过独立命名卷保留 `/profiles` 与 `/workspace`，不加入 Server
数据库网络，也不挂载 Docker socket。`npm run browser:stop` 停止后保留登录状态。不要通过删除
卷来修复连接故障。容器、配置目录和上游沙箱设置不等于已认证的恶意代码隔离环境。
工作主机仍需实施网络出站限制，覆盖重定向、子资源和 DNS rebinding；URL 预检仅覆盖显式导航。
可以用 `OPENBOT_BROWSER_EGRESS_PROXY` 指定运维管理的策略代理，但配置代理本身不证明隔离有效。

## 使用浏览器

1. 创建员工时选择 **员工浏览器 · Docker**（`docker-linux`）。纯模型员工没有浏览器权限。
   按根 README 启动 Server 和 Web。
2. 在员工主页点击 **打开浏览器**，或从任务详情进入。
3. 面板可见时持续刷新 PNG。导航、点击和输入前，先点 **接管浏览器**。
4. 点击网页中的字段，在底部输入框输入或粘贴中文等文本，再点 **输入**。**隐藏**只遮住本地
   输入框。Tab、Enter、退格、全选和滚动按钮可在桌面和触屏设备使用。输入发往远程当前焦点字段，
   不发送给模型。
5. 完成后点击 **交还员工**。接管时关闭面板会让员工保持暂停；重新打开、接管并明确交还后，
   排队任务才会恢复。

同一员工同时只有一个窗口可以控制。控制租约为 30 秒，由可见面板的成功观察续期，Server 和
Node 都会检查。切到后台或断线可能导致输入权限过期，但不会自动让 Agent 接手填到一半的页面。
查看会话闲置十分钟后失效，Server 最多保留 64 个查看会话；后台命令还有独立并发、大小和时限。

员工继续使用已绑定的浏览器主机。原主机不可用时会明确报错，不会自动换到另一台空白浏览器。
本次不包含配置迁移或主机重新绑定界面。登录状态不会进入员工模板。

## 接口与证据

- `POST /api/v1/bots/:botId/browser`：建立经过认证的查看会话。
- `POST /api/v1/browser-sessions/:sessionId/commands`：只接受 `observe`、`take`、`release`、
  `navigate`、`click`、`type`、`key`、`scroll`，返回控制状态和一张有界 PNG。输入要求当前会话
  持有未过期控制权。
- `DELETE /api/v1/browser-sessions/:sessionId`：停止观察，不交还控制。
- API 需要 Owner Cookie 和可信 Origin，会话绑定当前登录。Cookie、后台令牌和输入正文不放入 URL。
- `browser.session@1` 能力开启已有出站 Node socket 上的 `browser.command`/`browser.result`。
  无关或迟到回复被忽略，断线使未完成命令失败，Node 在执行前消费请求 ID。
- `run_events` 保存 `BROWSER_OPENED` 和不含正文的 `BROWSER_COMMAND` 意图/结果。意图审计失败
  会阻止输入；结果不确定时不会自动重试。
- PNG 只作为临时响应，不保存成聊天产物。画面会呈现网页可见内容；隐藏本地输入框不会遮住网页。

调研及固定版本见[研究记录](research/employee-browser.md)，边界见
[ADR-0028](decisions/0028-employee-browser-sessions.md)。现有自动任务仍只打开明确公网 URL 并截图。
本次增加人工交互，不宣称模型自主多步浏览、自动审批签名租约、视频帧率、下载、完整标签页管理
或原生桌面控制。Web 界面和模拟路由通过不代表所有工作主机平台均已认证。

## 2026-09-08 验收记录

`npm run check` 已通过，包括文档、调研、迁移检查、lint、类型、测试和生产构建。浏览器测试覆盖
会话归属、过期、审计失败、请求上限、回复关联、断线、重复请求和与任务串行执行。

使用真实 Server、PostgreSQL、出站 Node 和固定 Chromium 运行时，以合成账号和本地表单验证。
桌面（1440 × 1100）与手机（390 × 844）均通过员工主页、打开、接管、导航、像素点击、中文/粘贴、
Tab/Enter 提交、滚动、交还和关闭流程。控制台无错误，手机无横向溢出。使用命名卷重启运行时后，
表单状态保留；另一名员工状态独立。最终镜像包含上游 MIT 许可证，测试数据库的浏览器审计未保存
输入正文。

本次环境为 macOS 主机上的 Docker Linux ARM64 Chromium，不代表原生桌面 Provider、所有网站
登录、浏览器崩溃恢复或全部操作系统已经认证。
