import type { Artifact, Bot, Channel, Run } from "@openbot/domain";
import { useEffect, useState } from "react";
import { ArtifactDownloadLink } from "./ArtifactCard";
import { useModalDialog } from "./useModalDialog";

export function ShareConversationDialog({
  channel,
  bots,
  artifacts,
  runs,
  onShareBot,
  onClose,
}: {
  channel: Channel;
  bots: Bot[];
  artifacts: Artifact[];
  runs: Run[];
  onShareBot(botId: string): void;
  onClose(): void;
}) {
  const { dialogRef: dialog } = useModalDialog(onClose);
  const members = bots.filter((bot) => channel.botIds.includes(bot.id));
  const [botId, setBotId] = useState(members[0]?.id ?? "");
  const [preview, setPreview] = useState<Artifact>();
  const [text, setText] = useState("");
  const [previewState, setPreviewState] = useState("");
  const channelRuns = new Set(
    runs.filter((run) => run.channelId === channel.id).map((run) => run.id),
  );
  const files = artifacts.filter((artifact) => channelRuns.has(artifact.runId));
  const validBot = members.some((bot) => bot.id === botId);

  useEffect(() => {
    if (validBot) return;
    setBotId(members[0]?.id ?? "");
  }, [validBot, members]);

  useEffect(() => {
    setText("");
    if (!preview) return;
    const controller = new AbortController();
    setPreviewState("正在读取文件…");
    void fetch(`/api/v1/artifacts/${encodeURIComponent(preview.id)}/content`, {
      credentials: "include",
      signal: controller.signal,
      redirect: "error",
    })
      .then(async (response) => {
        if (!response.ok || response.headers.get("content-type") !== "text/markdown")
          throw new Error("无法读取文件。");
        const content = await response.text();
        if (controller.signal.aborted) return;
        setText(content);
        setPreviewState("请检查内容后再分享。");
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreviewState("无法读取文件，请重新打开预览。");
      });
    return () => controller.abort();
  }, [preview]);

  return (
    <dialog ref={dialog} className="modal share-dialog" aria-labelledby="share-title">
      <header>
        <h2 id="share-title">分享</h2>
        <button className="icon-button" type="button" aria-label="关闭分享" onClick={onClose}>
          ×
        </button>
      </header>
      <section aria-labelledby="share-files-title">
        <h3 id="share-files-title">最近产出文件</h3>
        <p>显示当前已加载任务的文件。</p>
        {files.length === 0 ? (
          <p>当前没有已加载的产出文件。Bot 完成新任务后会显示在这里。</p>
        ) : (
          <ul className="share-file-list">
            {files.map((artifact) => (
              <li key={artifact.id}>
                <div>
                  <strong>{artifact.name}</strong>
                  <small>
                    {artifact.mediaType === "image/png" ? "PNG 图片" : "Markdown 文件"} ·{" "}
                    {(artifact.sizeBytes / 1024).toFixed(1)} KB
                  </small>
                </div>
                {artifact.mediaType === "text/markdown" ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setPreview({ ...artifact })}
                  >
                    预览
                  </button>
                ) : null}
                <ArtifactDownloadLink
                  artifact={artifact}
                  downloadImage
                  className="secondary-button"
                >
                  下载
                </ArtifactDownloadLink>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="share-template-title">
        <h3 id="share-template-title">分享 Bot</h3>
        <p>将 Bot 导出为员工模板，其他人可以导入自己的 OpenBot。</p>
        <div className="share-template-actions">
          <select
            aria-label="要分享的 Bot"
            value={botId}
            disabled={!members.length}
            onChange={(event) => setBotId(event.target.value)}
          >
            {members.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            type="button"
            disabled={!validBot}
            onClick={() => {
              if (validBot) onShareBot(botId);
            }}
          >
            预览 Bot 模板
          </button>
        </div>
        <p>
          {members.length === 0
            ? "请先在这个频道加入一个 Bot。"
            : "包含角色、外观和已验证技能；可选择分享已审核的技能正文，记忆、密钥与电脑权限不会随包分享。"}
        </p>
      </section>
      {preview ? (
        <section aria-label="文件预览">
          <h3>{preview.name}</h3>
          <p role="status">{previewState}</p>
          <textarea aria-label="文件内容预览" value={text} readOnly rows={10} />
          <button
            type="button"
            className="secondary-button"
            disabled={!text}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setPreviewState("已复制文件内容。");
              } catch {
                dialog.current?.querySelector("textarea")?.select();
                setPreviewState("请使用系统复制快捷键复制已选中的内容。");
              }
            }}
          >
            复制内容
          </button>
        </section>
      ) : null}
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>
          关闭
        </button>
      </footer>
    </dialog>
  );
}
