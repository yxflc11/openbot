export type LocalSessionRecoveryResult = Readonly<{ status: "restored" | "unavailable" }>;

interface Binding {
  url: string;
  authenticate(): Promise<void>;
  isAlive(): boolean;
}

/** Only a supervisor-owned process can bind identity; caller URLs never select credentials. */
export class LocalSessionRecovery {
  #binding: Binding | undefined;
  #pending: { binding: Binding; promise: Promise<LocalSessionRecoveryResult> } | undefined;

  bind(url: string, authenticate: () => Promise<void>, isAlive: () => boolean): void {
    this.#binding = { url, authenticate, isAlive };
  }
  clear(): void {
    this.#binding = undefined;
  }
  restore(url: string): Promise<LocalSessionRecoveryResult> {
    const binding = this.#binding;
    if (!binding || binding.url !== url || !binding.isAlive())
      return Promise.resolve({ status: "unavailable" });
    if (this.#pending?.binding === binding) return this.#pending.promise;
    const promise = Promise.resolve()
      .then(async (): Promise<LocalSessionRecoveryResult> => {
        if (this.#binding !== binding || !binding.isAlive()) return { status: "unavailable" };
        await binding.authenticate();
        return {
          status: this.#binding === binding && binding.isAlive() ? "restored" : "unavailable",
        };
      })
      .catch((): LocalSessionRecoveryResult => ({ status: "unavailable" }))
      .finally(() => {
        if (this.#pending?.promise === promise) this.#pending = undefined;
      });
    this.#pending = { binding, promise };
    return promise;
  }
}
