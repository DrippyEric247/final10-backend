import { useMemo } from "react";
import type { BattlePassProgressDebugEntry } from "../../types/battlePassState";
import type { BattlePassActionEvent } from "../../types/battlePassActionEvents";

export type BattlePassEventTraceProps = {
  entries: BattlePassProgressDebugEntry[];
  /** id → title for showing human-readable task names */
  taskTitleLookup: Record<string, string>;
  /** Max action groups to show (newest first) */
  maxGroups?: number;
};

const STEP_RE = /^step (\d+): (\S+) id=(.+)$/;
const COMPLETED_RE = /^completed task (.+)$/;
const COMPLETED_TAIL_RE = /→ completed:(.+)$/;

function groupKey(e: BattlePassProgressDebugEntry): string | number {
  if (e.traceGroupId !== undefined) return e.traceGroupId;
  return e.at;
}

function groupEntries(entries: BattlePassProgressDebugEntry[]): BattlePassProgressDebugEntry[][] {
  if (entries.length === 0) return [];
  const groups: BattlePassProgressDebugEntry[][] = [];
  let bucket: BattlePassProgressDebugEntry[] = [];
  let key: string | number | undefined;

  for (const e of entries) {
    const k = groupKey(e);
    if (bucket.length === 0) {
      bucket.push(e);
      key = k;
      continue;
    }
    if (k === key) {
      bucket.push(e);
    } else {
      groups.push(bucket);
      bucket = [e];
      key = k;
    }
  }
  if (bucket.length) groups.push(bucket);
  return groups;
}

