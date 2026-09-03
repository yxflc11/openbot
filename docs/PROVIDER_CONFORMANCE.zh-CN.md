# Provider 一致性测试

[English](PROVIDER_CONFORMANCE.md) · [简体中文](PROVIDER_CONFORMANCE.zh-CN.md)

OpenBot 必须先有可执行证据，才会宣称某个平台或 Provider 已受支持。当前结构采用 MCP
conformance suite 的场景测试方式和 OCI runtime specification 的明确平台声明原则，但测试内容
只针对 OpenBot。仓库没有复制 MCP 或 OCI 的实现代码。

## 当前已经检查什么

协议 `0.7.0` 同时携带临时保留的旧能力别名和作为权威依据的版本化 manifest。每个 Run offer
都包含精确的能力主版本要求；Server 路由和工作主机会各自再检查一次。

- 旧能力名匹配，不能替代缺失的版本化能力。
- `browser.observe@2` 不能静默满足要求 `browser.observe@1` 的任务。
- 平台专属 profile 不能在其他系统执行。
- 已满载工作主机不能继续接单。
- 只有声明、没有 `execute` 的 Provider 不会上报为可执行能力。
- Provider id、平台或能力归属自相矛盾时，Node 会在启动前失败。

当前场景矩阵覆盖 Linux x64 浏览器、Linux arm64 编码、Windows x64 浏览器、macOS arm64
浏览器、macOS arm64 Cua 声明、平台不匹配、manifest 缺失、能力主版本不兼容和容量耗尽。
这些是模拟契约测试，不代表所有原生 Provider 已经实现。

## 一致性阶段

| 阶段 | 含义 | 必须提供的证据 |
| --- | --- | --- |
| Declaration | 静态元数据合法且内部一致 | `inspectProviderDeclaration` 通过 |
| Routed | Server 与 Node 只接受声明的平台和精确能力主版本 | 共享协议与路由场景通过 |
| Integrated | Provider 在有界隔离任务中正确上报进度、画面、审批和产物 | Provider 集成测试通过 |
| Supported | 维护者在明确的真实系统版本上运行集成测试并公开限制 | 真实设备 CI 证据与安全审查 |
| Certified | 固定版本通过完整矩阵，并包含签名安装包、升级/回滚和零个未批准预期失败 | 随发布附带的一致性报告 |

`experimental`、`supported` 和 `certified` 是发布支持标签。只通过声明或模拟路由测试，不能
获得这些标签。

## 当前真实状态

| Provider | Declaration | Routed | Integrated | 当前声明 |
| --- | --- | --- | --- | --- |
| Docker/browser 适配器 | 通过 | Windows/macOS/Linux 模拟路由通过 | 只读打开 URL + PNG 截图垂直切片 | Pre-alpha 开发切片 |
| Cua | 通过 | macOS 声明场景通过 | 本仓库尚未实现 | 无 |
| Lume | 通过 | 已定义要求 | 本仓库尚未实现 | 无 |
| Coder | 通过 | Linux arm64 模拟路由通过 | 本仓库尚未实现 | 无 |

## 运行当前测试

```bash
npm run test --workspace @openbot/protocol
npm run test --workspace @openbot/provider-sdk
npm run test --workspace @openbot/node
npm run test --workspace @openbot/server
```

完整仓库门禁仍然是：

```bash
npm run check
```

## 新增 Provider

1. 先检索维护中的现有实现，并在[开源复用审查](OPEN_SOURCE_REUSE.zh-CN.md)登记固定版本和许可。
2. 只写窄范围 `ComputerProvider`，不能把上游的身份、策略或路由引入 OpenBot。
3. 只声明适配器真正能执行的平台；未完成的包不提供 `execute`，保持 declaration-only。
4. 为平台、必要架构、精确能力主版本、容量、重连和 fail-closed 行为增加正反场景。
5. 先补隔离集成测试，再提供真实设备证据，最后才能申请支持标签。
6. 记录可选组件许可、特权依赖和预期失败。预期失败只能是可见债务，不能伪装成功。

未来发布会生成机器可读报告，并提供明确的 expected-failures 文件。在独立 runner 完成前，
Vitest 场景表是可执行真相源。
