# 研究：频道运行进度面板（仅真实 Run 数据）

- 状态：已采纳
- 日期：2026-09-11
- 负责人：@yxflc11
- 相关：DEV-004
- 验收旅程：Owner 打开频道任务详情时，分工、当前步骤、审批等待、失败/完成与成果入口均来自
  Server 已有 Run / RunProgress / RunFrame / 协作记录；仅存在真实 RunFrame 时显示电脑预览。
- 安全边界：仅 `apps/web` 呈现层；不改协议/Server/鉴权；不伪造进度或假截图。

## 检索证据

- 检索日期：2026-09-11
- 上游 UI 参考（仅呈现语言，不复制实现）：
  - [Grok Bot chat & collaboration docs](https://docs.x.ai/grok-bot/chat-and-collaboration) —
    身份与状态作为可观察产品语言。
    已于 2026-09-11 在线核验（页面标题：Message and collaborate / Work with Grok Bot）。
  - OpenBot 现有 `RunInspector`、`RunCollaboration`、`CHANNEL_EXPERIENCE` 及相关研究文档

## 候选对比

| 候选 | 精确版本或提交 | 许可 | 适配 | 决定 |
| --- | --- | --- | --- | --- |
| 在现有 domain 投影上本地组合面板 | OpenBot `@openbot/domain` Run/RunProgress/RunFrame @ `729c16431057` | MIT | 已在链路上；无需改 lockfile | **选用** |
| 通用看板 / 任务板类 npm UI 套件 | 未选定具体包 — 任一新 UI 套件都会改 package-lock（本切片禁止） | n/a | 呈现层已可由 domain 类型覆盖 | 拒绝 |
| 合成进度 / 库存截图 | n/a | n/a | 违反诚实 DoD | 拒绝 |

## 复用决策

- 选择：在现有 domain 投影上本地组合 UI（不新增依赖）。
- 拒绝：通用看板 npm UI 套件（会改 package-lock，本切片未选定任何具体包）；合成进度/库存截图。

## 验证

- 组件测覆盖空预览、waiting_approval、协作职责与产物入口。
- App 接线测：`AuthenticatedWorkspace` → `RunInspector` 必须传入 `childRuns` / `botsById` /
  `onInspectRun`（DEV-004-fix）。
- 详见英文稿。

## 未决问题

- `App.tsx` 的 `RunInspector` 调用点已纳入 DEV-004-fix（接线 + 测试）。
- ChannelWorkspace 消息行进度呈现仍属后续契约。
