import type { Bot, CreateChannelInput } from "@openbot/domain";
import { useState } from "react";
import type { ApiError } from "../api";
import { CheckIcon, CloseIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";
import { useModalDialog } from "./useModalDialog";

export function CreateChannelDialog({
  bots,
  onClose,
  onCreate,
}: {
  bots: Bot[];
  onClose(): void;
  onCreate(input: CreateChannelInput): Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [botIds, setBotIds] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { dialogRef, closeDialog } = useModalDialog(onClose);

  function toggleBot(botId: string) {
    setBotIds((current) =>
      current.includes(botId) ? current.filter((id) => id !== botId) : [...current, botId],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onCreate({ name, description, botIds });
    } catch (cause) {
      setError((cause as ApiError).message ?? "无法创建频道。请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <dialog
        ref={dialogRef}
        className="create-dialog channel-dialog"
        aria-labelledby="create-channel-title"
      >
        <form onSubmit={submit}>
          <header className="dialog-header">
            <div>
              <h2 id="create-channel-title">创建频道</h2>
              <p>定义一个长期工作空间和初始团队。</p>
            </div>
            <button className="icon-button" type="button" aria-label="关闭" onClick={closeDialog}>
              <CloseIcon />
            </button>
          </header>
          <div className="form-grid">
            <label>
              <span>频道名称</span>
              <input
                autoFocus
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如 运营中心"
                required
              />
            </label>
            <label>
              <span>工作目标</span>
              <textarea
                maxLength={500}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="描述这个频道负责的目标、职责与预期产出"
              />
            </label>
            <fieldset>
              <legend>选择参与的 Bot</legend>
              {bots.length === 0 ? (
                <p className="field-empty">还没有 Bot。可以先创建空频道，之后再添加。</p>
              ) : (
                <div className="bot-options">
                  {bots.map((bot) => {
                    const selected = botIds.includes(bot.id);
                    return (
                      <label
                        className={selected ? "bot-option selected" : "bot-option"}
                        key={bot.id}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleBot(bot.id)}
                        />
                        <span className="custom-check">{selected ? <CheckIcon /> : null}</span>
                        <RobotAvatar bot={bot} compact />
                        <span>
                          <strong>{bot.name}</strong>
                          <small>{bot.role}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <footer>
            <button className="secondary-button" type="button" onClick={closeDialog}>
              取消
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "创建中…" : "创建频道"}
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
