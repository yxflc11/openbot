import { useEffect, useState } from "react";
import type { UploadedComposerAttachment } from "../composer-context";
import {
  formatAttachmentSize,
  getChannelAttachment,
  splitMessageAttachments,
} from "../channel-attachment-client";
import { AttachmentPreview } from "./AttachmentPreview";
import { RichMessage } from "./RichMessage";
import "./MessageAttachments.css";

export function MessageAttachments({ content, channelId }: { content: string; channelId: string }) {
  const { text, ids } = splitMessageAttachments(content);
  return (
    <>
      {text ? <RichMessage content={text} /> : null}
      {ids.length ? (
        <section className="message-attachments" aria-label="消息附件">
          {ids.map((id) => (
            <MessageAttachmentCard key={`${channelId}:${id}`} channelId={channelId} id={id} />
          ))}
        </section>
      ) : null}
    </>
  );
}

function MessageAttachmentCard({ channelId, id }: { channelId: string; id: string }) {
  const [attachment, setAttachment] = useState<UploadedComposerAttachment>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void getChannelAttachment(channelId, id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setAttachment(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [channelId, id]);
  return (
    <article
      className="message-attachment-card"
      aria-label={attachment ? `附件 ${attachment.name}` : "附件"}
    >
      {attachment ? (
        <>
          <AttachmentPreview attachment={attachment} />
          <span className="attachment-card-caption">
            <strong title={attachment.name}>{attachment.name}</strong>
            <small>{formatAttachmentSize(attachment.sizeBytes)}</small>
          </span>
        </>
      ) : (
        <span className="attachment-card-caption">
          {failed ? "附件暂不可用或无权访问" : "正在加载附件…"}
        </span>
      )}
    </article>
  );
}
