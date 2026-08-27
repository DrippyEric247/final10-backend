const { createSpinTraceId, createSpinTracer } = require('../services/perkMachineSpinTrace');

describe('perkMachineSpinTrace', () => {
  test('createSpinTraceId matches PM-<ts>-<hex> format', () => {
    const id = createSpinTraceId();
    expect(id).toMatch(/^PM-\d+-[a-f0-9]{6}$/);
  });

  test('tracer records lastOkStage', async () => {
    const trace = createSpinTracer('PM-test-abc123');
    trace.logOk('AUTH_OK', {});
    expect(trace.getLastOkStage()).toBe('AUTH_OK');
    await trace.runStage('MOCK_STAGE', async () => ({ ok: true }));
    expect(trace.getLastOkStage()).toBe('MOCK_STAGE');
  });
});
