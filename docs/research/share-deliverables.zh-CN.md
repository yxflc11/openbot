# 研究：分享产出与 Bot 员工包

- 状态：已批准实施
- 日期：2026-09-10
- 负责人：@yxflc11
- 验收流程：点击仅图标的分享入口，下载当前频道产物；或选择频道 Bot，复用现有员工导出预览，直接下载可复用的 JSON 员工包。
- 权限边界：Server 管理任务与产物。界面只传产物 ID 或员工包的四个审核标识字段，系统保存窗口选择本地位置。员工包下载绑定已审核的 packageId、generatedAt 与 If-Match；不生成任务总结、不自动发布到外部。

## 研究与复用

2026-09-10 搜索 `site.github.com/electron/electron v44.2.0 dialog showSaveDialog` 与 `site.w3.org WAI ARIA button accessible name icon button`。核对现有复用清单、桌面布局研究、原生报告保存器及 Agent 报告实现。

| 方案 | 精确版本 | 许可证 | 判断 |
| --- | --- | --- | --- |
| HTML 原生按钮与 React | React 19.2.8，现有 lockfile | MIT / W3C 文档条款 | 保留可访问名称和原生弹窗生命周期 |
| Electron 与已有产物保存器 | Electron 44.2.0；OpenBot 74109b5 | MIT | 复用已测试的鉴权保存流程，窄范围加入 PNG |
| 现有员工包导出与预览 | OpenBot 74109b5 | MIT | 保留脱敏预览、包标识、If-Match、ETag 与 SHA-256，不导出来源身份或主机权限 |

查阅 [WAI 按钮规范](https://www.w3.org/WAI/ARIA/apg/patterns/button/)、[Electron 固定版本文档](https://github.com/electron/electron/blob/v44.2.0/docs/api/dialog.md)、[测试](https://github.com/electron/electron/blob/v44.2.0/spec/api-dialog-spec.ts)、[取消行为问题 #41914](https://github.com/electron/electron/issues/41914) 与[许可证](https://github.com/electron/electron/blob/v44.2.0/LICENSE)。

## 决定与限制

当前缺口是分享面板的频道产物汇总及直接分享所选 Bot 员工包的入口。复用 ArtifactDownloadLink，不开放任意 Electron 下载。PNG 校验类型、签名和 5 MiB 大小上限，使用固定安全文件名；保存前复核当前连接、会话及文件后缀，拒绝覆盖。未知格式拒绝保存。

用户明确纠正：分享模板指直接分享 Bot 自己，原先任务总结方向已撤回。复用现有员工包及审核预览，保留档案、已验证技能与排除项。Desktop 新增受限保存 IPC，只接受 botId、packageId、generatedAt、downloadReviewToken；主进程构建当前 Server 下载地址，发送 If-Match，校验两种精确包类型、ETag 与 SHA-256。JSON 上限 2 MiB，使用服务端安全文件名及原生 .json 保存窗口，复核会话、连接与活动状态，拒绝覆盖。412 刷新预览；取消不报告下载成功。

没有复制或实质改写上游源码，不新增依赖，既有许可证声明保持不变。

## 验证

覆盖频道隔离、主动选 Bot、现有员工包预览、412 刷新、取消状态与文件保存。保存器验证类型、体积、PNG 签名、审核摘要/标签、受限 IPC 输入、后缀、连接变化及已存在文件。运行 `npm run check`，检查生产前端与 macOS 安装版。区分模拟模型与真实推理，Windows/Linux 不依据 Mac 检查推断支持等级。

## 本机验证结果

- 完整 `npm run check` 通过，包含 Web/Desktop 生产构建。分享测试覆盖频道过滤、主动导出 Bot、无成员状态及同一文件预览失败后重试。保存器覆盖两种产物、员工包审核一致性、状态变化、取消和拒绝覆盖。
- 已更新本机现有 alpha.3 的前端和主进程，保留原生 Server 运行时、用户数据与配置。使用固定版本 Electron Packager 同步完整性摘要并验证临时签名；旧应用保留为回退备份。
- 实际安装版已启动，确认分享仅图标、最近文件及 Bot 面板，成功打开员工预览并通过 macOS 系统窗口保存有效 JSON；落盘权限为 0600。验收用临时导出在检查后清理。
- 本次未发起付费模型调用。Markdown/PNG 下载有自动化夹具验证；未新建真实模型报告或 Worker 截图。未安装或实机验证 Windows/Linux。
