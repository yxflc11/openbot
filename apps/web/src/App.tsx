import type { BootstrapSummary } from "@openbot/domain";
import { useEffect, useState } from "react";

const navigation = ["Office", "Channels", "Bots", "Routines", "Skills", "Nodes", "Audit"];

export function App() {
  const [summary, setSummary] = useState<BootstrapSummary | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      try {
        const response = await fetch("/api/v1/bootstrap", { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}.`);
        }
        setSummary((await response.json()) as BootstrapSummary);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }
        setError(cause instanceof Error ? cause.message : "Unable to reach OpenBot Server.");
      }
    }

    void loadSummary();
    return () => controller.abort();
  }, []);

  return (
    <div className="app-shell">
      <aside className="navigation" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="OpenBot home">
          OpenBot
        </a>
        <nav>
          {navigation.map((item, index) => (
            <button
              className={index === 0 ? "nav-item active" : "nav-item"}
              type="button"
              key={item}
            >
              {item}
              {(item === "Channels" || item === "Bots") && <span aria-hidden="true">+</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="foundation">
        <header>
          <p>Foundation workspace</p>
          <h1>The control plane is ready for the first product slice.</h1>
          <p>
            This screen intentionally verifies repository wiring only. The selected Marvis-style
            office interface will be implemented from its approved visual specification.
          </p>
        </header>

        <section className="boundaries" aria-labelledby="boundaries-heading">
          <h2 id="boundaries-heading">Runtime boundaries</h2>
          <dl>
            <div>
              <dt>Bot</dt>
              <dd>Digital employee</dd>
            </div>
            <div>
              <dt>Node</dt>
              <dd>Replaceable computer</dd>
            </div>
            <div>
              <dt>Channel</dt>
              <dd>Long-lived workspace</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd>One auditable task</dd>
            </div>
          </dl>
        </section>
      </main>

      <aside className="runtime" aria-label="Runtime status">
        <p className="section-label">Runtime status</p>
        {error !== undefined ? (
          <p className="error">Server unavailable: {error}</p>
        ) : summary === undefined ? (
          <p className="muted">Connecting to OpenBot Server…</p>
        ) : (
          <dl className="metrics">
            <Metric label="Channels" value={summary.counts.channels} />
            <Metric label="Bots" value={summary.counts.bots} />
            <Metric label="Connected nodes" value={summary.counts.connectedNodes} />
            <Metric label="Active runs" value={summary.counts.activeRuns} />
          </dl>
        )}
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
