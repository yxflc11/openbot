import { type RefObject, useEffect, useRef, useState } from "react";
import {
  type ComposerAttachment,
  COMPOSER_ATTACHMENT_ACCEPT,
  uploadComposerAttachment,
  validateComposerAttachmentBatch,
} from "../composer-context";

export interface ComposerAttachmentPickerProps {
  channelId: string;
  attachments: ComposerAttachment[];
  getAttachments(): ComposerAttachment[];
  onChange(next: ComposerAttachment[]): void;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  onUploadingChange?(busy: boolean): void;
}

export function ComposerAttachmentPicker(props: ComposerAttachmentPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const latest = useRef(props);
  latest.current = props;
  const pending = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    setError(undefined);
    setUploading(false);
    return () => {
      pending.current?.abort(new Error(`Attachment channel ${props.channelId} changed or closed.`));
      pending.current = undefined;
      latest.current.onUploadingChange?.(false);
    };
  }, [props.channelId]);

  async function upload(files: File[]) {
    if (!files.length || pending.current || props.disabled) return;
    setError(undefined);
    const controller = new AbortController();
    pending.current = controller;
    const channelId = props.channelId;
    setUploading(true);
    props.onUploadingChange?.(true);
    try {
      validateComposerAttachmentBatch(latest.current.getAttachments(), files);
      for (const file of files) {
        const uploaded = await uploadComposerAttachment(channelId, file, controller.signal);
        if (controller.signal.aborted || latest.current.channelId !== channelId) return;
        // Append to the current attachment list; async uploads never restore an older text/skill draft.
        const current = latest.current.getAttachments();
        validateComposerAttachmentBatch(current, [file]);
        latest.current.onChange([...current, uploaded]);
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "附件上传失败。");
    } finally {
      if (pending.current === controller) {
        pending.current = undefined;
        setUploading(false);
        latest.current.onUploadingChange?.(false);
      }
    }
  }

  return (
    <>
      <input
        hidden
        ref={props.inputRef}
        type="file"
        multiple
        accept={COMPOSER_ATTACHMENT_ACCEPT}
        aria-label="选择附件"
        disabled={props.disabled || uploading}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void upload(files);
        }}
      />
      <div className="composer-chips">
        {props.attachments.map((attachment, index) => (
          <span
            className="context-chip"
            key={attachment.id ?? `${attachment.name}-${index}`}
            title={
              attachment.id
                ? `${attachment.name} · ${Math.ceil(attachment.sizeBytes / 1024)} KB · 已上传`
                : attachment.name
            }
          >
            <span>↗ {attachment.name}</span>
            <button
              type="button"
              aria-label={`移除附件 ${attachment.name}`}
              disabled={props.disabled}
              onClick={() =>
                latest.current.onChange(
                  latest.current.getAttachments().filter((item) => item !== attachment),
                )
              }
            >
              ×
            </button>
          </span>
        ))}
        {uploading ? <small role="status">正在上传附件…</small> : null}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
