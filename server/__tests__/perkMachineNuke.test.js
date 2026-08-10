const {
  PERK_MACHINE_NUKE_SPIN_THRESHOLD,
  NUKE_QUALIFYING_RULES,
  NUKE_AUTO_TRIGGER_THRESHOLDS,
  getNextAutoTriggerThreshold,
} = require('../config/perkMachineNukeConfig');
const {
  defaultNukeDoc,
  ensureNukeDoc,
  isQualifyingNukeSpin,
  recordQualifyingNukeSpin,
  applyNukeMultiplierToReward,
  captureNukeEligibility,
  maybeExpireNukeEvent,
  adminSetNukeProgress,
  adminTriggerNuke,
  adminEndNuke,
  formatNukeForClient,
  isNukeMultipliableType,
} = require('../services/perkMachineNukeService');
const { scaleRewardForMultiplier } = require('../services/perkMachineMultiplier');

function mockUser(nukeOverrides = {}) {
  const user = {
    perkMachine: {
      nuke: { ...defaultNukeDoc(), ...nukeOverrides },
    },
    markModified: jest.fn(),
  };
  return user;
}

describe('perkMachineNukeConfig', () => {
  test('requires 3000 qualifying spins', () => {
    expect(PERK_MACHINE_NUKE_SPIN_THRESHOLD).toBe(3000);
  });

  test('default qualifying rule counts paid savvy spins only', () => {
    expect(NUKE_QUALIFYING_RULES.requirePaidSavvy).toBe(true);
    expect(NUKE_QUALIFYING_RULES.countFreeSpins).toBe(false);
    expect(NUKE_QUALIFYING_RULES.countTokenSpins).toBe(false);
  });
});

describe('isQualifyingNukeSpin', () => {
  test('counts paid spins with savvy charged', () => {
    expect(isQualifyingNukeSpin({ mode: 'paid_1', savvyCostCharged: 20 })).toBe(true);
  });

  test('does not count free spins', () => {
    expect(isQualifyingNukeSpin({ mode: 'free', savvyCostCharged: 0 })).toBe(false);
  });

  test('does not count token spins by default', () => {
    expect(
      isQualifyingNukeSpin({
        mode: 'paid_3',
        savvyCostCharged: 0,
        usedPaid3Token: true,
      })
    ).toBe(false);
  });

  test('does not count admin bypass spins', () => {
    expect(
      isQualifyingNukeSpin({
        mode: 'paid_1',
        savvyCostCharged: 0,
        adminBypass: true,
      })
    ).toBe(false);
  });
});

describe('recordQualifyingNukeSpin', () => {
  test('increments lifetime counter once per spinId', () => {
    const user = mockUser({ lifetimeQualifyingSpins: 2998 });
    const first = recordQualifyingNukeSpin(user, {
      spinId: 'spin-a',
      mode: 'paid_1',
      savvyCostCharged: 20,
    });
    expect(first.recorded).toBe(true);
    expect(first.after).toBe(2999);

    const dup = recordQualifyingNukeSpin(user, {
      spinId: 'spin-a',
      mode: 'paid_1',
      savvyCostCharged: 20,
    });
    expect(dup.recorded).toBe(false);
    expect(dup.reason).toBe('duplicate');
    expect(user.perkMachine.nuke.lifetimeQualifyingSpins).toBe(2999);
  });

  test('spin 3000 triggers nuke activation once', () => {
    const user = mockUser({ lifetimeQualifyingSpins: 2999 });
    const result = recordQualifyingNukeSpin(user, {
      spinId: 'spin-3000',
      mode: 'paid_1',
      savvyCostCharged: 20,
    });
    expect(result.after).toBe(3000);
    expect(result.thresholdReached).toBe(true);
    expect(result.activation).toBeTruthy();
    expect(user.perkMachine.nuke.activeEvent).toBeTruthy();
    expect(user.perkMachine.nuke.nukeEventsTriggered).toBe(1);
  });

  test('spin 3001 does not re-trigger nuke', () => {
    const user = mockUser({
      lifetimeQualifyingSpins: 3000,
      nukeEventsTriggered: 1,
      activeEvent: {
        eventId: 'existing',
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 600_000),
        multiplier: 3,
      },
    });
    const result = recordQualifyingNukeSpin(user, {
      spinId: 'spin-3001',
      mode: 'paid_1',
      savvyCostCharged: 20,
    });
    expect(result.after).toBe(3001);
    expect(result.thresholdReached).toBe(false);
    expect(result.activation).toBeNull();
  });
});

describe('applyNukeMultiplierToReward', () => {
  test('3x nuke on savvy after 2x tile = 6x effective amount', () => {
    const tileScaled = scaleRewardForMultiplier(
      { id: 'savvy_500', type: 'savvy', amount: 500, label: '+500 Savvy' },
      2
    );
    const { reward, nukeApplied, nukeBonusSavvy } = applyNukeMultiplierToReward(tileScaled, 3);
    expect(nukeApplied).toBe(true);
    expect(reward.amount).toBe(3000);
    expect(nukeBonusSavvy).toBe(2000);
  });

  test('3x nuke with 4x tile multiplier = 12x on savvy', () => {
    const tileScaled = scaleRewardForMultiplier(
      { id: 'savvy_500', type: 'savvy', amount: 500, label: '+500 Savvy' },
      4
    );
    const { reward } = applyNukeMultiplierToReward(tileScaled, 3);
    expect(reward.amount).toBe(6000);
  });

  test('does not multiply calling cards', () => {
    const def = { id: 'card', type: 'calling_card', label: 'Rare Card' };
    const { nukeApplied, reward } = applyNukeMultiplierToReward(def, 3);
    expect(nukeApplied).toBe(false);
    expect(reward.label).toBe('Rare Card');
  });

  test('multiplies eligible egg quantities', () => {
    const tileScaled = scaleRewardForMultiplier(
      { id: 'egg_rare', type: 'egg', eggTier: 'rare', label: 'Rare Egg', quantity: 2 },
      2
    );
    const { reward, nukeApplied } = applyNukeMultiplierToReward(tileScaled, 3);
    expect(nukeApplied).toBe(true);
    expect(reward.quantity).toBe(6);
  });
});

