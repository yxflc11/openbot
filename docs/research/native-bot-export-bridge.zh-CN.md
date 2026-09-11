# 研究：Desktop 桥接保留已审核的 Bot 正文选择

- 状态：已接受实施
- 日期：2026-09-11
- 负责人：@yxflc11
- 验收：在实际安装的 Desktop 中下载含已审核、允许分发的 SKILL.md 的 Bot，并检查保存文件和导入后的待审核状态。
- 边界：渲染器仅提供审核绑定身份和可选布尔值；Server 绑定精确导出字节，输出路径只能由原生保存框选择。

## 证据与复用

先核对[既有 Bot 正文研究](portable-bot-skills.md)与复用台账。实际 alpha.7 可以预览 v2，
下载却在保存框出现前失败：preload 仍拒绝第五个字段，且只投递旧四字段；Web 和主进程已支持
`includeSkillContent`。

查阅 [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
及固定 [44.2.0 contextBridge 契约](https://github.com/electron/electron/blob/v44.2.0/docs/api/context-bridge.md)：
支持布尔值和对象，应通过单一用途方法传 IPC。沿用已审阅的 Electron 44.2.0（MIT，维护中，
上游 `spec/api-context-bridge-spec.ts` 有桥接测试）、Agent Skills 格式、OpenBot v2 与 Server
摘要校验。问题是本地字段投递遗漏，不需要新依赖、上游 fork 或任意 IPC 权限。

## 决定与验证

保留旧四字段请求，仅增加可选布尔 `includeSkillContent`，明确保留 true/false；其他键和类型
在 IPC 前拒绝。主进程继续独立校验、核对预览摘要/下载哈希、限制字节、复核会话并独占创建文件。
同时修正导入表单“员工包导出不包含技能正文”的旧提示。

实际 preload 源码回归覆盖 v1、v2 true/false、错误类型、额外 URL/路径和精确投递，先确认旧实现
失败。保留主进程、Web/Server 负向测试，运行完整检查、原生 CI 与真实安装应用下载/导入流程。
单元测试通过不能替代原生验收。未复制上游源码，未新增依赖；用户数据、截图和任务产出不入仓。
