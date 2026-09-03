const {
  verifyPerkMachineGrantHandlers,
  EXTERNAL_HANDLER_CHECKS,
} = require('../services/perkMachineHandlerCheck');
const {
  requireGrantSavvyReward,
  requireCreateSupplyDrop,
  requireGrantSystemCosmeticUnlock,
} = require('../services/perkMachineRewardGrant');
const { attachSpinFailureFields, buildSpinFailureDiagnostics } = require('../lib/spinFailurePayload');

describe('perkMachine handler wiring', () => {
  test('typeof grantSavvyReward === "function" via lazy resolver', () => {
    expect(typeof requireGrantSavvyReward()).toBe('function');
  });

  test('typeof createSupplyDrop === "function" via lazy resolver', () => {
    expect(typeof requireCreateSupplyDrop()).toBe('function');
  });

  test('typeof grantSystemCosmeticUnlock === "function" via lazy resolver', () => {
    expect(typeof requireGrantSystemCosmeticUnlock()).toBe('function');
  });

  test('startup handler matrix — all external handlers callable', () => {
    const result = verifyPerkMachineGrantHandlers({ failOnError: false });
    expect(result.allHandlersValid).toBe(true);
    expect(result.grantSavvyReward).toBe('function');
    expect(result.spendSavvyReward).toBe('function');
    expect(EXTERNAL_HANDLER_CHECKS.length).toBeGreaterThanOrEqual(4);
  });

  test('spin failure payload includes serverCommitSha and exception fields', () => {
    process.env.GIT_COMMIT = 'abc123def456';
    const err = new TypeError('grantSavvyReward is not a function');
    err.failedStage = 'REWARD_GRANT_0';
    err.lastOkStage = 'REWARDS_SELECTED';
    err.rewardId = 'savvy_50';
    err.rewardType = 'savvy';
    err.grantHandler = 'grantSavvyReward';
    const trace = { getLastOkStage: () => 'REWARDS_SELECTED' };
    const body = attachSpinFailureFields({ code: 'SPIN_FAILED' }, err, trace, 'PM-test');
    expect(body.serverCommitSha).toBe('abc123def456');
    expect(body.exceptionName).toBe('TypeError');
    expect(body.exceptionMessage).toMatch(/grantSavvyReward/);
    expect(body.failedStage).toBe('REWARD_GRANT_0');
    expect(body.spinTraceId).toBe('PM-test');
    delete process.env.GIT_COMMIT;
  });

  test('buildSpinFailureDiagnostics extracts file and line from stack', () => {
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at grantPerkMachineSavvy (/app/server/services/perkMachineRewardGrant.js:221:11)';
    const diag = buildSpinFailureDiagnostics(err);
    expect(diag.file).toMatch(/perkMachineRewardGrant\.js$/);
    expect(diag.line).toBe(221);
  });
});
