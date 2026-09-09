# 调研：Desktop 固定支持页面

- 状态：已采纳；类型契约与 Desktop 测试套件已验证
- 日期：2026-09-09
- 范围：已安装 Desktop 客户端 Owner 菜单中的帮助与反馈链接。
- 边界：仅在系统默认浏览器打开两个固定的公开 HTTPS 地址。继续拒绝所有新 Electron
  窗口和 renderer 页面跳转。不得向支持地址附加工作空间数据、消息正文、凭据、查询参数
  或 renderer 提供的任意 URL。

## 证据与候选审查

`docs/OPEN_SOURCE_REUSE.md` 中已有的 Desktop 应用基础与本地内容协议条目已选择
Electron 44.2.0、沙箱 renderer 和受限的本地内容来源。新增 Owner 链接会触发
`setWindowOpenHandler` 的拒绝响应，因此需要补充适配才能完成预期操作。

已审查现有正式发布的 Electron 44.2.0 shell API 与安全清单：

- [固定版本 shell API](https://raw.githubusercontent.com/electron/electron/v44.2.0/docs/api/shell.md)。
- [固定版本安全指导](https://raw.githubusercontent.com/electron/electron/v44.2.0/docs/tutorial/security.md)，
  重点包括页面跳转、新窗口，以及不可信 `shell.openExternal` 参数的限制。
- [发布记录](https://github.com/electron/electron/releases/tag/v44.2.0)、
  [MIT 许可证](https://raw.githubusercontent.com/electron/electron/v44.2.0/LICENSE)与
  [BrowserWindow 测试](https://raw.githubusercontent.com/electron/electron/v44.2.0/spec/api-browser-window-spec.ts)。
- 既有基础审查锁定 tag object `369b0d9d3afdd5b8c0bdb0ad42391443947a7424`；
  发布对应提交前缀为 `aa650d7`。依赖版本继续严格固定为 44.2.0。
- 已查看[上游问题 #48388](https://github.com/electron/electron/issues/48388)，用于说明新增
  Electron 窗口或标题栏配置会增加无关的平台适配范围；本适配器不创建新窗口，也不修改
  标题栏行为。

选择现有正式发布的主进程 `shell.openExternal` API，并在外层进行精确字符串白名单与
当前主窗口 WebContents 身份检查。新的链接打开依赖或通用 IPC 桥接不会补足必要能力；
既有官方 API 已在 macOS、Windows 和 Linux 上将默认浏览器选择交给操作系统。
OpenBot 的专用缺口仅是把两个产品自有的常量地址连接到该 API，同时保留拒绝策略。
没有复制或实质改编上游源码，也没有新增依赖、许可证通知变更、可执行权限或 Worker 能力。

## 决定

仅逐字节接受 `https://github.com/yxflc11/openbot#readme` 与
`https://github.com/yxflc11/openbot/issues/new`。拒绝凭据、其他 scheme、端口、额外片段、
参数、编码别名、其他路径和其他主机。发起请求的 WebContents 必须是当前主窗口，
停留在精确且不可变的 Desktop 入口 URL，尚未销毁且未加载其他文档。
新窗口请求始终返回 `deny`；同窗口跳转先被阻止，再判断是否适用固定公开链接例外。
主进程不暴露通用 URL IPC，也不转发表单正文或窗口特征参数。
操作系统无法完成浏览器打开操作时，显示固定错误，不记录传入的 URL。

## 验证

测试两个支持地址、恶意 URL 变体、错误或过期的来源、已销毁或加载中的来源，以及
外部打开操作失败。运行 Desktop 测试和类型检查。这些测试验证路由与拒绝边界；
实际打开浏览器仍需通过原生应用交互检查，不能据此声称已验证 Windows/Linux 真机行为。

验证结果（2026-09-09）：Desktop 类型检查通过；全部 26 个 Desktop 测试文件与
222 项测试通过，包括固定地址、来源身份和失败场景。
原生浏览器点击验证由本次 Desktop UI 的整体验收流程继续完成。
