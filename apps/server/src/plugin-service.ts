import { randomUUID } from "node:crypto";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import type { Run } from "@openbot/domain";
import type { z } from "zod";
import {
  type FilePluginStore,
  type PluginRecord,
  type PluginState,
  publicPlugin,
  recordPluginAudit,
} from "./plugin-store.js";
import {
  abortPluginOperation,
  mcpPluginConnector,
  normalizePluginEndpoint,
  type PluginConnector,
} from "./plugin-transport.js";
import {
  boundedJson,
  callPluginSchema,
  grantPluginSchema,
  type InstalledPlugin,
  installPluginSchema,
  type PendingPluginCall,
  type PluginCatalogItem,
  PluginError,
  type PluginManifest,
  pluginEndpointInputSchema,
  pluginManifest,
  updatePluginSchema,
} from "./plugin-types.js";

interface WaitingCall {
  view: PendingPluginCall;
  run: Run;
  revision: string;
  signal: AbortSignal;
  settle(decision: "approve" | "reject"): void;
}
export interface PluginServiceOptions {
  store: FilePluginStore;
  assertScope(run: Run): Promise<void>;
  botExists(botId: string): Promise<boolean>;
  localEndpoints?: readonly string[];
  connector?: PluginConnector;
  approvalTimeoutMs?: number;
}

export class PluginService {
  readonly #connector: PluginConnector;
  readonly #pending = new Map<string, WaitingCall>();
  readonly #active = new Map<string, { pluginId: string; abort: AbortController }>();
  readonly #approvalTimeout: number;
  constructor(readonly options: PluginServiceOptions) {
    this.#connector = options.connector ?? mcpPluginConnector(options.localEndpoints);
    this.#approvalTimeout = Math.min(60_000, Math.max(1, options.approvalTimeoutMs ?? 60_000));
  }

