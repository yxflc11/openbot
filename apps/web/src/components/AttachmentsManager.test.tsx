// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { interact, renderComponent, type RenderedComponent } from "../test/render-component";
import { AttachmentsManagerDialog } from "./AttachmentsManager";
const views: RenderedComponent[] = [];
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        打开频道文件
      </button>
      {open && <AttachmentsManagerDialog channelId="channel" onClose={() => setOpen(false)} />}
    </>
  );
}
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ attachments: [] })),
  );
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});
afterEach(async () => {
  for (const view of views.splice(0)) await view.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function open() {
  const view = await renderComponent(<Harness />);
  views.push(view);
  const opener = view.container.querySelector<HTMLButtonElement>("button");
  if (!opener) throw new Error("No opener");
  await interact(() => {
    opener.focus();
    opener.click();
  });
  const dialog = view.container.querySelector<HTMLDialogElement>("dialog");
  if (!dialog) throw new Error("No dialog");
  return { view, dialog, opener };
}
it("uses real modal lifecycle, focuses its heading and restores the opener on Escape", async () => {
  const { view, dialog, opener } = await open();
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  expect(dialog.open).toBe(true);
  expect(document.activeElement).toBe(dialog.querySelector("h2"));
  expect(dialog.getAttribute("aria-labelledby")).toBe(dialog.querySelector("h2")?.id);
  await interact(() => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
  expect(view.container.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});
it("closes explicitly and aborts the attachment list request on unmount", async () => {
  const pending = new Promise<Response>(() => {});
  vi.mocked(fetch).mockReturnValue(pending);
  const { view, dialog, opener } = await open();
  const signal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;
  expect(signal?.aborted).toBe(false);
  await interact(() =>
    dialog.querySelector<HTMLButtonElement>('[aria-label="关闭频道文件"]')?.click(),
  );
  expect(view.container.querySelector("dialog")).toBeNull();
  expect(signal?.aborted).toBe(true);
  expect(document.activeElement).toBe(opener);
});
it("ignores content clicks and closes only outside the dialog bounds", async () => {
  const { view, dialog, opener } = await open();
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    left: 20,
    top: 20,
    right: 400,
    bottom: 400,
  } as DOMRect);
  await interact(() =>
    dialog.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 30, clientY: 30 })),
  );
  expect(view.container.querySelector("dialog")).not.toBeNull();
  await interact(() =>
    dialog.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 })),
  );
  expect(view.container.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});