describe('nuke eligibility snapshot', () => {
  test('captures active nuke at spin time', () => {
    const user = mockUser({
      activeEvent: {
        eventId: 'ev1',
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 120_000),
        multiplier: 3,
      },
    });
    const snap = captureNukeEligibility(user);
    expect(snap.active).toBe(true);
    expect(snap.multiplier).toBe(3);
  });

  test('spin accepted before expiry keeps nuke active snapshot', () => {
    const user = mockUser({
      activeEvent: {
        eventId: 'ev1',
        activatedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 1000),
        multiplier: 3,
      },
    });
    const snap = captureNukeEligibility(user);
    expect(snap.active).toBe(true);
  });
});

describe('nuke expiration', () => {
  test('expires event and returns summary', () => {
    const user = mockUser({
      activeEvent: {
        eventId: 'ev-expired',
        activatedAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 1000),
        multiplier: 3,
        spinsDuringEvent: 5,
        savvySpent: 100,
        baseSavvyEarned: 200,
        nukeBonusEarned: 400,
      },
    });
    const summary = maybeExpireNukeEvent(user);
    expect(summary).toBeTruthy();
    expect(summary.spinsDuringEvent).toBe(5);
    expect(user.perkMachine.nuke.activeEvent).toBeNull();
    expect(user.perkMachine.nuke.lastRunSummary).toBeTruthy();
    expect(user.perkMachine.nuke.history).toHaveLength(1);
    expect(user.perkMachine.nuke.history[0].totalSavvyEarned).toBe(600);
  });

  test('expired nuke is not active for new spins', () => {
    const user = mockUser({
      activeEvent: {
        eventId: 'ev-expired',
        activatedAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 1000),
        multiplier: 3,
      },
    });
    const snap = captureNukeEligibility(user);
    expect(snap.active).toBe(false);
    expect(snap.multiplier).toBe(1);
  });
});

describe('repeat nuke trigger config', () => {
  test('V1 uses single threshold at 3000', () => {
    expect(NUKE_AUTO_TRIGGER_THRESHOLDS).toEqual([3000]);
  });

  test('getNextAutoTriggerThreshold only fires on exact threshold', () => {
    const nuke = defaultNukeDoc();
    expect(getNextAutoTriggerThreshold(nuke, 2999)).toBeNull();
    expect(getNextAutoTriggerThreshold(nuke, 3000)).toBe(3000);
    nuke.nukeEventsTriggered = 1;
    expect(getNextAutoTriggerThreshold(nuke, 3000)).toBeNull();
  });
});

describe('nuke history payload', () => {
  test('formatNukeForClient exposes history stats', () => {
    const user = mockUser({
      lifetimeQualifyingSpins: 3200,
      nukeEventsTriggered: 1,
      totalNukeBonusEarned: 900,
      highestNukeMultiplierAchieved: 12,
      lastRunSummary: {
        spinsDuringEvent: 8,
        savvySpent: 240,
        baseSavvyEarned: 500,
        nukeBonusEarned: 900,
        totalSavvyEarned: 1400,
        highestCombinedMultiplier: 12,
        bestRewardLabel: '+1200 Savvy',
      },
    });
    const payload = formatNukeForClient(user);
    expect(payload.history.lifetimeQualifyingSpins).toBe(3200);
    expect(payload.history.nukeEventsTriggered).toBe(1);
    expect(payload.history.lastRun.spinsDuringEvent).toBe(8);
    expect(payload.history.totalNukeBonusEarned).toBe(900);
    expect(payload.config.autoTriggerThresholds).toEqual([3000]);
  });
});

describe('admin nuke controls', () => {
  test('admin can set progress for QA', () => {
    const user = mockUser();
    adminSetNukeProgress(user, 2999);
    expect(user.perkMachine.nuke.lifetimeQualifyingSpins).toBe(2999);
  });

  test('admin can trigger and end nuke', () => {
    const user = mockUser();
    const triggered = adminTriggerNuke(user, { durationMinutes: 1, multiplier: 3 });
    expect(triggered.triggered).toBe(true);
    expect(formatNukeForClient(user).active).toBeTruthy();

    const ended = adminEndNuke(user);
    expect(ended.ended).toBe(true);
    expect(formatNukeForClient(user).active).toBeNull();
  });
});

describe('isNukeMultipliableType', () => {
  test('allowlist includes savvy and stackables', () => {
    expect(isNukeMultipliableType('savvy')).toBe(true);
    expect(isNukeMultipliableType('egg')).toBe(true);
    expect(isNukeMultipliableType('bp_tier_skip')).toBe(false);
    expect(isNukeMultipliableType('supply_drop')).toBe(false);
  });
});
