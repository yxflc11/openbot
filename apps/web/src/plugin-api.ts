import { ApiError } from "./api";

export interface PluginTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}
export interface PluginManifest {
  name: string;
  endpoint: string;
  tools: PluginTool[];
  digest: string;
}
export interface PluginGrant {
  name: string;
  mode: "read" | "confirm";
}
export interface Plugin extends PluginManifest {
  id: string;
  revision: string;
  enabled: boolean;
  grants: Array<{ botId: string; tools: PluginGrant[] }>;
  createdAt: string;
}
export interface PendingPluginCall {
  id: string;
  pluginId: string;
  pluginName: string;
  toolName: string;
  botId: string;
  channelId: string;
  runId: string;
  arguments: Record<string, unknown>;
  expiresAt: string;
}
export interface PluginSnapshot {
  plugins: Plugin[];
  pendingCalls: PendingPluginCall[];
}

export async function pluginRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    ...init,
    credentials: "include",
    redirect: "error",
    headers: { "Content-Type": "application/json" },
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("openbot:unauthorized"));
    throw new ApiError(`Plugin request failed (${response.status}).`, response.status);
  }
  return response.json() as Promise<T>;
}
export function listPlugins(signal?: AbortSignal): Promise<PluginSnapshot> {
  return pluginRequest("plugins", signal ? { signal } : {});
}
export function pluginError(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 409)
    return "配置或工具声明已改变，请重新读取并审核。";
  if (cause instanceof ApiError && (cause.status === 404 || cause.status === 503))
    return "当前服务尚未启用工具插件，请检查服务配置。";
  return "操作未确认成功，请刷新当前状态后重试。";
}
