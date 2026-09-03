# ADR-0003：Marvis 办公室与 Grok Bot 频道

> Superseded by [ADR-0013](0013-channel-first-office-plugin.md)：办公室已改为可选插件，当前版本频道优先。

## 状态

Accepted

## 背景

项目需要同时解决两个不同问题：让普通用户直观理解多个数字员工正在做什么，以及让长期任务拥有可复用的上下文、成员和历史。腾讯 Marvis 的办公室视图擅长前者，Grok Bot 的频道和自由新增 Bot 擅长后者。

## 决策

1. 默认首页采用 Marvis 式可视化办公室。
2. 保留长期 Channel，并允许用户创建、归档和配置频道。
3. 允许用户创建持久 Bot，并把 Bot 加入一个或多个频道。
4. Bot、Channel、Run 和 Node 是独立实体。
5. 办公室显示状态总览；完整任务、审批、电脑和产物进入 Channel/Run 详情。
6. 不复制腾讯 Marvis 或 Grok Bot 的品牌、角色素材和商标。

## 结果

- 产品对非技术用户更直观；
- 频道保留长期上下文和多人协作能力；
- 可视化角色不会绑定到某一台 Mac Mini 或服务器；
- UI 必须由结构化事件驱动，办公室不能成为第二套运行状态；
- V1 需要同时具备 `create channel`、`create bot` 和 `add bot to channel` 三个基本动作。
