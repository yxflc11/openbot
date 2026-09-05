# Server 容器

[English](SERVER_CONTAINER.md) · [简体中文](SERVER_CONTAINER.zh-CN.md)

从源码构建的 Server 镜像采用 Debian Bookworm slim 上的 Node.js `24.20.0` LTS，并在
[Dockerfile](../deploy/server/Dockerfile) 中固定经过审查的多架构 digest。构建使用 npm
`10.9.9`，把仓库裁剪为 Server 及其六个内部运行工作区；最终镜像只复制这些工作区的编译输出、
生产依赖、包元数据和数据库 migration。官方基础镜像随附的 npm 和许可证声明予以保留。

这是 pre-alpha 部署基线。本地 arm64 Docker Desktop 测试以及 Linux amd64、arm64 原生任务
均已通过，见 [CI 33938120773](https://github.com/yxflc11/openbot/actions/runs/33938120773)。
本地测试或绿色托管 CI 都不代表通用生产环境或宿主平台
支持。该工作流不向镜像仓库发布产物。已有来源证明的 Worker 运行时仍保留 Node `22.22.2`。

## 从源码构建与运行

在仓库根目录操作；如果还没有 `.env`，请从 `.env.example` 创建。设置至少 15 个字符的随机
`OPENBOT_OWNER_PASSWORD`，以及独立随机的 `OPENBOT_POSTGRES_PASSWORD`。当前 Compose 会把
数据库密码直接拼入 URI，因此请使用足够长的随机 URL-safe 值，例如 64 位十六进制字符串。
`/`、`?`、`#`、`@`、`%` 等分隔符需要单独审查的编码调整。开发用数据库默认值不适合生产。
请保护 `.env`，不要将其纳入版本控制。

```bash
docker compose --env-file .env -f deploy/server/compose.yaml config --quiet
docker compose --env-file .env -f deploy/server/compose.yaml up --build -d
docker compose --env-file .env -f deploy/server/compose.yaml ps
curl --fail http://127.0.0.1:3001/health
```

使用同一端口前，先停止已有的源码开发 Server。Web 与 Worker 服务需要分别运行；本镜像不包含
客户端或电脑 Provider。两个宿主映射端口仍只绑定回环地址。连接远程客户端前，请遵循现有私网、
TLS、Cookie 和 Origin 配置要求。

Server 以 UID/GID `1000` 运行，使用只读根文件系统、私有的 16 MiB 临时文件系统，以及显式
可写的对象数据卷。PostgreSQL 使用独立持久卷。升级现有部署前，请按[数据库运维](DATABASE.zh-CN.md)
备份两类存储。旧版 root 进程写入的对象卷可能需要运维人员审查并迁移为 UID/GID `1000` 所有。
不会自动修改现有卷的所有权；新卷冒烟通过也不代表旧卷升级通过。不要通过删除数据卷解决权限问题。

```bash
docker compose --env-file .env -f deploy/server/compose.yaml stop
```

Compose 提供 20 秒停机宽限，Server 的 HTTP 排空上限为 10 秒，随后进行最终清理。当前集成证据
覆盖健康、空闲的 Server；启动中断、繁忙调度和数据库卡住时的停机仍需生命周期测试。`/health`
检查进程身份和启动完成，不持续检查数据库就绪。PostgreSQL 目前仍使用版本标签而非不可变
digest，因此不能宣称整套部署达到逐字节可重现。

## 复现验证

运行 `npm run server:container:check` 和 `npm run check` 验证仓库契约。在对应原生目标上使用
`docker build --platform linux/arm64 --tag openbot-server:smoke --file deploy/server/Dockerfile .`
构建（amd64 使用 `linux/amd64`），然后运行：

```bash
OPENBOT_TEST_IMAGE=openbot-server:smoke OPENBOT_TEST_PLATFORM=arm64 bash scripts/smoke-server-container.sh
```

amd64 目标请将变量改为 `amd64`。冒烟只创建和清理自身的临时测试容器、网络与对象卷，验证运行
架构、非 root 身份、依赖清单、缺少密码时拒绝启动、当前全部 18 条 migration、健康身份、对象
持久化、migration 幂等和 SIGTERM 零退出码，不发布产物。

详细证据与残余风险见[上游调研](research/server-node24-production-container.md)。
