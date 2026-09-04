import type { EmployeeEvolutionEvent } from "@openbot/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmployeeEvolutionArchive, selectEvolutionArchiveEvents } from "./EmployeeEvolutionArchive";

const events: EmployeeEvolutionEvent[] = [
  {
    id: "event-3",
    botId: "employee-1",
    type: "skill_verified",
    title: "Verified source triangulation",
    summary: "The Owner reviewed the evaluation run.",
    source: "manual",
    sourceId: "review-3",
    evidence: [{ kind: "run", id: "run-3", label: "Evaluation run" }],
    createdAt: "2026-09-03T12:00:00.000Z",
  },
  {
    id: "event-1",
    botId: "employee-1",
    type: "created",
    title: "Employee created",
    summary: "The Employee identity was created.",
    source: "manual",
    evidence: [],
    createdAt: "2026-09-01T12:00:00.000Z",
  },
  {
    id: "event-2",
    botId: "employee-1",
    type: "skill_discovered",
    title: "Discovered source triangulation",
    summary: "A candidate skill was recorded.",
    source: "run",
    sourceId: "run-2",
    evidence: [{ kind: "artifact", id: "artifact-2" }],
    createdAt: "2026-09-02T12:00:00.000Z",
  },
];

describe("EmployeeEvolutionArchive", () => {
  it("orders the visible cutoff newest-first while preserving a truthful dated prefix", () => {
    expect(selectEvolutionArchiveEvents(events, "all", 2).map((event) => event.id)).toEqual([
      "event-2",
      "event-1",
    ]);
  });

  it("filters by the stored event type", () => {
    expect(
      selectEvolutionArchiveEvents(events, "skill_discovered").map((event) => event.id),
    ).toEqual(["event-2"]);
  });

  it("renders complete provenance without turning evidence references into implicit fetches", () => {
    const html = renderToStaticMarkup(<EmployeeEvolutionArchive events={events} />);

    expect(html).toContain("Evaluation run");
    expect(html).toContain("run-3");
    expect(html).toContain("artifact-2");
    expect(html).toContain("Hermes Agent Learning Journey");
    expect(html).not.toContain("href=");
  });
});
