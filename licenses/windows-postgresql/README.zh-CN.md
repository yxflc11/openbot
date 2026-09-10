# Windows PostgreSQL 源码构建许可说明

OpenBot Windows 桌面端使用官方、未经修改的 **PostgreSQL 17.11 源码**，通过 PostgreSQL 官方 Meson/MSVC 构建系统生成数据库。下载后同时校验仓库固定的 SHA-256 和 PostgreSQL 官方校验文件，不再使用 npm/EDB 的 Windows 二次打包数据库。

构建入口是 `scripts/build-windows-postgresql.ps1`，需要具有使用许可的 Windows x64 MSVC 环境、Python 3、Perl 和 PowerShell 7。Meson、Ninja、WinFlexBison 均固定版本与下载摘要，只放在临时构建目录，不随应用分发。脚本使用官方选项，不修改 PostgreSQL 源码，并在生成产物清单前运行官方初始化和主回归测试。另一个桌面端 CI 流程验证迁移、UTF-8、SCRAM 认证、重启与数据保留。

数据库保留 SQL、JSON、PL/pgSQL、内置 SCRAM 与 UTF-8。关闭 NLS/gettext/iconv、ICU 排序、OpenSSL/TLS、XML/XSLT、readline、外部过程语言、外部压缩库和 JIT。它用于本机回环连接，不承诺远程 TLS 服务或任意第三方二进制扩展兼容性。Microsoft C runtime 由具有许可的 MSVC 工具链按可分发代码条款静态链接；Windows 系统 API 由操作系统提供。不复制 EDB、GNU 运行库或另行下载的 Microsoft 运行库 DLL。

每个数据库产物的 `licenses` 目录包含官方源码压缩包、校验文件、构建脚本、构建选项、上游回归日志和第三方声明。`openbot-postgresql-build.json` 记录编译器版本与摘要、工具版本、runner 镜像、构建时间、DLL 导入以及全部文件大小和 SHA-256。安装包保留这些材料，CI 也提供独立源码与构建证据产物。这里没有声称构建可逐字节复现。

许可文件覆盖 PostgreSQL、Henry Spencer 正则表达式、Snowball、IANA 时区数据、源码内嵌许可声明和解析器生成输出声明。Bison 的输出例外允许包含解析器的 PostgreSQL 继续使用自身许可。完整来源和摘要见 `sources.json`；提取的原始声明对应文件和摘要见 `embedded-notice-sources.json`。为避免遗漏，声明也保留了部分可选组件及构建工具的内容。

用户可检查、调试或使用兼容构建替换独立安装的 PostgreSQL；应用仍校验可执行文件路径与安全规则。未使用或分发来源无法确定的 LGPL DLL，因此选用方案不依赖对那些 DLL 作出无法兑现的对应源码承诺。

`rejected-edb/` 只保留被否决候选包的审查证据，构建脚本明确不把它放入安装包。它不代表旧二次打包数据库已经满足分发条件。候选比较与验证状态见[研究记录](../../docs/research/windows-postgresql-redistribution.md)。构建清单仅在官方回归通过后产生，桌面安装和生命周期仍需各自产物的 Windows 验证。
