import { randomUUID } from "node:crypto";
import type { Bot, ExecutionNode, Run } from "@openbot/domain";
import {
  type BrowserAction,
  type BrowserCommand,
  type BrowserResult,
  type BrowserSessionView,
  protocolVersion,
} from "@openbot/protocol";

export interface BrowserAuditEvent {
  botId: string;
  nodeId: string;
  requestId: string;
  action: BrowserAction["kind"] | "open";
  phase: "intent" | "completed" | "uncertain";
}
export interface BrowserStore {
  listBots(): Promise<Bot[]>;
  listRuns(): Promise<Run[]>;
  upsertNode(node: ExecutionNode): Promise<void>;
  getBrowserNode(botId: string): Promise<string | undefined>;
  recordBrowserEvent(event: BrowserAuditEvent): Promise<void>;
}
export interface BrowserGateway {
  list(): ExecutionNode[];
  browserCommand(command: BrowserCommand): Promise<BrowserResult>;
  setBrowserPaused(botId: string, paused: boolean): void;
  onUnavailable(handler: (node: ExecutionNode) => void): () => void;
}
export class BrowserSessionError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404 | 409 | 503 = 409,
  ) {
    super(message);
  }
}
interface Session {
  id: string;
  botId: string;
  nodeId: string;
  nodeName: string;
  owner: string;
  expiresAt: number;
}
interface Control {
  sessionId: string;
  expiresAt: number;
}