function parseSyntheticCompletedIds(message: string): string[] {
  const m = message.match(COMPLETED_TAIL_RE);
  if (!m) return [];
  const tail = m[1].trim();
  if (tail === "—" || tail === "-" || tail === "none") return [];
  return tail
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatRelativeTime(at: number): string {
  const sec = Math.round((Date.now() - at) / 1000);
  if (sec < 4) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function formatClock(at: number): string {
  try {
    return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function ClampedValue({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  return (
    <span className={`f10-bp-dev-trace-clamp ${className ?? ""}`} title={value}>
      {value}
    </span>
  );
}

function isDuplicateOfRoot(stepType: string, stepId: string, root: BattlePassActionEvent | undefined): boolean {
  if (!root) return false;
  return stepType === root.type && stepId === root.id;
}

type RowKind = "event" | "matched" | "completed" | "halt" | "info";

function classifyEngineLine(
  message: string,
  root: BattlePassActionEvent | undefined
): { kind: RowKind; stepLabel: string; eventType?: string; eventId?: string; taskId?: string } | null {
  const halt = message.startsWith("halted:");
  if (halt) {
    return { kind: "halt", stepLabel: "Halted", eventType: undefined, eventId: undefined };
  }

  const completed = message.match(COMPLETED_RE);
  if (completed) {
    return {
      kind: "completed",
      stepLabel: "Task completed",
      taskId: completed[1].trim(),
    };
  }

  const step = message.match(STEP_RE);
  if (step) {
    const n = Number(step[1]);
    const eventType = step[2];
    const eventId = step[3];
    if (n === 1 && isDuplicateOfRoot(eventType, eventId, root)) {
      return null;
    }
    return {
      kind: "matched",
      stepLabel: `Step ${n}`,
      eventType,
      eventId,
    };
  }

  return {
    kind: "info",
    stepLabel: "Log",
    eventType: undefined,
    eventId: undefined,
  };
}

export function BattlePassEventTrace({ entries, taskTitleLookup, maxGroups = 12 }: BattlePassEventTraceProps) {
  const groups = useMemo(() => {
    const g = groupEntries(entries);
    return g.slice(-maxGroups).reverse();
  }, [entries, maxGroups]);

  if (groups.length === 0) return null;

  return (
    <div className="f10-bp-dev-trace" role="log" aria-label="Battle pass event trace">
      <ul className="f10-bp-dev-trace-groups">
        {groups.map((group, gi) => {
          const root = group.find((e) => e.event)?.event;
          const groupAt = Math.max(...group.map((e) => e.at));

          return (
            <li key={`${groupKey(group[0])}-${gi}`} className="f10-bp-dev-trace-group">
              <div className="f10-bp-dev-trace-group-meta">
                <span className="f10-bp-dev-trace-group-time" title={new Date(groupAt).toISOString()}>
                  {formatRelativeTime(groupAt)}
                </span>
                <span className="f10-bp-dev-trace-group-clock">{formatClock(groupAt)}</span>
              </div>
              <ul className="f10-bp-dev-trace-rows">
                {group.map((entry, ri) => {
                  if (entry.event) {
                    const completedIds = parseSyntheticCompletedIds(entry.message);
                    const completionLabel =
                      completedIds.length === 0
                        ? "No tasks completed"
                        : completedIds
                            .map((id) => {
                              const title = taskTitleLookup[id];
                              return title ? `${title}` : id;
                            })
                            .join(", ");
                    const completionStatus = completedIds.length > 0 ? "Completed" : "Not completed";

                    return (
                      <li key={`e-${entry.at}-${ri}`} className="f10-bp-dev-trace-row f10-bp-dev-trace-row--event">
                        <div className="f10-bp-dev-trace-row-top">
                          <span className="f10-bp-dev-trace-badge f10-bp-dev-trace-badge--event">Event</span>
                          <span className="f10-bp-dev-trace-step">Incoming action</span>
                        </div>
                        <div className="f10-bp-dev-trace-fields">
                          <div className="f10-bp-dev-trace-field">
                            <span className="f10-bp-dev-trace-k">Type</span>
                            <ClampedValue value={entry.event.type} className="f10-bp-dev-trace-mono" />
                          </div>
                          <div className="f10-bp-dev-trace-field">
                            <span className="f10-bp-dev-trace-k">Id</span>
                            <ClampedValue value={entry.event.id} className="f10-bp-dev-trace-mono" />
                          </div>
                          <div className="f10-bp-dev-trace-field">
                            <span className="f10-bp-dev-trace-k">Status</span>
                            <span
                              className={
                                completedIds.length > 0
                                  ? "f10-bp-dev-trace-status f10-bp-dev-trace-status--ok"
                                  : "f10-bp-dev-trace-status f10-bp-dev-trace-status--pending"
                              }
                              title={completionStatus}
                            >
                              {completionStatus}
                            </span>
                          </div>
                          <div className="f10-bp-dev-trace-field f10-bp-dev-trace-field--full">
                            <span className="f10-bp-dev-trace-k">Completed tasks</span>
                            <span className="f10-bp-dev-trace-completion" title={completedIds.join(", ") || undefined}>
                              {completionLabel}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  }

                  const classified = classifyEngineLine(entry.message, root);
                  if (!classified) return null;

                  if (classified.kind === "info") {
                    return (
                      <li key={`i-${entry.at}-${ri}`} className="f10-bp-dev-trace-row f10-bp-dev-trace-row--info">
                        <div className="f10-bp-dev-trace-row-top">
                          <span className="f10-bp-dev-trace-badge f10-bp-dev-trace-badge--info">Info</span>
                          <span className="f10-bp-dev-trace-step">{classified.stepLabel}</span>
                        </div>
                        <p className="f10-bp-dev-trace-msg" title={entry.message}>
                          {entry.message}
                        </p>
                      </li>
                    );
                  }

                  if (classified.kind === "halt") {
                    return (
                      <li key={`h-${entry.at}-${ri}`} className="f10-bp-dev-trace-row f10-bp-dev-trace-row--halt">
                        <div className="f10-bp-dev-trace-row-top">
                          <span className="f10-bp-dev-trace-badge f10-bp-dev-trace-badge--halt">Limit</span>
                          <span className="f10-bp-dev-trace-step">{classified.stepLabel}</span>
                        </div>
                        <p className="f10-bp-dev-trace-msg">{entry.message}</p>
                      </li>
                    );
                  }

                  if (classified.kind === "completed" && classified.taskId) {
                    const tid = classified.taskId;
                    const title = taskTitleLookup[tid];
                    return (
                      <li key={`c-${entry.at}-${ri}-${tid}`} className="f10-bp-dev-trace-row f10-bp-dev-trace-row--completed">
                        <div className="f10-bp-dev-trace-row-top">
                          <span className="f10-bp-dev-trace-badge f10-bp-dev-trace-badge--completed">Completed</span>
                          <span className="f10-bp-dev-trace-step">{classified.stepLabel}</span>
                        </div>
                        <div className="f10-bp-dev-trace-fields">
                          <div className="f10-bp-dev-trace-field f10-bp-dev-trace-field--full">
                            <span className="f10-bp-dev-trace-k">Task</span>
                            <span className="f10-bp-dev-trace-task-title" title={title ?? tid}>
                              {title ?? tid}
                            </span>
                          </div>
                          <div className="f10-bp-dev-trace-field">
                            <span className="f10-bp-dev-trace-k">Task id</span>
                            <ClampedValue value={tid} className="f10-bp-dev-trace-mono" />
                          </div>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={`m-${entry.at}-${ri}`} className="f10-bp-dev-trace-row f10-bp-dev-trace-row--matched">
                      <div className="f10-bp-dev-trace-row-top">
                        <span className="f10-bp-dev-trace-badge f10-bp-dev-trace-badge--matched">Matched</span>
                        <span className="f10-bp-dev-trace-step">{classified.stepLabel}</span>
                      </div>
                      <div className="f10-bp-dev-trace-fields">
                        {classified.eventType ? (
                          <div className="f10-bp-dev-trace-field">
                            <span className="f10-bp-dev-trace-k">Event type</span>
                            <ClampedValue value={classified.eventType} className="f10-bp-dev-trace-mono" />
                          </div>
                        ) : null}
                        {classified.eventId ? (
                          <div className="f10-bp-dev-trace-field">
                            <span className="f10-bp-dev-trace-k">Event id</span>
                            <ClampedValue value={classified.eventId} className="f10-bp-dev-trace-mono" />
                          </div>
                        ) : null}
                        {!classified.eventType && !classified.eventId ? (
                          <div className="f10-bp-dev-trace-field f10-bp-dev-trace-field--full">
                            <span className="f10-bp-dev-trace-k">Detail</span>
                            <span className="f10-bp-dev-trace-msg-inline" title={entry.message}>
                              {entry.message}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
