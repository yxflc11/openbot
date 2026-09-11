# 研究：9 月 12 日依赖 CI 修复

本次仅处理已出现的 #47、#48、#49、#51，以及[单独审查的 PDF.js #50](pdfjs-6.3-lock-coherence.zh-CN.md)。精确提交、源码检查、候选比较和官方链接见[英文研究](dependency-ci-september12.md)。

采用现有上游发布：setup-dotnet 6.0.0（a98b56852c35b8e3190ac28c8c2271da59106c68）、Node 类型 26.5.0、Node 24.21.0 LTS Bookworm slim（官方 OCI 摘要固定）、electron-builder 26.16.1（7d3b30f3b15950d19f7c5ff882cf2d161cd3ba2c）。已检查相关源码、许可、发布说明、测试和当前开放问题。前三个工具 PR 的构建已通过，失败的是必需的研究说明；容器失败是新运行时与旧版 smoke 断言冲突。

同步容器固定镜像、严格允许列表、真实 smoke 版本断言和双语当前文档。保留 npm 10.9.9、Node 24 LTS 路线、所有安全及原生测试，不扩大权限，不复制源码，不取消失败检查。setup-dotnet 的多 SDK 预览质量问题不涉及单一 global.json。builder 的密钥链、许可证、签名日志修复不代表 OpenBot 已具有正式签名证书。

合并门禁为干净安装、唯一版本解析、生产依赖审计、全仓检查和当前提交的全部平台 CI；未完成前不宣称通过。本次不发布安装包，不把托管 runner 检查等同于用户 Windows 真机安装验收。依赖不兼容时整体回退，不混合旧版约束。