/** In-memory view grants never survive reconnect/restart; the backend's paused latch does. */
export class BrowserSessions {
  readonly #sessions = new Map<string, Session>();
  readonly #controls = new Map<string, Control>();
  readonly #busy = new Set<string>();
  readonly #opening = new Set<string>();
  readonly #unsubscribe: () => void;
  constructor(
    readonly store: BrowserStore,
    readonly gateway: BrowserGateway,
    readonly onRelease: () => void = () => undefined,
  ) {
    this.#unsubscribe = gateway.onUnavailable((node) => {
      for (const [id, session] of this.#sessions)
        if (session.nodeId === node.id) {
          this.#sessions.delete(id);
          // Keep paused reservations; reconnect must not silently return control to an Agent.
          const control = this.#controls.get(session.botId);
          if (control) control.expiresAt = 0;
        }
    });
  }

  async open(botId: string, owner: string): Promise<BrowserSessionView> {
    for (const [id, session] of this.#sessions)
      if (session.expiresAt <= Date.now()) this.#sessions.delete(id);
    if (this.#sessions.size >= 64 || this.#opening.has(botId))
      throw new BrowserSessionError("浏览器会话繁忙，请稍后重试。");
    this.#opening.add(botId);
    try {
      const bot = (await this.store.listBots()).find((item) => item.id === botId);
      if (!bot) throw new BrowserSessionError("员工不存在。", 404);
      if (bot.computerProfile !== "docker-linux")
        throw new BrowserSessionError("这名员工未配置浏览器工作环境。", 403);
      const connected = this.gateway.list();
      const existing = [...this.#sessions.values()].find((item) => item.botId === botId)?.nodeId;
      const previous =
        existing ??
        (await this.store.getBrowserNode(botId)) ??
        (await this.store.listRuns()).find((run) => run.botId === botId && run.nodeId)?.nodeId;
      const compatible = connected.filter((node) =>
        node.capabilityManifest.some(
          (cap) => cap.id === "browser.session" && cap.version === 1 && cap.providerId === "docker",
        ),
      );
      const node = previous
        ? compatible.find((item) => item.id === previous)
        : compatible.sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!node)
        throw new BrowserSessionError(
          previous
            ? "员工原来的浏览器主机已离线或版本不兼容，请启动原主机。"
            : "没有可用的浏览器主机，请先启动浏览器运行时和 Node。",
          503,
        );
      await this.store.upsertNode(node);
      const session = {
        id: randomUUID(),
        botId,
        nodeId: node.id,
        nodeName: node.name,
        owner,
        expiresAt: Date.now() + 600_000,
      };
      await this.store.recordBrowserEvent({
        botId,
        nodeId: node.id,
        requestId: randomUUID(),
        action: "open",
        phase: "completed",
      });
      this.#sessions.set(session.id, session);
      return this.#view(session);
    } finally {
      this.#opening.delete(botId);
    }
  }

  async command(id: string, owner: string, action: BrowserAction): Promise<BrowserSessionView> {
    const session = this.#get(id, owner);
    const botId = session.botId;
    if (this.#busy.has(botId)) throw new BrowserSessionError("浏览器正在处理上一项操作。");
    this.#busy.add(botId);
    try {
      // Configuration is re-read at the authority boundary, not cached in a browser grant.
      if (
        !(await this.store.listBots()).some(
          (bot) => bot.id === botId && bot.computerProfile === "docker-linux",
        )
      )
        throw new BrowserSessionError("员工浏览器权限已变更。", 403);
      const held = this.#controls.get(botId);
      const active = held !== undefined && held.expiresAt > Date.now();
      if (action.kind === "take") {
        if (active && held.sessionId !== id)
          throw new BrowserSessionError("另一个窗口正在控制这个浏览器。");
        this.#controls.set(botId, { sessionId: id, expiresAt: Date.now() + 30_000 });
        this.gateway.setBrowserPaused(botId, true);
      } else if (action.kind !== "observe" && (!active || held.sessionId !== id)) {
        throw new BrowserSessionError("请先接管浏览器再操作。");
      }
      const control = this.#controls.get(botId);
      if (control?.sessionId === id && control.expiresAt > Date.now())
        control.expiresAt = Date.now() + 30_000;
      const command: BrowserCommand = {
        type: "browser.command",
        protocolVersion,
        nodeId: session.nodeId,
        botId,
        sessionId: id,
        requestId: randomUUID(),
        expiresAt: new Date(Date.now() + 25_000).toISOString(),
        action,
        ...(control?.sessionId === id && control.expiresAt > Date.now()
          ? { controlExpiresAt: new Date(control.expiresAt).toISOString() }
          : {}),
      };
      const event = {
        botId,
        nodeId: session.nodeId,
        requestId: command.requestId,
        action: action.kind,
      };
      if (action.kind !== "observe")
        await this.store.recordBrowserEvent({ ...event, phase: "intent" });
      let result: BrowserResult;
      try {
        result = await this.gateway.browserCommand(command);
        if (!result.ok || !result.frame) throw new Error("Browser operation failed.");
      } catch {
        if (action.kind === "take" && control) control.expiresAt = 0;
        if (action.kind !== "observe")
          await this.store.recordBrowserEvent({ ...event, phase: "uncertain" });
        throw new BrowserSessionError(
          "浏览器未确认操作结果，请查看最新画面；输入不会自动重试。",
          503,
        );
      }
      if (action.kind !== "observe")
        await this.store.recordBrowserEvent({ ...event, phase: "completed" });
      if (action.kind === "release") {
        this.#controls.delete(botId);
        this.gateway.setBrowserPaused(botId, false);
        this.onRelease();
      }
      session.expiresAt = Date.now() + 600_000;
      return { ...this.#view(session), frame: result.frame };
    } finally {
      this.#busy.delete(botId);
    }
  }

  close(id: string, owner: string): void {
    const session = this.#get(id, owner);
    // Closing a panel stops observation. Explicit release is a separate human decision.
    const control = this.#controls.get(session.botId);
    if (control?.sessionId === id) control.expiresAt = 0;
    this.#sessions.delete(id);
  }

  stop(): void {
    this.#unsubscribe();
    this.#sessions.clear();
  }

  #get(id: string, owner: string): Session {
    const session = this.#sessions.get(id);
    if (!session || session.owner !== owner || session.expiresAt <= Date.now())
      throw new BrowserSessionError("浏览器查看会话已结束，请重新打开。", 404);
    return session;
  }
  #view(session: Session): BrowserSessionView {
    const held = this.#controls.get(session.botId);
    return {
      id: session.id,
      botId: session.botId,
      nodeId: session.nodeId,
      nodeName: session.nodeName,
      control:
        held === undefined
          ? "available"
          : held.expiresAt <= Date.now()
            ? "paused"
            : held.sessionId === session.id
              ? "mine"
              : "other",
      ...(held === undefined ? {} : { controlExpiresAt: new Date(held.expiresAt).toISOString() }),
    };
  }
}
