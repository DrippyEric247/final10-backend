/**
 * Auth email normalization + schema tests (no Mongo required).
 *
 * Run: cd server && npm test -- __tests__/auth-email-normalization.test.js
 */
const schemas = require('../validation/schemas');

describe('auth email normalization (BUG-001)', () => {
  const baseSignup = {
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser01',
    password: 'ValidPass123!',
    referralCode: '',
  };

  it('lowercases and trims email on signup schema', () => {
    const { error, value } = schemas.authSignupBody.validate({
      ...baseSignup,
      email: '  User@Email.COM  ',
    });
    expect(error).toBeUndefined();
    expect(value.email).toBe('user@email.com');
  });

  it('lowercases and trims email on login schema', () => {
    const { error, value } = schemas.authLoginBody.validate({
      email: ' User@Email.com ',
      password: 'secret',
    });
    expect(error).toBeUndefined();
    expect(value.email).toBe('user@email.com');
  });

  it('lowercases email on forgot-password schema', () => {
    const { error, value } = schemas.authForgotPasswordBody.validate({
      email: 'User@Email.com',
    });
    expect(error).toBeUndefined();
    expect(value.email).toBe('user@email.com');
  });

  it('rejects passwords shorter than 10 chars on signup schema', () => {
    const { error } = schemas.authSignupBody.validate({
      ...baseSignup,
      email: 'test@example.com',
      password: 'short1',
    });
    expect(error).toBeDefined();
  });
});
