import { DESKTOP_ENTRY_URL } from "./local-content.js";

const MICROPHONE_LEASE_MS = 10_000;

/** Grants acquisition only; the caller must stop acquired MediaStream tracks separately. */
export class DesktopMicrophonePolicy {
  #lease: { contentsId: number; expiresAt: number } | undefined;
  #generation = 0;
  constructor(private readonly now: () => number = Date.now) {}

  beginAttempt(): number {
    this.revoke();
    return this.#generation;
  }

  arm(contentsId: number, generation = this.#generation): boolean {
    if (generation !== this.#generation) return false;
    this.#lease = { contentsId, expiresAt: this.now() + MICROPHONE_LEASE_MS };
    return true;
  }

  revoke(): void {
    this.#lease = undefined;
    this.#generation++;
  }

  allows(input: {
    contentsId?: number | undefined;
    permission: string;
    requestingUrl?: string;
    isMainFrame: boolean;
    mediaTypes?: readonly string[] | undefined;
    securityOrigin?: string;
  }): boolean {
    return (
      this.#lease !== undefined &&
      this.now() < this.#lease.expiresAt &&
      input.contentsId === this.#lease.contentsId &&
      input.permission === "media" &&
      input.isMainFrame &&
      input.requestingUrl === DESKTOP_ENTRY_URL &&
      (input.securityOrigin === undefined || input.securityOrigin === "openbot://app") &&
      input.mediaTypes?.length === 1 &&
      input.mediaTypes[0] === "audio"
    );
  }
}
