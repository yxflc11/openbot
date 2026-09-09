import type { Bot, Channel } from "@openbot/domain";
import { useEffect, useState } from "react";
import { listMessages } from "../api";
import { useModalDialog } from "./useModalDialog";

export function ShareConversationDialog({
  channel,
  bots,
  onClose,
}: {
  channel: Channel;
  bots: Bot[];
  onClose(): void;
}) {
  const { dialogRef: dialog } = useModalDialog(onClose);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("正在读取当前对话…");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void listMessages(channel.id, controller.signal)
      .then((messages) => {
        if (controller.signal.aborted) return;
        setText(
          `# ${channel.name}\n\n${messages.map((message) => `**${message.authorType === "human" ? "你" : (bots.find((bot) => bot.id === message.authorId)?.name ?? "Bot")}**\n\n${message.content}`).join("\n\n---\n\n")}`,
        );
        setLoaded(true);
        setStatus("预览最近消息。复制后可自行分享给他人。");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("无法读取对话，请关闭后重试。");
      });
    return () => controller.abort();
  }, [channel.id, channel.name, bots]);
  return (
    <dialog ref={dialog} className="modal share-dialog" aria-labelledby="share-title">
      <header>
        <h2 id="share-title">分享对话</h2>
        <button className="icon-button" type="button" aria-label="关闭分享" onClick={onClose}>
          ×
        </button>
      </header>
      <p role="status">{status}</p>
      <textarea aria-label="分享内容预览" value={text} readOnly rows={14} />
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>
          取消
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!loaded}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setStatus("已复制，可粘贴分享。");
            } catch {
              dialog.current?.querySelector("textarea")?.select();
              setStatus("请使用系统复制快捷键复制已选中的内容。");
            }
          }}
        >
          复制对话
        </button>
      </footer>
    </dialog>
  );
}