  async snapshot(): Promise<{ plugins: InstalledPlugin[]; pendingCalls: PendingPluginCall[] }> {
    return {
      plugins: (await this.options.store.read()).plugins.map(publicPlugin),
      pendingCalls: [...this.#pending.values()]
        .filter((call) => !call.signal.aborted && Date.parse(call.view.expiresAt) > Date.now())
        .map((call) => structuredClone(call.view)),
    };
  }

  async preview(value: unknown, signal: AbortSignal): Promise<PluginManifest> {
    const input = pluginEndpointInputSchema.parse(value);
    const endpoint = normalizePluginEndpoint(input.endpoint, this.options.localEndpoints).href;
    const client = await this.#connector(endpoint, input.token, signal);
    try {
      return pluginManifest(input.name, endpoint, await client.tools(signal));
    } catch (error) {
      throw error instanceof PluginError ? error : new PluginError("unavailable");
    } finally {
      await client.close().catch(() => {});
    }
  }

  async install(value: unknown, signal: AbortSignal): Promise<InstalledPlugin> {
    const input = installPluginSchema.parse(value);
    const manifest = await this.preview(
      {
        name: input.name,
        endpoint: input.endpoint,
        ...(input.token ? { token: input.token } : {}),
      },
      signal,
    );
    if (manifest.digest !== input.reviewedDigest) throw new PluginError("conflict");
    return this.options.store.transaction((state) => {
      signal.throwIfAborted();
      if (
        state.plugins.length >= 16 ||
        state.plugins.some((plugin) => plugin.endpoint === manifest.endpoint)
      )
        throw new PluginError("conflict", "插件已安装或已达到16个插件上限。");
      const plugin: PluginRecord = {
        ...manifest,
        id: randomUUID(),
        revision: randomUUID(),
        enabled: false,
        grants: [],
        createdAt: new Date().toISOString(),
        ...(input.token ? { token: input.token } : {}),
      };
      state.plugins.push(plugin);
      recordPluginAudit(state, { phase: "installed", pluginId: plugin.id });
      return publicPlugin(plugin);
    });
  }

  async setEnabled(id: string, value: unknown): Promise<InstalledPlugin> {
    const input = updatePluginSchema.parse(value);
    const result = await this.options.store.transaction((state) => {
      const plugin = this.#find(state, id, input.revision);
      plugin.enabled = input.enabled;
      plugin.revision = randomUUID();
      recordPluginAudit(state, { phase: input.enabled ? "enabled" : "disabled", pluginId: id });
      return publicPlugin(plugin);
    });
    this.#revoke(id);
    return result;
  }

  async grant(id: string, botId: string, value: unknown): Promise<InstalledPlugin> {
    const input = grantPluginSchema.parse(value);
    if (!(await this.options.botExists(botId))) throw new PluginError("not_found");
    if (new Set(input.tools.map((item) => item.name)).size !== input.tools.length)
      throw new PluginError("invalid");
    const result = await this.options.store.transaction((state) => {
      const plugin = this.#find(state, id, input.revision);
      if (input.tools.some((grant) => !plugin.tools.some((tool) => tool.name === grant.name)))
        throw new PluginError("invalid");
      plugin.grants = plugin.grants.filter((grant) => grant.botId !== botId);
      if (input.tools.length) plugin.grants.push({ botId, tools: input.tools });
      if (plugin.grants.length > 128) throw new PluginError("invalid");
      plugin.revision = randomUUID();
      recordPluginAudit(state, { phase: "grants_changed", pluginId: id, botId });
      return publicPlugin(plugin);
    });
    this.#revoke(id);
    return result;
  }

  async remove(id: string, revision: string): Promise<void> {
    await this.options.store.transaction((state) => {
      this.#find(state, id, revision);
      state.plugins = state.plugins.filter((plugin) => plugin.id !== id);
      recordPluginAudit(state, { phase: "removed", pluginId: id });
    });
    this.#revoke(id);
  }

  async catalog(run: Run): Promise<{ tools: PluginCatalogItem[]; truncated: boolean }> {
    await this.options.assertScope(run);
    const { plugins } = await this.options.store.read();
    const tools: PluginCatalogItem[] = [];
    let truncated = false;
    for (const plugin of plugins.filter((plugin) => plugin.enabled)) {
      for (const grant of plugin.grants.find((grant) => grant.botId === run.botId)?.tools ?? []) {
        const descriptor = plugin.tools.find((tool) => tool.name === grant.name);
        if (!descriptor) continue;
        const item: PluginCatalogItem = {
          pluginId: plugin.id,
          revision: plugin.revision,
          pluginName: plugin.name,
          toolName: grant.name,
          mode: grant.mode,
          description: descriptor.description.slice(0, 500),
          inputSchema: descriptor.inputSchema,
        };
        if (tools.length >= 16 || Buffer.byteLength(JSON.stringify([...tools, item])) > 12 * 1024) {
          truncated = true;
          continue;
        }
        tools.push(item);
      }
    }
    return { tools, truncated };
  }

  async call(
    run: Run,
    value: z.infer<typeof callPluginSchema>,
    signal: AbortSignal,
  ): Promise<unknown> {
    // Detach nested values so the reviewed arguments and the eventual wire call are identical.
    const input = callPluginSchema.parse(JSON.parse(boundedJson(value, 16 * 1024)));
    boundedJson(input.arguments, 8 * 1024);
    await this.options.assertScope(run);
    const snapshot = await this.options.store.read();
    const plugin = this.#authorized(snapshot, run, input.pluginId, input.revision, input.toolName);
    const descriptor = plugin.tools.find((tool) => tool.name === input.toolName);
    if (!descriptor) throw new PluginError("forbidden");
    const validate = new AjvJsonSchemaValidator().getValidator(descriptor.inputSchema);
    if (!validate(input.arguments).valid) throw new PluginError("invalid");
    if (this.#active.size >= 16) throw new PluginError("unavailable", "插件并发已达上限。");
    const id = randomUUID();
    const abort = new AbortController();
    const deadline = AbortSignal.any([signal, abort.signal, AbortSignal.timeout(120_000)]);
    this.#active.set(id, { pluginId: plugin.id, abort });
    let client: Awaited<ReturnType<PluginConnector>> | undefined;
    try {
      client = await this.#connector(plugin.endpoint, plugin.token, deadline);
      const current = pluginManifest(plugin.name, plugin.endpoint, await client.tools(deadline));
      if (current.digest !== plugin.digest) throw new PluginError("conflict");
      await this.#check(run, plugin.id, plugin.revision, input.toolName, deadline);
      const mode = plugin.grants
        .find((grant) => grant.botId === run.botId)
        ?.tools.find((grant) => grant.name === input.toolName)?.mode;
      if (mode !== "read" && mode !== "confirm") throw new PluginError("forbidden");
      if (mode === "confirm") {
        await this.#waitApproval(run, plugin, id, input.toolName, input.arguments, deadline);
        const refreshed = pluginManifest(
          plugin.name,
          plugin.endpoint,
          await client.tools(deadline),
        );
        if (refreshed.digest !== plugin.digest) throw new PluginError("conflict");
      }
      await this.options.assertScope(run);
      // Commit content-free dispatch intent before the external effect can leave the Server.
      await this.options.store.transaction((state) => {
        deadline.throwIfAborted();
        this.#authorized(state, run, plugin.id, plugin.revision, input.toolName);
        recordPluginAudit(state, {
          phase: "dispatching",
          pluginId: plugin.id,
          botId: run.botId,
          runId: run.id,
          callId: id,
          toolName: input.toolName,
        });
      });
      deadline.throwIfAborted();
      const result = await abortPluginOperation(
        client.call(input.toolName, input.arguments, deadline),
        deadline,
      );
      boundedJson(result, 12 * 1024);
      await this.#check(run, plugin.id, plugin.revision, input.toolName, deadline);
      await this.options.store.transaction((state) => {
        deadline.throwIfAborted();
        this.#authorized(state, run, plugin.id, plugin.revision, input.toolName);
        recordPluginAudit(state, {
          phase: "completed",
          pluginId: plugin.id,
          botId: run.botId,
          runId: run.id,
          callId: id,
          toolName: input.toolName,
        });
      });
      return { plugin: plugin.name, tool: input.toolName, result, untrusted: true };
    } catch (error) {
      await this.options.store
        .transaction((state) =>
          recordPluginAudit(state, {
            phase: "failed",
            pluginId: plugin.id,
            botId: run.botId,
            runId: run.id,
            callId: id,
            toolName: input.toolName,
          }),
        )
        .catch(() => {});
      throw error instanceof PluginError ? error : new PluginError("unavailable");
    } finally {
      this.#pending.delete(id);
      this.#active.delete(id);
      await client?.close().catch(() => {});
    }
  }

  async decide(id: string, decision: "approve" | "reject"): Promise<void> {
    const call = this.#pending.get(id);
    if (!call) throw new PluginError("not_found");
    await this.options.assertScope(call.run);
    await this.options.store.transaction((state) => {
      if (this.#pending.get(id) !== call || call.signal.aborted) throw new PluginError("conflict");
      if (Date.parse(call.view.expiresAt) <= Date.now()) throw new PluginError("expired");
      this.#authorized(state, call.run, call.view.pluginId, call.revision, call.view.toolName);
      recordPluginAudit(state, {
        phase: decision === "approve" ? "approved" : "rejected",
        pluginId: call.view.pluginId,
        botId: call.run.botId,
        runId: call.run.id,
        callId: id,
        toolName: call.view.toolName,
      });
    });
    // A call is resolved once, only after its decision has persisted successfully.
    if (this.#pending.get(id) !== call || call.signal.aborted) throw new PluginError("conflict");
    this.#pending.delete(id);
    call.settle(decision);
  }

  close(): void {
    for (const active of this.#active.values()) active.abort.abort();
  }
  #revoke(pluginId: string): void {
    for (const active of this.#active.values())
      if (active.pluginId === pluginId) active.abort.abort();
  }
  #find(state: PluginState, id: string, revision: string): PluginRecord {
    const plugin = state.plugins.find((plugin) => plugin.id === id);
    if (!plugin) throw new PluginError("not_found");
    if (plugin.revision !== revision) throw new PluginError("conflict");
    return plugin;
  }
  #authorized(
    state: PluginState,
    run: Run,
    id: string,
    revision: string,
    toolName: string,
  ): PluginRecord {
    const plugin = this.#find(state, id, revision);
    if (
      !plugin.enabled ||
      !plugin.grants.some(
        (grant) => grant.botId === run.botId && grant.tools.some((tool) => tool.name === toolName),
      )
    )
      throw new PluginError("forbidden");
    return plugin;
  }
  async #check(
    run: Run,
    id: string,
    revision: string,
    toolName: string,
    signal: AbortSignal,
  ): Promise<void> {
    signal.throwIfAborted();
    await this.options.assertScope(run);
    this.#authorized(await this.options.store.read(), run, id, revision, toolName);
    signal.throwIfAborted();
  }
  async #waitApproval(
    run: Run,
    plugin: PluginRecord,
    id: string,
    toolName: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<void> {
    await this.options.store.transaction((state) => {
      signal.throwIfAborted();
      this.#authorized(state, run, plugin.id, plugin.revision, toolName);
      recordPluginAudit(state, {
        phase: "approval_requested",
        pluginId: plugin.id,
        botId: run.botId,
        runId: run.id,
        callId: id,
        toolName,
      });
    });
    let settle!: WaitingCall["settle"];
    const decided = new Promise<"approve" | "reject">((resolve) => {
      settle = resolve;
    });
    const expiresAt = new Date(Date.now() + this.#approvalTimeout).toISOString();
    this.#pending.set(id, {
      run,
      revision: plugin.revision,
      signal,
      settle,
      view: {
        id,
        pluginId: plugin.id,
        pluginName: plugin.name,
        toolName,
        botId: run.botId,
        channelId: run.channelId,
        runId: run.id,
        arguments: structuredClone(args),
        expiresAt,
      },
    });
    try {
      const approvalSignal = AbortSignal.any([signal, AbortSignal.timeout(this.#approvalTimeout)]);
      const decision = await abortPluginOperation(decided, approvalSignal);
      if (decision !== "approve") throw new PluginError("rejected");
    } catch (error) {
      if (!signal.aborted && Date.parse(expiresAt) <= Date.now()) throw new PluginError("expired");
      throw error;
    } finally {
      this.#pending.delete(id);
    }
  }
}
