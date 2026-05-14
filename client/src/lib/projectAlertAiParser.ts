/**
 * Lightweight Savvy-style parser for project briefs (no external LLM).
 * Elite tier surfaces richer copy; Pro/Core still benefit from structured drafts.
 */

export type DraftProjectItem = {
  title: string;
  keywords: string[];
  targetPrice?: number;
  estimatedSavings?: number;
};

export type DraftProject = {
  name: string;
  category: string;
  budget?: number;
  trustRequirement: number;
  items: DraftProjectItem[];
  aiSummary: string;
};

function uniqKeywords(parts: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const k = p.toLowerCase().trim();
    if (!k || k.length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(p.trim());
    if (out.length >= 10) break;
  }
  return out;
}

function inferName(text: string, category: string): string {
  const t = text.trim();
  if (/gaming\s*pc|build.*pc|gpu|cpu/i.test(t)) return "Gaming PC build";
  if (/e60|m5|bmw/i.test(t)) return "BMW project";
  if (/studio|podcast|mic/i.test(t)) return "Studio setup";
  if (/home|kitchen|bathroom/i.test(t)) return "Home project";
  if (/maintenance|kit/i.test(t)) return "Maintenance kit";
  const first = t.split(/[.!?\n]/)[0]?.trim();
  return first && first.length <= 80 ? first.slice(0, 80) : "My project";
}

function splitPartsList(segment: string): DraftProjectItem[] {
  const chunk = segment.replace(/^and\s+/i, "").trim();
  if (!chunk) return [];
  const pieces = chunk
    .split(/\s*,\s*|\s+and\s+/i)
    .map((s) => s.replace(/^find\s+/i, "").replace(/^track\s+/i, "").trim())
    .filter(Boolean);
  return pieces.map((title) => ({
    title: title.charAt(0).toUpperCase() + title.slice(1),
    keywords: uniqKeywords(title.split(/\s+/).filter((w) => w.length > 2)),
  }));
}

/**
 * Parse free-form text into a draft project (used by Project Alerts AI assist).
 */
export function parseProjectBriefFromText(raw: string): DraftProject | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  let budget: number | undefined;
  const bm = text.match(/(?:under|below|less than)\s*\$?\s*(\d{2,5})/i);
  if (bm) budget = Number(bm[1]);

  let category = "general";
  if (/gaming|pc build|\bgpu\b|\bcpu\b|\bram\b|psu|motherboard/i.test(text)) category = "gaming_pc";
  else if (/bmw|brake|oil|tire|e60|\bm5\b|automotive|car/i.test(text)) category = "automotive";
  else if (/studio|audio|mic|interface/i.test(text)) category = "studio";
  else if (/home|kitchen|bathroom|deck|paint/i.test(text)) category = "home";

  const trustRequirement = /high trust|trusted seller/i.test(text) ? 85 : 72;

  let items: DraftProjectItem[] = [];

  const findIdx = text.search(/\bfind\b/i);
  const trackIdx = text.search(/\btrack\b/i);
  const partsIdx = Math.max(findIdx, trackIdx);
  if (partsIdx >= 0) {
    const tail = text.slice(partsIdx).replace(/^\s*(find|track)\s+/i, "");
    const forIdx = tail.search(/\bfor\b/i);
    const segment = forIdx >= 0 ? tail.slice(0, forIdx) : tail;
    items = splitPartsList(segment);
  }

  if (items.length === 0 && category === "gaming_pc") {
    items = [
      { title: "GPU", keywords: ["gpu", "graphics", "video card"], targetPrice: budget ? Math.round(budget * 0.35) : undefined },
      { title: "CPU", keywords: ["cpu", "processor"], targetPrice: budget ? Math.round(budget * 0.22) : undefined },
      { title: "RAM kit", keywords: ["ddr5", "ram", "memory"], targetPrice: budget ? Math.round(budget * 0.08) : undefined },
      { title: "Power supply", keywords: ["psu", "power supply", "750w"], targetPrice: budget ? Math.round(budget * 0.1) : undefined },
      { title: "SSD storage", keywords: ["nvme", "ssd", "1tb"], targetPrice: budget ? Math.round(budget * 0.07) : undefined },
    ];
  }

  if (items.length === 0 && category === "automotive") {
    items = [
      { title: "Brake pads", keywords: ["brake", "pads", "front"], targetPrice: 180 },
      { title: "Oil service kit", keywords: ["oil", "filter", "bmw"], targetPrice: 120 },
      { title: "Tires (set)", keywords: ["tires", "runflat", "michelin"], targetPrice: 900 },
    ];
  }

  const name = inferName(text, category);
  const aiSummary =
    `Savvy mapped ${items.length} parts for “${name}” (${category.replace("_", " ")}).` +
    (budget ? ` Target budget ~$${budget}.` : "") +
    ` Tune line-item targets, then spawn alerts for parts still on your watch list.`;

  return {
    name,
    category,
    budget,
    trustRequirement,
    items,
    aiSummary,
  };
}
