import type { CreateBotInput, CreateChannelInput, WorkspaceSnapshot } from "@openbot/domain";
import { useCallback, useEffect, useState } from "react";
import { createBot, createChannel, getWorkspace, joinBotToChannel } from "./api";
import { ChannelWorkspace } from "./components/ChannelWorkspace";
import { ContextRail } from "./components/ContextRail";
import { CreateBotDialog } from "./components/CreateBotDialog";
import { CreateChannelDialog } from "./components/CreateChannelDialog";
import { type MobilePanel, MobileNavigation } from "./components/MobileNavigation";
import { Office } from "./components/Office";
import { Sidebar } from "./components/Sidebar";

type Dialog = "bot" | "channel" | undefined;

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>();
  const [selectedChannelId, setSelectedChannelId] = useState<string>();
  const [dialog, setDialog] = useState<Dialog>();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setError(undefined);
    try {
      setWorkspace(await getWorkspace(signal));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(
        cause instanceof Error ? cause.message : "无法连接 OpenBot Server。请确认服务已启动。",
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  async function handleCreateBot(input: CreateBotInput) {
    const bot = await createBot(input);
    await refresh();
    setDialog(undefined);
    showNotice(`${bot.name} 已创建。`);
  }

  async function handleCreateChannel(input: CreateChannelInput) {
    const channel = await createChannel(input);
    await refresh();
    setSelectedChannelId(channel.id);
    setDialog(undefined);
    setMobilePanel(undefined);
    showNotice(`${channel.name} 已创建。`);
  }

  async function handleJoinBot(botId: string) {
    if (selectedChannelId === undefined) return;
    await joinBotToChannel(selectedChannelId, botId);
    await refresh();
    showNotice("Bot 已加入频道。");
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(undefined), 3000);
  }

  function selectChannel(channelId: string) {
    setSelectedChannelId(channelId);
    setMobilePanel(undefined);
  }

  if (workspace === undefined) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">O</span>
        <h1>{error ? "无法打开 OpenBot" : "正在连接 OpenBot"}</h1>
        <p>{error ?? "正在读取本地频道、Bots 与节点状态…"}</p>
        {error ? (
          <button className="primary-button" type="button" onClick={() => refresh()}>
            重新连接
          </button>
        ) : null}
      </main>
    );
  }

  const selectedChannel = workspace.channels.find((channel) => channel.id === selectedChannelId);

  return (
    <div className="app-shell">
      <Sidebar
        bots={workspace.bots}
        channels={workspace.channels}
        selectedChannelId={selectedChannel?.id}
        onOffice={() => setSelectedChannelId(undefined)}
        onSelectChannel={selectChannel}
        onCreateBot={() => setDialog("bot")}
        onCreateChannel={() => setDialog("channel")}
      />

      {selectedChannel ? (
        <ChannelWorkspace channel={selectedChannel} bots={workspace.bots} onJoin={handleJoinBot} />
      ) : (
        <Office
          bots={workspace.bots}
          channels={workspace.channels}
          onCreateBot={() => setDialog("bot")}
          onCreateChannel={() => setDialog("channel")}
        />
      )}

      <ContextRail workspace={workspace} />

      <MobileNavigation
        panel={mobilePanel}
        bots={workspace.bots}
        channels={workspace.channels}
        nodes={workspace.nodes}
        onPanel={setMobilePanel}
        onOffice={() => {
          setSelectedChannelId(undefined);
          setMobilePanel(undefined);
        }}
        onCreateBot={() => {
          setMobilePanel(undefined);
          setDialog("bot");
        }}
        onCreateChannel={() => {
          setMobilePanel(undefined);
          setDialog("channel");
        }}
        onSelectChannel={selectChannel}
      />

      {dialog === "bot" ? (
        <CreateBotDialog onClose={() => setDialog(undefined)} onCreate={handleCreateBot} />
      ) : null}
      {dialog === "channel" ? (
        <CreateChannelDialog
          bots={workspace.bots}
          onClose={() => setDialog(undefined)}
          onCreate={handleCreateChannel}
        />
      ) : null}
      {notice ? (
        <div className="toast" role="status">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
