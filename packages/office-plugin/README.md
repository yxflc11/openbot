# @openbot/office-plugin

可选的空间化 Bot 总览，不属于 OpenBot 当前默认产品界面。

- 核心 Web 不依赖、不导入这个包，因此当前版本不会展示办公室。
- 插件只消费公开的 Bot、Channel、Node、Run 数据与头像渲染器，不维护第二套状态。
- 后续启用时，由宿主显式注册组件并单独加载 `styles.css`。
