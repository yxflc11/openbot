# 调研：获批的 Desktop 工作空间优化

[English](desktop-ui-refresh.md)

- 状态：实现与验证中
- 日期：2026-09-09
- 负责人：@yxflc11
- 验收流程：切换频道和 Bot 单独对话，输入 @ 选择 Bot，添加有界文本附件和已审核技能请求，进入全窗口设置与插件。
- 安全边界：Server 管理频道标识、任务路由、技能验证和审批。输入区选择只是请求，不授予权限。分享为明确预览后复制最近读取的消息，不创建公开链接或自动发布对话。

## 检索证据

已检查 `OPEN_SOURCE_REUSE.md` 中 Desktop 工作空间、信息栏、对话连续性、偏好、原生导航、安装分发和技能内容审核条目。OpenBot 基线为 `e8fa933`，集成 main 为 `4367e3d`。GitHub 检索词包括 `site.github.com/facebook/react releases 19.2.8`，以及 WAI APG combobox 和 menus。

| 候选 | 锁定版本或提交 | 许可证 | 维护与测试 | 平台和安全适配 | 决定 |
| --- | --- | --- | --- | --- | --- |
| HTML 控件与 React | React 19.2.8 / 1dd4ecb | MIT；W3C 文档条款 | 检查现有发布、DOM 实现、APG 示例与问题 #2962 | 原生 details、dialog、textarea、文件输入，无新依赖或客户端可执行内容 | 复用 |
| Electron | 44.2.0 / tag 对象 369b0d9d3afdd5b8c0bdb0ad42391443947a7424 | MIT | 检查发布、BrowserWindow 测试、窗口配置和问题 #48388 | Windows/Linux 保留原生窗口边框，macOS 保留红黄绿按钮，保留沙箱与 fuses | 复用 |
| 既有技能导入和目录 | OpenBot e8fa933 | MIT | 已有基于内容摘要的审核和技能分配测试 | 展示已审核单文件技能，不新建商店或执行授权来源 | 薄适配 |

来源：[React 发布](https://github.com/react/react/releases/tag/v19.2.8)、[DOM 源码](https://github.com/react/react/blob/v19.2.8/packages/react-dom-bindings/src/client/ReactDOMComponent.js)、[许可证](https://github.com/react/react/blob/v19.2.8/LICENSE)、[APG 组合框](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)、[选择问题](https://github.com/w3c/aria-practices/issues/2962)、[菜单按钮](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)、[Electron 标题栏](https://github.com/electron/electron/blob/v44.2.0/docs/tutorial/custom-title-bar.md)、[窗口测试](https://github.com/electron/electron/blob/v44.2.0/spec/api-browser-window-spec.ts)、[覆盖层问题](https://github.com/electron/electron/issues/48388)。

## 决定与具体缺口

使用既有 renderer 与标准 HTML 控件。保留 OpenBot 文字、左右面板开关、任务进度条、信息栏及类型化任务 API。频道名称和横向堆叠头像合为一个入口。侧栏以唯一创建加号、插件和 Owner 收敛入口；设置使用专用竖向导航，插件占满应用窗口。

@ 选择仅解析 Server 返回的当前频道成员，目标以 UUID 保存。单独对话由 Server 固定成员并持久复用，见[调研](desktop-direct-conversations.zh-CN.md)。

输入区最多添加 3 个 UTF-8 TXT/MD/CSV/JSON 文件，每个最多 6,000 字节；内容作为用户提供的任务文字提交，完整请求须不超过 8,000 字符。不声称支持 PDF 或二进制解析。技能标签最多请求 2 个已分配且已验证的技能，Server 在执行时重新检查。客户端不执行导入文字，也不因标签授予权限。

分享先预览最近读取消息，再由用户明确复制 Markdown 到剪贴板，失败可手动复制；不引入托管对话服务或新身份边界。没有复制或实质改编上游源码，既有许可声明保留。

## 验证计划

运行导航、输入区、展开入口、单独对话、设置与插件测试，再执行 `npm run check`。在隔离环境检查实际 Mac 构建、左右栏展开/收起以及 960×640 窗口。随后检查 Windows/Linux 运行时契约与原生 CI 包；CI 编译不等于真实设备安装、Wayland 或无障碍一致性认证。安装保留用户配置。中英文交付说明同步更新。

## 本地验收证据（2026-09-09）

- 最终平台快捷键与材质设置修改后，`npm run check` 通过，覆盖类型、测试、格式和生产构建；Desktop 共 26 个测试文件、222 项测试。
- 独立 PostgreSQL 数据库验证了并发打开 Bot 私聊；相同集成测试已加入 CI。
- Chrome 使用隔离数据与 darwin、win32、linux 运行时标识检查构建产物。960 × 640 窗口下检查了工作空间、两侧栏收起、插件返回与竖向设置；这些属于渲染器检查，不等于原生系统验收。
- 检查了 @ 选择、技能标签、独立私聊导航、Owner 菜单和分享预览；中文输入法与过期 Bot 路由已有回归测试。
- Mac 已打包并通过临时签名验证，替换前已备份旧应用和配置。原生启动仍等待用户完成 macOS 认证提示，此检查点不宣称原生启动验收完成。
- Windows/Linux 原生编译与安装包由仓库 CI 矩阵验证，不宣称真机安装、Wayland 或无障碍认证。
