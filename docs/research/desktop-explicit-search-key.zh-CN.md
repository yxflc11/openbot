# Desktop 搜索密钥显式配置

2026-09-11，处理 DEV-002 N3。代码确认 Desktop 曾自动将父进程的通用
`TAVILY_API_KEY` 转交给内置 Server，可能误用其他应用的搜索账号。

复查 Electron 44.2.0 的 utilityProcess 环境映射接口及 OWASP 密钥管理指引后，
复用现有白名单，仅把 `OPENBOT_DESKTOP_TAVILY_API_KEY` 映射为内置 Server 的
`TAVILY_API_KEY`；单独存在通用变量时不使用它。独立 Server 的配置与已保存的模型设置不变。
没有新增依赖、复制上游实现，也不宣称环境变量本身变成了密钥库。证据、固定版本和许可见英文记录。

验证通用密钥不被继承、显式 Desktop 密钥可用、空值不配置、其他凭据不会出现在映射中，
并运行全仓检查。这是高级启动器配置，不是新增 UI 或钥匙串功能。
