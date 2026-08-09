#!/usr/bin/env node
/**
 * Verifies @savvy/core Phase 1 copies stay in sync with Final10 client/src originals.
 * Run from packages/savvy-core: npm run verify
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as universeEvents from "../src/events/universeEvents.js";
import * as camoLocker from "../src/config/camoLocker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const CLIENT_SRC = path.resolve(PACKAGE_ROOT, "../../client/src");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function fail(message) {
  console.error(`\n✗ verify-parity: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function assertFilesEqual(label, packagePath, clientPath) {
  const a = read(packagePath);
  const b = read(clientPath);
  if (a !== b) {
    fail(
      `${label} drift detected.\n  package: ${path.relative(PACKAGE_ROOT, packagePath)}\n  client:  ${path.relative(PACKAGE_ROOT, clientPath)}\n  Update both files or re-copy from client.`
    );
  }
  ok(`${label} matches client original`);
}

const SHIM_RE =
  /^export\s+\*\s+from\s+['"]@savvy\/core(?:\/[^'"]+)?['"]\s*;?\s*$/;

function assertConfigFileOrShim(label, packagePath, clientPath, expectedShim) {
  const client = read(clientPath).trim();
  if (SHIM_RE.test(client)) {
    if (client !== expectedShim) {
      fail(`${label} shim must be exactly:\n  ${expectedShim}\n  got:\n  ${client}`);
    }
    ok(`${label} client shim → @savvy/core`);
    if (!fs.existsSync(packagePath)) {
      fail(`${label} package source missing at ${packagePath}`);
    }
    ok(`${label} package source present`);
    return;
  }
  assertFilesEqual(label, packagePath, clientPath);
}

function verifyEventParity(exportName, relativeClientFile) {
  const clientPath = path.join(CLIENT_SRC, relativeClientFile);
  const clientSource = read(clientPath);

  const fromCore = "@savvy/core/events/universeEvents";
  const namedReExport = clientSource.match(
    new RegExp(
      `export\\s+\\{[^}]*\\b${exportName}\\b[^}]*\\}\\s+from\\s+['"]${fromCore.replace(/\//g, "\\/")}['"]`
    )
  );
  const importFromCore = clientSource.match(
    new RegExp(
      `import\\s+\\{[^}]*\\b${exportName}\\b[^}]*\\}\\s+from\\s+['"]${fromCore.replace(/\//g, "\\/")}['"]`
    )
  );
  const reExportBinding = clientSource.match(
    new RegExp(`export\\s+\\{[^}]*\\b${exportName}\\b[^}]*\\}`)
  );

  if (namedReExport || (importFromCore && reExportBinding)) {
    const actual = universeEvents[exportName];
    ok(`${exportName} client shim → @savvy/core/events/universeEvents (${actual})`);
    return;
  }

  let expected;

  const direct = clientSource.match(
    new RegExp(`export const ${exportName}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`)
  );
  if (direct) {
    expected = direct[1];
  } else {
    const alias = clientSource.match(
      new RegExp(`export const ${exportName}\\s*=\\s*([A-Z_][A-Z0-9_]*)`)
    );
    if (!alias) {
      fail(`Could not find export const ${exportName} in ${relativeClientFile}`);
    }
    const constName = alias[1];
    const resolved = clientSource.match(
      new RegExp(`const ${constName}\\s*=\\s*['"]([^'"]+)['"]`)
    );
    if (!resolved) {
      fail(`Could not resolve ${constName} for ${exportName} in ${relativeClientFile}`);
    }
    expected = resolved[1];
  }

  const actual = universeEvents[exportName];
  if (actual !== expected) {
    fail(
      `${exportName} mismatch: package="${actual}" client="${expected}" (from ${relativeClientFile})`
    );
  }
  ok(`${exportName} === "${actual}"`);
}

if (!fs.existsSync(CLIENT_SRC)) {
  fail(`Final10 client/src not found at ${CLIENT_SRC}`);
}

console.log("Savvy Core parity verification\n");

assertConfigFileOrShim(
  "savvyRewards.js",
  path.join(PACKAGE_ROOT, "src/config/savvyRewards.js"),
  path.join(CLIENT_SRC, "config/savvyRewards.js"),
  "export * from '@savvy/core/config/savvyRewards';"
);

assertConfigFileOrShim(
  "scoutBranding.js",
  path.join(PACKAGE_ROOT, "src/config/scoutBranding.js"),
  path.join(CLIENT_SRC, "config/savvyScoutBranding.js"),
  "export * from '@savvy/core/config/scoutBranding';"
);

const themePackage = read(path.join(PACKAGE_ROOT, "src/tokens/theme.css"));
const themeClient = read(path.join(CLIENT_SRC, "styles/theme.css"));

function extractRootBlock(css) {
  const match = css.match(/:root\s*\{[\s\S]*?\}/);
  return match ? match[0].trim() : "";
}

function extractRuleBlock(css, selector) {
  const idx = css.indexOf(selector);
  if (idx === -1) return "";
  const braceStart = css.indexOf("{", idx);
  if (braceStart === -1) return "";
  let depth = 0;
  for (let i = braceStart; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(idx, i + 1).trim();
      }
    }
  }
  return "";
}

const THEME_RULES = [
  ":root",
  ".card",
  ".glow",
  ".btn",
  ".btn:active",
  ".btn-primary",
  ".btn-purple",
  ".btn-ghost",
  ".input",
  ".input::placeholder",
  ".chip",
  ".chip--success",
  ".chip--danger",
  ".text-gradient",
];

const packageRoot = extractRootBlock(themePackage);
const clientRoot = extractRootBlock(themeClient);
if (!packageRoot || packageRoot !== clientRoot) {
  fail(":root block in theme.css does not match client/src/styles/theme.css");
}
ok(":root tokens match client theme");

for (const selector of THEME_RULES.slice(1)) {
  const pkgRule = extractRuleBlock(themePackage, selector);
  const clientRule = extractRuleBlock(themeClient, selector);
  if (!pkgRule || pkgRule !== clientRule) {
    fail(`${selector} rule in theme.css does not match client/src/styles/theme.css`);
  }
}
ok(`theme.css utility rules match client theme (${THEME_RULES.length - 1} selectors)`);

const EVENT_SOURCES = {
  WALLET_AWARD_EVENT: "lib/pointsEngine.js",
  REWARD_EVENT: "lib/rewardEngine.js",
  SAVVY_AUTH_REFRESH_REQUEST: "store/savvyStore.js",
  SAVVY_STORE_UPDATED: "store/savvyStore.js",
  CALLING_CARD_UNLOCK_EVENT: "lib/callingCardUnlockBus.js",
  CAMO_LOCKER_OPEN_EVENT: "lib/camoLockerBus.js",
  CAMO_LOCKER_CLOSE_EVENT: "lib/camoLockerBus.js",
  CAMO_LOCKER_SYNC_EVENT: "lib/camoLockerBus.js",
  SAVVY_ALERT_EVENT: "lib/savvyAlerts.js",
  SCOUT_MISSION_SYNC_EVENT: "lib/savvyScoutMissions.js",
  SCOUT_MISSION_POPUP_EVENT: "lib/savvyScoutMissions.js",
  SCOUT_MISSION_ACTION_EVENT: "lib/savvyScoutMissions.js",
  BP_UPDATE_EVENT: "lib/battlePassConfig.js",
  BP_TIER_COMPLETE_EVENT: "lib/battlePassConfig.js",
  BATTLE_PASS_ACTION_EVENT: "lib/battlePassActionBus.js",
  CONTRACTS_OPEN_EVENT: "lib/contractsBus.js",
  CONTRACTS_CLOSE_EVENT: "lib/contractsBus.js",
  CONTRACTS_SYNC_EVENT: "lib/contractsBus.js",
};

console.log("\nEvent constants:");
for (const [name, relativeFile] of Object.entries(EVENT_SOURCES)) {
  verifyEventParity(name, relativeFile);
}

const exportedCount = Object.keys(universeEvents.UNIVERSE_EVENTS).length;
const expectedCount = Object.keys(EVENT_SOURCES).length;
if (exportedCount !== expectedCount) {
  fail(`UNIVERSE_EVENTS has ${exportedCount} entries, expected ${expectedCount}`);
}
ok(`UNIVERSE_EVENTS registry complete (${exportedCount} events)`);

/* ------------------------- Camo Locker catalog parity ---------------------- */

