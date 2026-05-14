/**
 * Lightweight client-side parser for natural-language alert instructions.
 * Not a full LLM — covers common patterns like price caps and trust hints.
 */

function stripNoise(s) {
  return String(s || "")
    .replace(/\b(savvy,?\s*)?(set|create|make|start|add)\s+(me\s+)?(an?\s+)?(a\s+)?(alert|watch|notification)\s+(for|on|to)?\b/gi, " ")
    .replace(/\b(watch|track|monitor|notify\s+me)\b/gi, " ")
    .replace(/\bplease\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} text - User phrase e.g. "PS5 under $375 high trust"
 * @param {object} basePayload - Existing fields from SavvyAlertButton (name, keywords, maxPrice, …)
 * @returns {object} Payload shaped for createSavvyAlert
 */
export function parseNaturalLanguageAlert(text, basePayload = {}) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("Describe what Savvy should watch.");
  }

  const t = stripNoise(raw);
  let maxPrice =
    typeof basePayload.maxPrice === "number" && Number.isFinite(basePayload.maxPrice)
      ? basePayload.maxPrice
      : undefined;

  const pricePatterns = [
    /\b(?:under|below|less than|max|at most|up to)\s*\$?\s*([\d,]+(?:\.\d+)?)\b/gi,
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:or less|max)?\b/gi,
  ];
  for (const re of pricePatterns) {
    const m = re.exec(t);
    if (m) {
      const n = Number(String(m[1]).replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) {
        maxPrice = n;
        break;
      }
    }
  }

  let minConfidence =
    typeof basePayload.minConfidence === "number" && Number.isFinite(basePayload.minConfidence)
      ? basePayload.minConfidence
      : 70;

  if (/\b(high trust|trusted sellers?|top rated)\b/i.test(t)) {
    minConfidence = Math.max(minConfidence, 82);
  }
  const trustNum = t.match(/\btrust\s*(?:score)?\s*(?:>=|over|above)?\s*(\d{1,3})\b/i);
  if (trustNum) {
    const v = Number(trustNum[1]);
    if (Number.isFinite(v)) minConfidence = Math.max(minConfidence, Math.min(95, v));
  }

  let productPart = t
    .replace(/\b(under|below|less than|max|at most|up to)\s*\$?\s*[\d,]+(?:\.\d+)?\b/gi, " ")
    .replace(/\$\s*[\d,]+(?:\.\d+)?\b/g, " ")
    .replace(/\b(high trust|trusted sellers?|top rated)\b/gi, " ")
    .replace(/\btrust\s*(?:score)?\s*(?:>=|over|above)?\s*\d{1,3}\b/gi, " ")
    .trim();

  const tokens = productPart
    .split(/[\s,/+]+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter((w) => w.length > 1 && !/^\d+$/.test(w));

  const keywords = [...new Set([...(Array.isArray(basePayload.keywords) ? basePayload.keywords : []), ...tokens])]
    .map((k) => String(k).trim())
    .filter(Boolean)
    .slice(0, 16);

  const name =
    (productPart.slice(0, 72) || keywords.slice(0, 4).join(" ") || basePayload.name || "Savvy alert").trim();

  return {
    ...basePayload,
    name,
    keywords: keywords.length ? keywords : basePayload.keywords || [],
    maxPrice,
    minConfidence,
    context: {
      ...(basePayload.context || {}),
      creationMode: "text_ai",
      naturalLanguage: raw,
      aiParsedAt: new Date().toISOString(),
    },
  };
}

/** Build a short Savvy-style confirmation line after voice/text AI create. */
export function formatAiAlertConfirmation(parsedPayload) {
  const item = String(parsedPayload?.name || "that deal").trim();
  const price =
    typeof parsedPayload?.maxPrice === "number" && Number.isFinite(parsedPayload.maxPrice)
      ? ` under $${Math.round(parsedPayload.maxPrice)}`
      : "";
  return `Got it. I'll watch ${item}${price}.`;
}
