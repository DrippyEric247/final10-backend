import { createAlert } from "./api";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { markFoundingTesterAlertCreated } from "./foundingTesterMission";
import { triggerActionReward } from "./rewardEngine";
import { applyTierMultiplier, formatTierMultiplierLabel } from "./tierMultiplier";
import { recordScoutMissionAction } from "./savvyScoutMissions";
import { auditAlertAction } from "./auditLog";

export const SAVVY_ALERT_EVENT = "f10-savvy-alert-created";

export async function createSavvyAlert(payload) {
  const alertPayload = {
    name: String(payload?.name || "").trim(),
    keywords: Array.isArray(payload?.keywords) ? payload.keywords : [],
    maxPrice: payload?.maxPrice,
    minConfidence: payload?.minConfidence ?? 70,
    sources: Array.isArray(payload?.sources) && payload.sources.length ? payload.sources : ["ebay"],
    persona: payload?.persona || "buyer",
    kind: payload?.kind || "custom",
    context: payload?.context || {},
    status: payload?.status || "active",
  };
  if (!alertPayload.name) throw new Error("Alert name is required");

  const data = await createAlert(alertPayload);
  try {
    markFoundingTesterAlertCreated();
  } catch {
    /* ignore */
  }
  try {
    trackEvent(ANALYTICS_EVENTS.ALERT_CREATED, {
      kind: alertPayload.kind || "custom",
      keywordCount: Array.isArray(alertPayload.keywords) ? alertPayload.keywords.length : 0,
      hasMaxPrice: alertPayload.maxPrice != null && alertPayload.maxPrice !== "",
    });
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(SAVVY_ALERT_EVENT, {
        detail: {
          message: "Savvy is watching this now.",
          alert: data,
          payload: alertPayload,
        },
      })
    );
  } catch {
    /* ignore */
  }
  triggerActionReward("task_complete", {
    title: "Savvy is watching this now.",
    subtitle: `+${applyTierMultiplier(5)} Savvy for smart tracking (${formatTierMultiplierLabel()} boost)`,
    durationMs: 1200,
  });
  recordScoutMissionAction("create_alert", { pathname: "/alerts" });
  auditAlertAction({ action: 'created', kind: alertPayload.kind || 'custom' });
  return data;
}

