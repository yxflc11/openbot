// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ComposerAttachment, uploadComposerAttachment } from "../composer-context";
import { deferred, interact, renderComponent } from "../test/render-component";
import { ComposerAttachmentPicker } from "./ComposerAttachmentPicker";

vi.mock("../composer-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../composer-context")>()),
  uploadComposerAttachment: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
const channelId = "00000000-0000-4000-8000-000000000001";
function uploaded(name: string, id = "00000000-0000-4000-8000-000000000011") {
  return {
    id,
    channelId,
    name,
    mediaType: "text/plain" as const,
    sizeBytes: 4,
    sha256: "a".repeat(64),
    createdAt: "2026-09-10T00:00:00.000Z",
  };
}
async function pick(input: HTMLInputElement | null, files: File[]) {
  if (!input) throw new Error("Attachment input is missing.");
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await interact(() => input.dispatchEvent(new Event("change", { bubbles: true })));
}

describe("persistent composer attachment selection", () => {
  it("uploads multiple files while appending to the latest draft attachment list", async () => {
    const first = deferred<ReturnType<typeof uploaded>>();
    vi.mocked(uploadComposerAttachment)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(uploaded("second.py", "00000000-0000-4000-8000-000000000012"));
    let current: ComposerAttachment[] = [];
    const onChange = vi.fn((next: ComposerAttachment[]) => {
      current = next;
    });
    const onUploadingChange = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    const view = await renderComponent(
      <ComposerAttachmentPicker
        channelId={channelId}
        attachments={[]}
        getAttachments={() => current}
        onChange={onChange}
        inputRef={inputRef}
        onUploadingChange={onUploadingChange}
      />,
    );
    try {
      await pick(inputRef.current, [
        new File(["data"], "first.ts"),
        new File(["data"], "second.py"),
      ]);
      expect(inputRef.current?.multiple).toBe(true);
      expect(onUploadingChange).toHaveBeenLastCalledWith(true);
      current = [{ name: "added-during-upload.md", text: "keep" }];
      await interact(() => first.resolve(uploaded("first.ts")));
      expect(current.map((item) => item.name)).toEqual([
        "added-during-upload.md",
        "first.ts",
        "second.py",
      ]);
      expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    } finally {
      await view.unmount();
    }
  });
  it("retains successful attachments and shows a later upload failure", async () => {
    vi.mocked(uploadComposerAttachment)
      .mockResolvedValueOnce(uploaded("first.ts"))
      .mockRejectedValueOnce(new Error("连接中断"));
    let current: ComposerAttachment[] = [];
    const inputRef = createRef<HTMLInputElement>();
    const view = await renderComponent(
      <ComposerAttachmentPicker
        channelId={channelId}
        attachments={[]}
        getAttachments={() => current}
        onChange={(next) => {
          current = next;
        }}
        inputRef={inputRef}
      />,
    );
    try {
      await pick(inputRef.current, [
        new File(["data"], "first.ts"),
        new File(["data"], "second.py"),
      ]);
      expect(current.map((item) => item.name)).toEqual(["first.ts"]);
      expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("连接中断");
    } finally {
      await view.unmount();
    }
  });
  it("rejects duplicate/oversized batches before uploading", async () => {
    const inputRef = createRef<HTMLInputElement>();
    const current = [uploaded("first.ts")];
    const onChange = vi.fn();
    const view = await renderComponent(
      <ComposerAttachmentPicker
        channelId={channelId}
        attachments={current}
        getAttachments={() => current}
        onChange={onChange}
        inputRef={inputRef}
      />,
    );
    try {
      await pick(inputRef.current, [new File(["data"], "first.ts")]);
      expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("同名附件");
      expect(uploadComposerAttachment).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      await view.unmount();
    }
  });
  it("aborts an unmounted picker without appending its late upload result", async () => {
    const pending = deferred<ReturnType<typeof uploaded>>();
    vi.mocked(uploadComposerAttachment).mockReturnValue(pending.promise);
    const onChange = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    const view = await renderComponent(
      <ComposerAttachmentPicker
        channelId={channelId}
        attachments={[]}
        getAttachments={() => []}
        onChange={onChange}
        inputRef={inputRef}
      />,
    );
    await pick(inputRef.current, [new File(["data"], "first.ts")]);
    const signal = vi.mocked(uploadComposerAttachment).mock.calls[0]?.[2];
    await view.unmount();
    expect(signal?.aborted).toBe(true);
    await interact(() => pending.resolve(uploaded("first.ts")));
    expect(onChange).not.toHaveBeenCalled();
  });
});
