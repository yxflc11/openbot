import type { Bot, CreateBotInput } from "@openbot/domain";
import { useState } from "react";
import type { ApiError } from "../api";
import { CloseIcon } from "./Icons";

const computerOptions: Array<{ value: Bot["computerProfile"]; label: string }> = [
  { value: "none", label: "暂不绑定电脑" },
  { value: "docker-linux", label: "Docker Linux" },
  { value: "macos-cua", label: "macOS · Cua" },
  { value: "lume-vm", label: "Lume macOS VM" },
  { value: "coder", label: "Coder runtime" },
];

export function CreateBotDialog({
  onClose,
  onCreate,
}: {
  onClose(): void;
  onCreate(input: CreateBotInput): Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [computerProfile, setComputerProfile] = useState<Bot["computerProfile"]>("none");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onCreate({ name, role, computerProfile });
    } catch (cause) {
      setError((cause as ApiError).message ?? "无法创建 Bot。请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <dialog className="create-dialog" open aria-labelledby="create-bot-title">
        <form onSubmit={submit}>
          <header className="dialog-header">
            <div>
              <h2 id="create-bot-title">创建 Bot</h2>
              <p>创建一个持久的数字员工。</p>
            </div>
            <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
              <CloseIcon />
            </button>
          </header>
          <div className="form-grid">
            <label>
              <span>Bot 名称</span>
              <input
                autoFocus
                maxLength={64}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如 Ops"
                required
              />
            </label>
            <label>
              <span>职责</span>
              <textarea
                maxLength={160}
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="描述它负责的工作"
                required
              />
            </label>
            <label>
              <span>电脑</span>
              <select
                value={computerProfile}
                onChange={(event) =>
                  setComputerProfile(event.target.value as Bot["computerProfile"])
                }
              >
                {computerOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>Bot 是员工，电脑只是可以替换的执行节点。</small>
            </label>
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <footer>
            <button className="secondary-button" type="button" onClick={onClose}>
              取消
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "创建中…" : "创建 Bot"}
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
