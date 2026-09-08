# 调研：Owner 配置模型服务与服务商预设

[English](model-service-presets.md) · [简体中文](model-service-presets.zh-CN.md)

- 状态：已接受
- 日期：2026-09-08
- 负责人：@yxflc11
- 关联需求：本工作区用户要求便于配置常见模型和热门 API 服务。
- 验收：登录 Owner 选择服务预设、保存 API Key、选择或手填模型，再分配给新建或已有模型员工。
  排队 Run 固定连接与模型，不随之后的员工配置修改而改变。
- 安全边界：Server 管理连接地址、凭据、员工绑定、Run 和审计。本次仍为有界文本对话，不授予
  模型工具、记忆访问或电脑权限。

## 检索证据

- 检索日期：2026-09-08。这是接口兼容性调查，不是热度排名。
- GitHub 检索词：`openai/openai-node releases chat completions`、
  `anthropics/anthropic-sdk-typescript releases messages models`、
  `anomalyco/opencode custom provider baseURL models`、`npm/write-file-atomic v8.0.0`。
- 逐家检查官方接口地址、模型 ID、模型发现、地区、鉴权和推理/输出差异。

| 服务 | 已审查官方基础地址 | 模型与发现决定 | 一手证据 |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | 推荐 GPT-5.6 Terra/Sol/Luna；Chat Completions 和模型列表 | [模型](https://developers.openai.com/api/docs/models)、[Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra)、[列表](https://platform.openai.com/docs/api-reference/models) |
| Anthropic | `https://api.anthropic.com` | Sonnet 5、Opus 5、Haiku 4.5；原生 Messages 和模型列表 | [模型](https://platform.claude.com/docs/en/models/overview)、[列表](https://platform.claude.com/docs/en/api/models/list) |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | Gemini 3.8 Flash/3.5 Flash Lite；文档明确为 beta 兼容 API | [兼容接口](https://ai.google.dev/gemini-api/docs/openai)、[模型](https://ai.google.dev/gemini-api/docs/models) |
| DeepSeek | `https://api.deepseek.com` | V4 Flash/Pro；Chat Completions 和模型列表 | [快速开始](https://api-docs.deepseek.com/)、[对话](https://api-docs.deepseek.com/api/create-chat-completion/)、[列表](https://api-docs.deepseek.com/api/list-models/) |
| Kimi | `https://api.moonshot.cn/v1`、`https://api.moonshot.ai/v1` | K2.6/K3/K2.7 Code；保留旧环境 K3 默认值 | [模型](https://platform.kimi.ai/docs/models)、[K3](https://platform.kimi.ai/docs/guide/kimi-k3-quickstart)、[思考](https://platform.kimi.ai/docs/guide/use-thinking-models)、[列表](https://platform.kimi.ai/docs/api/list-models) |
| OpenRouter | `https://openrouter.ai/api/v1` | 发现具体模型 ID；不静默选择自动或免费路由 | [快速开始](https://openrouter.ai/docs/quickstart)、[列表](https://openrouter.ai/docs/api/api-reference/models/get-models) |
| 硅基流动 | `https://api.siliconflow.cn/v1`、`https://api.siliconflow.com/v1` | 区分地区；列表筛选 text/chat，保留含斜杠的 ID | [国内快速开始](https://docs.siliconflow.cn/docs/userguide/quickstart)、[列表](https://docs.siliconflow.com/en/api-reference/models/get-model-list)、[目录](https://www.siliconflow.cn/models) |
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1`、`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`、`https://dashscope-us.aliyuncs.com/compatible-mode/v1` | 地区 Key 独立；推荐 Qwen 3.8 Max，可手填。原生发现地址和结构不同，不假定兼容 OpenAI 列表 | [兼容接口和域名迁移](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)、[原生列表](https://help.aliyun.com/zh/model-studio/list-models) |
| 智谱 / Z.AI | `https://open.bigmodel.cn/api/paas/v4`、`https://api.z.ai/api/paas/v4` | 推荐 GLM-5.3/GLM-4.7-Flash，可手填；未验证兼容列表 | [国内模型](https://docs.bigmodel.cn/cn/guide/models/text/glm-5.2)、[对话](https://docs.z.ai/api-reference/llm/chat-completion) |
| MiniMax | `https://api.minimax.cn/v1`、`https://api.minimax.io/v1` | M3/M2.7；推理与可见文本分离 | [国内兼容接口](https://platform.minimaxi.com/docs/api-reference/text-openai-api)、[国际接口](https://platform.minimax.io/docs/api-reference/text-openai-api)、[列表](https://platform.minimax.io/docs/api-reference/models/openai/list-models) |

- 火山方舟地址 `https://ark.cn-beijing.volces.com/api/v3` 来自
  [官方运行时常量](https://github.com/volcengine/volcengine-python-sdk/blob/5.0.48/volcenginesdkarkruntime/_constants.py)
  和 2026-09-03 发布的 `5.0.48`。预设要求手填账号已启用的推理端点或模型 ID；不声明兼容模型
  发现，也不猜测默认模型。
- 百炼文档说明迁移到工作区 MaaS 域名期间仍可使用已有 DashScope 域名。Coding/Token Plan
  属于不同产品，不自动替换标准 API 地址。
- 扩展前检查了模型对话 `kimi-model-chat.md`、PostgreSQL store、Owner 档案 revision、敏感文件
  原子写入和 POSIX 凭据权限漂移的已有复用条目。
- 已检查 OpenAI 超时问题 [#1825](https://github.com/openai/openai-node/issues/1825)、
  [#2153](https://github.com/openai/openai-node/issues/2153)，以及 Anthropic 流式请求体重试
  [#1170](https://github.com/anthropics/anthropic-sdk-typescript/issues/1170)、schema helper
  [#1162](https://github.com/anthropics/anthropic-sdk-typescript/issues/1162)。本次只发送 JSON 文本，
  不上传流、不用 schema helper、不重试，并设置总截止时间和响应字节上限。

## 候选比较

| 候选 | 精确版本或提交 | 许可证 | 维护、适配与决定 |
| --- | --- | --- | --- |
| OpenAI Node SDK | `7.10.0`、`c22b09bc8bd5feed4ebd02b9f363a1a8b479b5ab` | Apache-2.0 | 已审查固定依赖，检查 client/resources、取消、响应超时和重试测试。Node 22+、可注入 fetch、显式地址符合边界；复用兼容接口。 |
| Anthropic TypeScript SDK | `0.124.0`、`ba14b1f4fdf2e840a7b32297965342a099f6201d` | MIT | 2026-09-04 发布，检查 client、Messages、Models、取消/超时/重试测试和未关闭 issue。Node 20+/TS 5+ 适配，原生消息块/system 不同，新增精确固定依赖。 |
| OpenRouter TypeScript SDK | `v1.2.107` | Apache-2.0 | 2026-09-05 发布，有 unit/e2e 测试，检查 #852 示例、#693 推理参数、#519 调试选项。ESM 适配但现有 SDK 已覆盖本次文本接口，不新增依赖。 |
| DashScope Python SDK | `v1.27.3` | Apache-2.0；已有 certifi MPL-2.0 声明 | 2026-09-01 发布，维护中的测试和完整部署/训练接口；本次 Node 文本适配不需 Python 或控制面，采用已记录的兼容 API。 |
| Volcengine Python SDK | `5.0.48` | Ark runtime 为 Apache-2.0，保留 OpenAI 归属 | 2026-09-03 发布，已检查常量、源码和发布。仅 API Key 文本契约符合本次范围；不引入 AK/SK 管理权限，不复制源码。 |
| GCM 认证加密 | NIST SP 800-38D（2007）、Node `v26.8.1` 的 `crypto` API | 开放标准；Node MIT | 复用 Node/OpenSSL 的标准实现：随机 256 位密钥、全新 96 位 nonce、128 位 tag、绑定连接的 AAD；不写本地密码算法。 |
| 凭据文件保护 | 既有 OpenSSH 审查 `1bf5871aead6d73177d727add15ab0f14c258fdf`、`write-file-atomic@8.0.0` | BSD 风格参考；ISC | 已有文件句柄/类型/权限/大小测试和原子写入/清理审查。复用 POSIX `0600` 和独占初始化边界；不是系统钥匙串。 |
| OpenCode 可配置服务 | [官方文档](https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/providers.mdx)，观察于 2026-09-08 | 仅参考；无源码引入 | 维护中的服务配置和自定义 ID 文档支持“预设+显式地址/模型”的产品流程；不采用其运行时或权限模型。 |

源码和测试：[Anthropic 固定树](https://github.com/anthropics/anthropic-sdk-typescript/tree/ba14b1f4fdf2e840a7b32297965342a099f6201d)、
[OpenAI 固定树](https://github.com/openai/openai-node/tree/c22b09bc8bd5feed4ebd02b9f363a1a8b479b5ab)。
已读取 Anthropic [发布](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/sdk-v0.124.0)、
[客户端](https://github.com/anthropics/anthropic-sdk-typescript/blob/ba14b1f4fdf2e840a7b32297965342a099f6201d/src/client.ts)、
[Messages 测试](https://github.com/anthropics/anthropic-sdk-typescript/blob/ba14b1f4fdf2e840a7b32297965342a099f6201d/tests/api-resources/messages/messages.test.ts)、
[Models 测试](https://github.com/anthropics/anthropic-sdk-typescript/blob/ba14b1f4fdf2e840a7b32297965342a099f6201d/tests/api-resources/models.test.ts)
和 [MIT 许可证](https://github.com/anthropics/anthropic-sdk-typescript/blob/ba14b1f4fdf2e840a7b32297965342a099f6201d/LICENSE)。
加密依据：[NIST](https://csrc.nist.gov/pubs/sp/800/38/d/final)、
[Node crypto](https://nodejs.org/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options)、
[Node 文件句柄](https://nodejs.org/api/fs.html#fspromisesopenpath-flags-mode)。

## 复用决定

- 选择有文档的兼容 API 和发布 SDK，通过薄文本适配器调用；不把兼容 API 描述为独立开放标准。
  现有 SDK 覆盖多数服务，第二个原生 SDK 处理 Anthropic，无需自写网络客户端或引入 Agent 框架。
- 本地差集是服务预设、有界模型发现与手填、Owner 创建/更新/停用、加密凭据、员工绑定、固定
  Run 选择和无正文审计。
- 连接协议、服务商和地址创建后不可改；Key 轮换与启停检查 revision。换地址需新建连接，
  防止排队 Run 静默改变目的地。缺失或停用的已保存连接不会回退。
- 预设只允许精确已审查地址；自定义兼容地址必须先加入 Server 管理员的精确授权列表。浏览器
  输入不能把服务端凭据发往新主机。URL 凭据、查询、fragment、HTTP 和重定向均不接受。
- PostgreSQL 中的 API Key 使用认证加密，AAD 绑定连接 ID、服务商和地址。密钥只在独立本地文件，
  不导出；连接变更和无正文审计同事务提交。`OPENBOT_MODEL_CREDENTIAL_KEY_PATH` 默认
  `./data/model-credentials.key`，自动初始化为 POSIX `0600`，必须随 PostgreSQL 备份。
  已有任意保存连接但密钥丢失时，启动拒绝生成替代密钥。
- 旧 `MOONSHOT_*` 仅为已有未绑定模型员工保留 Server 兼容行为；环境 Key 不复制进连接表，
  本地绑定和凭据不随员工包导出。
- 模型 ID 允许手填，保留 `/`、`:` 和服务商前缀。列表不保证所有条目支持文本或账号有付费权限。
  发现只读一页 SDK 结果、最多 2 MiB、返回最多 256 个 ID。OpenRouter 使用
  `GET /models?output_modalities=text`，硅基流动使用 `GET /models?type=text&sub_type=chat`。
  独立显式测试才检查推理，可能收费；保存连接不自动执行测试。
- 适配器不通用强传采样/思考参数。OpenAI 和 Kimi K3 用 `max_completion_tokens`，K3 默认
  `reasoning_effort: low`，旧环境保留配置的 effort。其余兼容接口采用已审查 `max_tokens`。
  MiniMax 请求 `reasoning_split: true` 并拒绝仍含 `<think>` 的输出。Anthropic 采用原生 Messages、
  顶层 `system`、必填 `max_tokens` 和可见文本块；显式 `authToken: null` 防止环境 Bearer 凭据
  跟随保存的 Key 发出。聊天响应保持 256 KiB 上限；拒绝工具、非文本和不完整回复，不自动重试。
  私有推理不展示、不持久化。
- 退出方案：经过审查后更新 SDK 固定版本和数据预设，保留 ModelClient、Server 权威和员工可移植
  契约；系统钥匙串/KMS 可在后续替换密钥适配器。

## 源码引入

- 没有复制或实质改编上游源码；仅安装 SDK 依赖，本地策略/配置代码调用公开 API 和 Node crypto。
  不内嵌上游 Agent 运行时。
- 依赖保留 Apache-2.0/MIT/ISC 声明；复用台账链接本记录。

## 验证计划

- 自动化：服务请求形状、有界发现、HTTP 鉴权/Origin、凭据脱敏/加密、Owner revision、逐员工
  选择、排队 Run 固定绑定、旧 Kimi 兼容，以及完整 `npm run check`。
- 负例：未知预设/地址、缺失/停用连接、旧 revision、丢失/篡改密钥或密文、暴露权限/符号链接、
  超大响应、工具/非文本/截断回复、上游错误、取消和超时。绝不回显上游正文或 Key。
- 数据库：临时 PostgreSQL migration/store 验证加密持久化、审计和绑定快照。
- UI：桌面/手机的预设→连接→模型→员工流程，包括无发现接口和手填 ID。
- 文档：英文和中文配置、API、复用说明。
- 支持等级：在已观察本地环境有契约测试的实验性 Server 文本适配器。真实推理仅按实际使用
  已授权 Key 调用过的服务声明。

## 未决事项

原生工具调用、逐 token 输出、自动模型路由、自动付费回退/重试、收藏/最近列表、价格同步、
系统钥匙串和 KMS 是独立后续工作。
