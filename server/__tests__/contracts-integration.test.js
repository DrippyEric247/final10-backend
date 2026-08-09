/**
 * Contract claim + progress integration tests (requires MongoDB).
 * Run: cd server && MONGODB_URI=mongodb://127.0.0.1:27017/final10_contracts_test npm test -- contracts-integration.test.js
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const ContractProgress = require('../models/ContractProgress');
const { recordContractTrigger, tryAcquireContractClaim } = require('../services/contractProgressService');
const { claimContractReward, getContractsHubForUser } = require('../services/contractService');
const { getContractById } = require('../config/contracts');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describeReal('Contracts integration', () => {
  let user;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  afterAll(async () => {
    if (!MONGODB_URI) return;
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    if (!MONGODB_URI) return;
    user = await User.create({
      username: `contract_test_${Date.now()}`,
      email: `contract_${Date.now()}@example.com`,
      password: 'testpass123',
      savvyPoints: 500,
    });
  });

  afterEach(async () => {
    if (!MONGODB_URI || !user) return;
    await ContractProgress.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
  });

  test('records progress and prevents duplicate savvy claims', async () => {
    const contract = getContractById('final10_deal_hunter');
    await recordContractTrigger(user._id, 'deal_found', { increment: 5 });

    const fresh = await User.findById(user._id);
    const first = await claimContractReward(fresh, { contractId: contract.id });
    expect(first.granted).toBe(true);
    expect(first.added).toBe(100);

    const againUser = await User.findById(user._id);
    const second = await claimContractReward(againUser, { contractId: contract.id });
    expect(second.granted).toBe(false);
    expect(second.duplicate || second.alreadyClaimed).toBe(true);

    const finalUser = await User.findById(user._id);
    expect(finalUser.savvyPoints).toBe(600);
  });

  test('perk spin reward grants tokens server-side', async () => {
    const contract = getContractById('final10_perk_user');
    await recordContractTrigger(user._id, 'perk_machine_spin', { increment: 3 });

    const fresh = await User.findById(user._id);
    const result = await claimContractReward(fresh, { contractId: contract.id });
    expect(result.granted).toBe(true);
    expect(result.rewardType).toBe('perk_spin');

    const updated = await User.findById(user._id);
    expect(Number(updated.perkMachine?.tokens?.paid3Spin || 0)).toBeGreaterThanOrEqual(1);
  });

  test('hidden contract appears after discovery trigger', async () => {
    await recordContractTrigger(user._id, 'deep_discount_deal', { increment: 1 });
    const hub = await getContractsHubForUser(user._id, 'final10');
    const hidden = hub.appContracts.find((c) => c.id === 'final10_hidden_signal');
    expect(hidden).toBeTruthy();
    expect(hidden.isDiscovered).toBe(true);
    expect(hidden.title).not.toBe('???');
  });

  test('tryAcquireContractClaim is idempotent under race', async () => {
    const contract = getContractById('final10_scout_pilot');
    await recordContractTrigger(user._id, 'scout_flight_run', { increment: 1 });

    const first = await tryAcquireContractClaim(user._id, contract);
    expect(first.ok).toBe(true);

    const second = await tryAcquireContractClaim(user._id, contract);
    expect(second.ok).toBe(false);
    expect(second.error).toBe('already_claimed');
  });
});
