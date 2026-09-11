# 研究：Node 环境变量凭证明示启用

日期：2026-09-11；对应 DEV-002 H3。[完整研究和精确版本](node-environment-credential-opt-in.md)。

复用已有 Zod 4.5.4（e8e206fa33ac5fe7ce20a2beb12d57b1cb3df653）严格布尔解析与跨字段校验，已检查上游发布、测试、问题和 MIT 许可，不增加依赖或复制源码。对照 OWASP Secrets Management 及仓库登记、Secret Service、macOS Host 复用记录。

默认拒绝 `OPENBOT_NODE_CREDENTIAL`；仅显式设置 `OPENBOT_NODE_ALLOW_ENV_CREDENTIAL=true` 的临时 file 配置允许注入，并产生不含凭证的启动提示。明确选择 Secret Service 或 macOS Host 后，环境凭证不能绕过该存储。实际凭证使用入口重复校验，正常登记和恢复不增加步骤。Windows Host 转发显式选项，测试中的临时凭证明确启用。

覆盖默认拒绝、布尔值校验、明确启用、密钥库不可绕过、拒绝时无网络或存储访问、日志不含凭证；执行全仓检查和现有原生 CI。本项不实现 PoP/mTLS，不宣称消除了 bearer 的可复制性，H3 的协议部分继续开放。
