const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FounderMessageError,
  submitFounderMessage,
} = require('../services/founderMessageService');

test('validatePayload rejects short message', async () => {
  await assert.rejects(
    () =>
      submitFounderMessage(
        {
          subject: 'general_feedback',
          name: 'Eric',
          email: 'eric@example.com',
          message: 'too short',
        },
        { ip: '127.0.0.1' }
      ),
    (err) => err instanceof FounderMessageError && err.code === 'INVALID_MESSAGE'
  );
});

test('validatePayload rejects invalid email', async () => {
  await assert.rejects(
    () =>
      submitFounderMessage(
        {
          subject: 'partnership',
          name: 'Eric',
          email: 'not-an-email',
          message: 'This is a long enough partnership inquiry message.',
        },
        { ip: '127.0.0.1' }
      ),
    (err) => err instanceof FounderMessageError && err.code === 'INVALID_EMAIL'
  );
});
