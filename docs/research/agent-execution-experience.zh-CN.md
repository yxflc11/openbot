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
