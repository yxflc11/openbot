import type { Bot, EmployeeSkill, EmployeeSkillState } from "@openbot/domain";
import { type ReactNode, useEffect, useState } from "react";
import { getEmployeeProfile } from "../api";
import { SearchIcon } from "./Icons";
import "./destinations.css";

interface SkillEntry {
  botId: string;
  skill: EmployeeSkill;
}

const states: { value: EmployeeSkillState | "all"; label: string }[] = [
  { value: "all", label: "全部技能" },
  { value: "verified", label: "已验证" },
  { value: "candidate", label: "待审核" },
  { value: "suspended", label: "已暂停" },
  { value: "revoked", label: "已撤销" },
];
const sourceLabels: Record<EmployeeSkill["source"], string> = {
  "built-in": "内置",
  installed: "已安装",
  learned: "学习获得",
  imported: "导入",
  manual: "手动添加",
};

export function SkillLibraryScreen({
  bots,
  onOpenBot,
  headerAction,
}: {
  bots: Bot[];
  onOpenBot(botId: string): void;
  headerAction?: ReactNode;
}) {
  const [entries, setEntries] = useState<SkillEntry[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<EmployeeSkillState | "all">("all");
  const requestKey = JSON.stringify({ ids: bots.map((bot) => bot.id).sort(), revision });

  useEffect(() => {
    const controller = new AbortController();
    const { ids } = JSON.parse(requestKey) as { ids: string[] };
    const nextEntries: SkillEntry[] = [];
    const failed: string[] = [];
    let cursor = 0;
    setLoading(true);
    setEntries([]);
    setFailedIds([]);
    // Bound parallel reads so a large workspace cannot flood the authenticated Server.
    const readers = Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (cursor < ids.length && !controller.signal.aborted) {
        const id = ids[cursor++];
        if (id === undefined) break;
        try {
          const profile = await getEmployeeProfile(
            id,
            AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
          );
          nextEntries.push(...profile.skills.map((skill) => ({ botId: id, skill })));
        } catch {
          failed.push(id);
        }
      }
    });
    void Promise.all(readers).then(() => {
      if (controller.signal.aborted) return;
      setEntries(
        nextEntries.sort((left, right) => left.skill.name.localeCompare(right.skill.name)),
      );
      setFailedIds(failed);
      setLoading(false);
    });
    return () => controller.abort();
  }, [requestKey]);

  const names = new Map(bots.map((bot) => [bot.id, bot.name]));
  const term = query.trim().toLocaleLowerCase();
  const filtered = entries.filter(
    ({ skill, botId }) =>
      (state === "all" || skill.state === state) &&
      `${skill.name} ${skill.slug} ${skill.description} ${names.get(botId) ?? ""}`
        .toLocaleLowerCase()
        .includes(term),
  );

  return (
    <main className="workspace-destination" aria-labelledby="skill-library-title">
      <header className="destination-header">
        <h1 id="skill-library-title">技能广场</h1>
        <div className="destination-header-actions">{headerAction}</div>
      </header>
      <div className="destination-scroll">
        <section className="destination-intro">
          <h2>让每个 Bot 的经验可见</h2>
          <p>查看工作空间中已有的技能，了解来源，并在 Bot 档案中审核。</p>
        </section>
        <div className="destination-toolbar">
          <search className="destination-search" aria-label="搜索技能">
            <SearchIcon />
            <input
              type="search"
              aria-label="搜索技能或 Bot"
              placeholder="搜索技能或 Bot"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </search>
          <button
            type="button"
            className="destination-secondary"
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            刷新
          </button>
        </div>
        <fieldset className="destination-filters" aria-label="技能状态">
          {states.map((item) => (
            <button
              type="button"
              key={item.value}
              aria-pressed={state === item.value}
              onClick={() => setState(item.value)}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
        {failedIds.length > 0 ? (
          <div className="destination-notice" role="alert">
            未能读取 {failedIds.map((id) => names.get(id) ?? "Bot").join("、")} 的技能，请刷新重试。
          </div>
        ) : null}
        {loading ? (
          <p className="destination-empty" role="status">
            正在读取技能…
          </p>
        ) : filtered.length === 0 ? (
          <div className="destination-empty">
            <h3>
              {query || state !== "all"
                ? "没有匹配的技能"
                : failedIds.length > 0
                  ? "技能暂时无法读取"
                  : "技能会在这里汇集"}
            </h3>
            <p>
              {query || state !== "all"
                ? "试试其他关键词或状态。"
                : "Bot 档案中的技能和审核状态会同步显示在这里。"}
            </p>
          </div>
        ) : (
          <>
            <p className="destination-result-count" role="status">
              {filtered.length} 项技能记录
            </p>
            <div className="destination-skill-list">
              {filtered.map(({ skill, botId }) => (
                <article className="destination-skill" key={`${botId}:${skill.id}`}>
                  <div className="destination-skill-top">
                    <span className="destination-skill-monogram" aria-hidden="true">
                      {skill.name.slice(0, 1)}
                    </span>
                    <div className="destination-skill-heading">
                      <h3>{skill.name}</h3>
                      <span>
                        {skill.slug} · v{skill.version}
                      </span>
                    </div>
                    <span className={`destination-state ${skill.state}`}>
                      {states.find((item) => item.value === skill.state)?.label}
                    </span>
                  </div>
                  <p>{skill.description}</p>
                  <div className="destination-skill-meta">
                    <span>{sourceLabels[skill.source]}</span>
                    <span>
                      {skill.requiredCapabilities.length > 0
                        ? `需要 ${skill.requiredCapabilities.join("、")}`
                        : "无额外能力要求"}
                    </span>
                  </div>
                  <div className="destination-skill-footer">
                    <span>{names.get(botId) ?? "Bot"}</span>
                    <button
                      className="destination-text-button"
                      type="button"
                      onClick={() => onOpenBot(botId)}
                    >
                      查看与审核 <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        <p className="destination-footnote">
          这里展示当前工作空间的技能记录。外部技能商店尚未接入。
        </p>
      </div>
    </main>
  );
}
