# 调研：Vitest 5.0.0 迁移

- 状态：已接受
- 日期：2026-09-11
- 负责人：@yxflc11
- 关联：Dependabot #27（由本 PR 取代）；承接已合入 `main` @ `3b010cf` 的 #42 ACL 夹具修复
- 验收旅程：在 Vitest **5.0.0** 上完整 `npm run check` 与三平台 Portable CI 变绿，既有断言不削弱，
  具备持久 Open-source research，且不夹带 #43 无关补丁依赖。
- 安全边界：仅根目录 **开发依赖** 测试运行器。Vitest 不进入 Server 生产镜像、Desktop 原生运行时或
  Worker Host 归档。不改变生产 ACL、凭据或审批权威。

## 检索证据

- 检索日期：2026-09-11（Asia/Shanghai）
- 上游：
  - [Vitest 5 迁移指南](https://vitest.dev/guide/migration/)
  - [Vitest 5.0.0 博文](https://vitest.dev/blog/vitest-5.html)
  - [vitest `v5.0.0` / `f441c6fa`](https://github.com/vitest-dev/vitest/tree/f441c6fab25e579c5b7dd3dd50538416f415fbae)
  - npm `vitest@5.0.0`（MIT；engines `^22.12 || ^24 || >=26`；peer Vite `^6.4 || ^7 || ^8`）
- 仓库审计：`/workspace/openbot-dep-audit/vitest5-impact.md`（基线 `main` @ `3b010cf`）
- 已核对条目：Dependabot #27；#42 ACL 预算；#43 补丁合并（本 PR **排除**）；账本 Vitest 4.1.11 行；
  `docs/research/windows-native-acl-test-budget.md`

## 对本仓库的实际影响

前置 Node/Vite 已满足。几乎无 Vitest 配置；无 `test.sequential` / workspace projects / browser /
coverage / poolOptions。真实工作是：精确固定 5.0.0、调研门禁、全量套件验证，并观察
`clearMocks` 默认 `true`。#27 的 Windows 60s ACL 超时在 Vitest **4** 的 `main` 上同样出现，已由
#42（120s + spawn 卫生）修复，并非 Vitest 5 引入。

## 候选对比

| 候选 | 结论 |
| --- | --- |
| 在 `main` ≥ `3b010cf` 上独立调研 PR 固定 Vitest 5.0.0 | **选用** |
| 直接合并 Dependabot #27 | 拒绝（缺 research；相对 #42 过时） |
| 继续停留 4.1.11 | 拒绝（无实质阻塞却阻止上游维护） |
| 与 #43 补丁捆绑 | 拒绝（越界） |
| 预先 `clearMocks: false` | 拒绝（除非套件证明需要） |

## 复用决定

- 选项：dependency（根精确固定升级）
- 上游：Vitest `5.0.0` / `f441c6fa`（MIT）
- OpenBot 缺口：仅 bump `package.json` + lockfile 的 Vitest/`@vitest/*`；补 EN/ZH 调研与账本；可选
  `.vitest/` gitignore；保留断言；不包含 #43。
- 失败行为：安装/测试/`check` 失败关闭；不允许双版本 Vitest。

## 源码引入

- 是否复制或实质性改编：否（仅 npm 发布包经 lockfile）

## 验证计划

- `npm ci` + `npm run check`；否定断言不削弱；Linux 箱全量 check；CI 三平台 Portable（Windows 原生
  ACL 仅在 win32 证明）。

## 未决问题

- 120s 预算下主机负载仍可能偶发；监控 Portable，不据此永久拒绝 v5。
- `clearMocks: false` 仅在套件证明后考虑。
