import { triggerActionReward } from "./rewardEngine";

const STORAGE_KEY = "f10_tab_journey_v1";
export const TAB_JOURNEY_EVENT = "f10-tab-journey-updated";

export const TAB_FLOWS = {
  "/feed": {
    tabLabel: "Trending Feed",
    reward: 25,
    steps: [
      { id: "view_items", label: "View 3 items", target: 3 },
      { id: "click_deal", label: "Click 1 deal", target: 1 },
      { id: "save_item", label: "Save 1 item", target: 1 },
    ],
  },
  "/trending": {
    tabLabel: "Promote Lane",
    reward: 30,
    steps: [
      { id: "view_promoted", label: "View promoted lane", target: 1 },
      { id: "switch_filter", label: "Switch a lane filter", target: 1 },
      { id: "open_promote_cta", label: "Open promote flow", target: 1 },
    ],
  },
  "/seller-dashboard": {
    tabLabel: "Seller Dashboard",
    reward: 35,
    steps: [
      { id: "view_metrics", label: "Review key metrics", target: 1 },
      { id: "open_listing_cta", label: "Open listing action", target: 1 },
      { id: "review_signals", label: "Check live signals", target: 1 },
    ],
  },
  "/business-offers": {
    tabLabel: "Life Optimizer",
    reward: 30,
    steps: [
      { id: "view_overview", label: "View offer overview", target: 1 },
      { id: "toggle_offer", label: "Pause or resume one offer", target: 1 },
      { id: "open_create_offer", label: "Open create offer flow", target: 1 },
    ],
  },
};

function hasWindow() {
  return typeof window !== "undefined";
}

function readState() {
  if (!hasWindow()) return { flows: {}, totalEarned: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      flows: parsed.flows && typeof parsed.flows === "object" ? parsed.flows : {},
      totalEarned: Number(parsed.totalEarned || 0),
    };
  } catch {
    return { flows: {}, totalEarned: 0 };
  }
}

function writeState(next) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(TAB_JOURNEY_EVENT, { detail: next }));
  } catch {
    /* ignore */
  }
}

function ensureFlowRecord(route, state) {
  const flow = TAB_FLOWS[route];
  if (!flow) return null;
  const existing = state.flows[route] || {
    completedAt: null,
    rewardClaimed: false,
    rewardEarned: 0,
    steps: {},
  };
  for (const step of flow.steps) {
    if (typeof existing.steps[step.id] !== "number") existing.steps[step.id] = 0;
  }
  state.flows[route] = existing;
  return existing;
}

export function getTabJourneySnapshot(route) {
  const state = readState();
  const flow = TAB_FLOWS[route];
  if (!flow) return null;
  const record = ensureFlowRecord(route, state);
  const completedSteps = flow.steps.reduce(
    (sum, step) => sum + (Math.min(step.target, Number(record.steps[step.id] || 0)) >= step.target ? 1 : 0),
    0
  );
  const progressPct = Math.round((completedSteps / flow.steps.length) * 100);
  return {
    route,
    flow,
    record,
    completedSteps,
    progressPct,
    totalEarned: Number(state.totalEarned || 0),
  };
}

export function incrementJourneyStep(route, stepId, amount = 1) {
  const flow = TAB_FLOWS[route];
  if (!flow) return null;
  const state = readState();
  const record = ensureFlowRecord(route, state);
  const step = flow.steps.find((s) => s.id === stepId);
  if (!step) return null;
  const current = Number(record.steps[stepId] || 0);
  record.steps[stepId] = Math.min(step.target, current + Math.max(1, Number(amount) || 1));

  const completed = flow.steps.every((s) => Number(record.steps[s.id] || 0) >= s.target);
  if (completed && !record.rewardClaimed) {
    record.rewardClaimed = true;
    record.rewardEarned = flow.reward;
    record.completedAt = Date.now();
    state.totalEarned = Number(state.totalEarned || 0) + flow.reward;
    triggerActionReward("task_complete", {
      title: `${flow.tabLabel} Complete`,
      subtitle: `+${flow.reward} Savvy bonus`,
      foot: "Complete this to unlock bonus",
      durationMs: 1700,
    });
  }

  writeState(state);
  return getTabJourneySnapshot(route);
}

export function observeTabJourney(cb) {
  if (!hasWindow()) return () => {};
  const handler = () => cb(readState());
  window.addEventListener(TAB_JOURNEY_EVENT, handler);
  return () => window.removeEventListener(TAB_JOURNEY_EVENT, handler);
}

