import { createSavvyAlert, SAVVY_ALERT_EVENT } from "./savvyAlerts";
import { pushScoutDealFound, setScoutVisualState } from "./savvyScoutState";

export const ADMIN_TEST_ALERT = Object.freeze({
  title: "PS5 Deal Found",
  message: "Savvy Scout found a PS5 under your target price.",
  type: "dealFound",
  price: 449,
  targetPrice: 500,
  toastTitle: "Opportunity found.",
  viewDealUrl: "/local-deals?q=PS5",
});

/**
 * Create an admin-labeled test alert and trigger Savvy Scout deal-found UI.
 * Falls back to a frontend mock if the alerts API is unavailable.
 */
export async function fireAdminTestAlert() {
  const sample = ADMIN_TEST_ALERT;
  const alertPayload = {
    name: `Admin Test Alert: ${sample.title}`,
    keywords: ["PS5", "PlayStation 5"],
    maxPrice: sample.targetPrice,
    minConfidence: 70,
    kind: "custom",
    context: {
      type: sample.type,
      price: sample.price,
      targetPrice: sample.targetPrice,
      adminTest: true,
      message: sample.message,
    },
  };

  let savedAlert = null;
  let usedMock = false;

  try {
    savedAlert = await createSavvyAlert(alertPayload);
  } catch {
    usedMock = true;
    savedAlert = {
      id: `admin-test-mock-${Date.now()}`,
      ...alertPayload,
      status: "active",
      mock: true,
      createdAt: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(SAVVY_ALERT_EVENT, {
          detail: {
            message: sample.message,
            alert: savedAlert,
            payload: alertPayload,
          },
        })
      );
    }
  }

  pushScoutDealFound({
    id: `admin-test-scout-${Date.now()}`,
    title: sample.toastTitle,
    body: sample.message,
    url: sample.viewDealUrl,
  });
  setScoutVisualState("dealFound");
  window.setTimeout(() => setScoutVisualState("idle"), 2800);

  return { alert: savedAlert, usedMock, sample };
}
