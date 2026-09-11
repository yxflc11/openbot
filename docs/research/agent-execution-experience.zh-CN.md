# 研究补充：原生任务体验

本页记录本次中文补充；完整研究沿革见[英文原文](agent-execution-experience.md)。

## 统一任务摘要（2026-09-11）

在 main `9fc1d1895add0aa3bfb57b2286459d371138f500` 的真实前端与独立 Server
验收数据中，详情已使用错误解释目录，但频道动态和侧栏仍优先展示原始错误或旧进度。
本次复用已有 `nativeRunFailure` 与 Run 状态投影，统一这些入口；阻塞、等待审批和终态
优先于旧进度。重新查阅 [React 条件渲染](https://react.dev/learn/conditional-rendering)
及 [React 发布记录](https://github.com/react/react/releases)，沿用已完成源码和测试审查的
React 19.2.8（MIT，见 Desktop UI refresh 复用账本），不新增依赖、协议或执行权限。
不复制上游源码。回归检查覆盖频道和侧栏实际组件，使用旧进度与已知错误码组合，并在构建后的
界面核对它们与详情展示相同解释。

## 原生表情回应转发（2026-09-11）

实际安装应用的表情回应菜单提交时返回 405：现有回应 API 使用 PUT，Desktop 代理却只允许
GET/POST/PATCH/DELETE。沿用已审查的 Electron 44.2.0 / MIT Session 代理与
[RFC 9110 PUT](https://httpwg.org/specs/rfc9110.html#PUT)，只为现有频道消息回应路径放行 PUT，
其他 PUT 仍拒绝；保留来源改写、凭证头拒绝、请求大小与重定向限制及 Server 权限校验。
无需新依赖，不复制上游源码。完整证据见 [Desktop 连接研究补充](desktop-server-connection.md)。
