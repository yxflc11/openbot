# Provider 一致性测试

[English](PROVIDER_CONFORMANCE.md) · [简体中文](PROVIDER_CONFORMANCE.zh-CN.md)

OpenBot 必须先有可执行证据，才会宣称某个平台或 Provider 已受支持。当前设计采用
[MCP Conformance `74edef34`](https://github.com/modelcontextprotocol/conformance/tree/74edef34d674f563537be8c6587cebaa58e830ca)
的稳定检查 ID 和明确预期失败基线、
[Kubernetes Conformance `6fc6e660`](https://github.com/cncf/k8s-conformance/tree/6fc6e66092075b7443c9259629b607c15b7876b9)
的目标元数据与可复现证据，以及
[OCI runtime specification `6999a89a`](https://github.com/opencontainers/runtime-spec/tree/6999a89a76a0329f440d5740497bedb9dd431297)
的系统/架构范围。检查和 JSON schema 只针对 OpenBot；仓库没有复制上游实现代码。

## 当前已经检查什么

协议 `0.7.0` 同时携带临时保留的旧能力别名和作为权威依据的版本化 manifest。每个 Run offer
都包含精确的能力主版本要求；Server 路由和工作主机会各自再检查一次。

- 旧能力名匹配，不能替代缺失的版本化能力。
- `browser.observe@2` 不能静默满足要求 `browser.observe@1` 的任务。
- 平台专属 profile 不能在其他系统执行。
- 已满载工作主机不能继续接单。
- 只有声明、没有 `execute` 的 Provider 不会上报为可执行能力。
- Provider id、平台或能力归属自相矛盾时，Node 会在启动前失败。
- `buildProviderConformanceReport` 会生成严格、有界的 JSON 产物，绑定 Provider、协议、测试集、
  平台、架构、系统版本和证据等级。
- 必需前置条件缺失必须记为失败，不能藏成 skipped；登记过的预期失败仍是失败，也不能获得支持
  标签。

当前场景矩阵覆盖 Linux x64 浏览器、Linux arm64 编码、Windows x64 浏览器、macOS arm64
浏览器、macOS arm64 Cua 声明、平台不匹配、manifest 缺失、能力主版本不兼容和容量耗尽。
这些是模拟契约测试，不代表所有原生 Provider 已经实现。

## 一致性阶段

| 阶段 | 含义 | 必须提供的证据 |
| --- | --- | --- |
| Declaration | 静态元数据合法且内部一致 | `inspectProviderDeclaration` 通过 |
| Routed | Server 与 Node 只接受声明的平台和精确能力主版本 | 共享协议与路由场景通过 |
| Integrated | Provider 在有界隔离任务中正确上报进度、画面、审批和产物 | Provider 集成测试通过 |
| Real device | 相同场景在明确系统版本和架构上运行 | 带可复现外部证据的 `real-device` 报告 |
| Supported | 维护者批准固定 Provider 版本并公开已知限制 | 经审查的真实设备矩阵与安全证据 |
| Certified | 固定版本通过完整矩阵、签名安装包和升级/回滚测试，且没有未批准失败 | 独立发布审查和随版本附带的报告 |

`experimental`、`supported` 和 `certified` 是发布支持标签。只通过声明或模拟路由测试，不能
获得这些标签。

## 当前真实状态

| Provider | Declaration | Routed | Integrated | 当前声明 |
| --- | --- | --- | --- | --- |
| Docker/browser 适配器 | 通过 | Windows/macOS/Linux 模拟路由通过 | 只读打开 URL + PNG 截图垂直切片 | Pre-alpha 开发切片 |
| Cua | 通过 | macOS 声明场景通过 | 本仓库尚未实现 | 无 |
| Lume | 通过 | 已定义要求 | 本仓库尚未实现 | 无 |
| Coder | 通过 | Linux arm64 模拟路由通过 | 本仓库尚未实现 | 无 |

## 机器可读报告

`@openbot/protocol` 定义 `openbot.provider-conformance/v1`，`@openbot/provider-sdk` 提供构建器和
确定性序列化器。报告故意没有 `supported` 或 `certified` 字段：机器负责保存证据，发布标签仍需
维护者审查。

```ts
const report = buildProviderConformanceReport({
  provider,
  providerVersion: "0.1.0",
  stage: "integration",
  suiteVersion: "1.0.0",
  target: {
    platform: "linux",
    architecture: "x64",
    osVersion: "6.8.0",
    evidenceLevel: "hermetic",
  },
  checks: scenarioChecks,
});
```

每项检查都有稳定 ID、严重级别、状态、时间、有界引用和有界证据。报告不接收原始日志，避免
凭证或私人内容进入公开产物。严格 schema 会重新核对统计、基线结果和一致性结论，手工修改
JSON 不能把失败伪装为通过。

预期失败必须带跟踪 Issue 和过期时间。未过期且与失败匹配时，CI 基线可以保持 current，但检查
仍为失败，`summary.conformant` 仍为 `false`。新增失败、条目过期、检查消失或原失败已经修复，
都会让基线变旧并要求人工处理。

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
6. 使用 `buildProviderConformanceReport` 转换场景结果，用
   `providerConformanceReportSchema` 校验，并把确定性 JSON 作为 CI 证据发布。
7. 记录可选组件许可、特权依赖和预期失败。预期失败只能是可见债务，不能伪装成功。

schema 和构建器已经实现。下一步是独立 runner：在隔离环境以及真实 Windows、macOS、Linux
Worker 上执行 Provider 场景并发布报告。在 runner 完成前，Vitest 场景表仍是可执行真相源。
