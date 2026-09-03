# ADR-0010：复用 agent-computer 的 provider 边界

## 状态

已接受，2026-09-03。

## 背景

M1 需要先证明 Server 能把一个安全、可观察的浏览器任务交给可替换 Node，并把结果带回本地频道。CopilotKit/OpenBot 已有长驻 Chromium、按 Bot profile、token 鉴权、navigate 和 screenshot API；重写这层不会形成项目差异，直接 fork 整个上游又会同时引入 Intelligence、supervisor 和另一套控制面。

## 决定

- `providers/docker` 实现 CopilotKit/OpenBot `agent-computer` HTTP 表面的薄适配器。
- 上游电脑作为 Node 本机独立服务运行，只监听 loopback；OpenBot Server 不直连它。
- URL 和 token 必须成对配置；没有真实可执行 provider 时 Node 不声明能力。
- 第一条能力只允许从任务正文提取一个明确 HTTP(S) URL，然后 navigate 和 screenshot。
- 当前兼容基线固定为上游 commit `257c1280d684089be9adb0b35cce262efc7064bf`。
- 不复制上游源代码，不建立第二套系统真相源；需要修改上游时再评估薄 fork 或 submodule。

## 结果

OpenBot 获得了可替换的第一只“手”，但并未获得完整网页 Agent。点击、输入、文件、Shell、实时画面和人工接管都不在此决定授权范围内。预解析 URL 只是纵深防御，Node 的浏览器环境仍必须实施网络出站隔离来处理重定向和 DNS rebinding。