const SERVER_CAMO_CONFIG = path.resolve(PACKAGE_ROOT, "../../server/config/camoLocker.js");

console.log("\nCamo Locker catalog:");
if (!fs.existsSync(SERVER_CAMO_CONFIG)) {
  fail(`server camo mirror missing at ${SERVER_CAMO_CONFIG}`);
}

const serverCamo = createRequire(import.meta.url)(SERVER_CAMO_CONFIG);

if (serverCamo.CAMO_CATALOG_VERSION !== camoLocker.CAMO_CATALOG_VERSION) {
  fail(
    `CAMO_CATALOG_VERSION mismatch: package=${camoLocker.CAMO_CATALOG_VERSION} server=${serverCamo.CAMO_CATALOG_VERSION}`
  );
}
ok(`CAMO_CATALOG_VERSION === ${camoLocker.CAMO_CATALOG_VERSION}`);

const packageIds = camoLocker.CAMO_ITEM_IDS.join(",");
const serverIds = serverCamo.CAMO_ITEM_IDS.join(",");
if (packageIds !== serverIds) {
  fail(
    `camo item IDs drift.\n  package (${camoLocker.CAMO_ITEM_IDS.length}): ${packageIds}\n  server  (${serverCamo.CAMO_ITEM_IDS.length}): ${serverIds}`
  );
}
ok(`camo item IDs match (${camoLocker.CAMO_ITEM_IDS.length} items)`);

for (const item of camoLocker.CAMO_ITEMS) {
  const mirror = serverCamo.getCamoItem(item.id);
  if (!mirror) fail(`server mirror is missing camo item ${item.id}`);
  if (mirror.threshold !== item.threshold) {
    fail(
      `${item.id} threshold mismatch: package=${item.threshold} server=${mirror.threshold}`
    );
  }
  if (mirror.rarity !== item.rarity) {
    fail(`${item.id} rarity mismatch: package=${item.rarity} server=${mirror.rarity}`);
  }
  const packageGates = JSON.stringify(item.gates);
  const serverGates = JSON.stringify(mirror.gates);
  if (packageGates !== serverGates) {
    fail(`${item.id} gate drift.\n  package: ${packageGates}\n  server:  ${serverGates}`);
  }
  const packageVisibility = item.visibility || "public";
  const serverVisibility = mirror.visibility || "public";
  if (packageVisibility !== serverVisibility) {
    fail(
      `${item.id} visibility mismatch: package=${packageVisibility} server=${serverVisibility}`
    );
  }
  if (Boolean(item.grantOnly) !== Boolean(mirror.grantOnly)) {
    fail(`${item.id} grantOnly mismatch: package=${item.grantOnly} server=${mirror.grantOnly}`);
  }
}
ok("camo thresholds, rarities and unlock gates match server mirror");

console.log("\n✓ All parity checks passed.\n");
