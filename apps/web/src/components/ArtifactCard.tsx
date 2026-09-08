import type { Artifact } from "@openbot/domain";
import { type ReactNode, useState } from "react";
import { getOpenBotDesktopBridge } from "../desktop-runtime";

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const image = artifact.mediaType === "image/png";
  return (
    <ArtifactDownloadLink
      artifact={artifact}
      className={image ? "artifact-card" : "artifact-card artifact-card-document"}
    >
      {image ? (
        <img
          src={`/api/v1/artifacts/${encodeURIComponent(artifact.id)}/content`}
          alt={artifact.name}
          loading="lazy"
        />
      ) : (
        <span className="artifact-document-icon" aria-hidden="true">
          MD
        </span>
      )}
      <span className="artifact-card-label">
        <strong>{artifact.name}</strong>
        <small>
          {image ? "图片" : "Markdown 报告"} · {formatBytes(artifact.sizeBytes)}
          {image ? "" : " · 下载"}
        </small>
      </span>
    </ArtifactDownloadLink>
  );
}

export function ArtifactDownloadLink({
  artifact,
  children,
  className,
}: {
  artifact: Artifact;
  children: ReactNode;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const image = artifact.mediaType === "image/png";
  return (
    <>
      <a
        className={className}
        href={`/api/v1/artifacts/${encodeURIComponent(artifact.id)}/content`}
        download={image ? undefined : artifact.name}
        target={image ? "_blank" : undefined}
        rel={image ? "noreferrer" : undefined}
        aria-label={image ? `查看 ${artifact.name}` : `下载 ${artifact.name}`}
        aria-busy={saving || undefined}
        onClick={async (event) => {
          const desktop = getOpenBotDesktopBridge();
          if (image || !desktop) return;
          event.preventDefault();
          if (saving) return;
          setSaving(true);
          setNotice(undefined);
          try {
            const result = await desktop.saveReport?.(artifact.id);
            setNotice(
              result?.status === "saved"
                ? "报告已保存"
                : result?.status === "cancelled"
                  ? undefined
                  : result?.status === "exists"
                    ? "文件已存在，请换一个文件名。"
                    : result?.status === "busy"
                      ? "请先完成当前保存操作。"
                      : "无法保存报告，请检查连接或更新 Desktop。",
            );
          } catch {
            setNotice("无法保存报告，请检查连接后重试。");
          } finally {
            setSaving(false);
          }
        }}
      >
        {children}
      </a>
      {notice ? (
        <small className="artifact-save-notice" role="status">
          {notice}
        </small>
      ) : null}
    </>
  );
}

function formatBytes(value: number): string {
  return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`;
}
