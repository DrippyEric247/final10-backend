/**
 * Secure forgot-password / reset-password flow.
 *
 * - Raw token is emailed once; only SHA-256 hash is stored.
 * - Token expires after 30 minutes and is cleared after successful reset.
 * - Never reveals whether an email exists in the system.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('./emailService');

const RESET_TOKEN_BYTES = 32;
const RESET_TTL_MS = 30 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

/** Generic response — always the same whether or not the email exists. */
const GENERIC_FORGOT_MESSAGE = 'If an account exists, we sent reset instructions.';

function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function generateResetToken() {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

/**
 * Issue a reset token and email it if the account exists.
 * Returns the same message in all cases (no email enumeration).
 */
async function requestPasswordReset(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  const user = await User.findOne({ email: normalized })
    .select('+passwordResetTokenHash +passwordResetExpiresAt email firstName');

  if (!user) {
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  const rawToken = generateResetToken();
  user.passwordResetTokenHash = hashResetToken(rawToken);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
  await user.save();

  // Fire-and-forget email — failures are logged without exposing details to client.
  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetToken: rawToken,
      firstName: user.firstName,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[password-reset] email send failed', err.message);
  }

  return { message: GENERIC_FORGOT_MESSAGE };
}

/**
 * Validate token and set a new password. Token is single-use (cleared atomically).
 */
async function resetPasswordWithToken(rawToken, newPassword) {
  const token = String(rawToken || '').trim();
  if (!token) {
    const err = new Error('Invalid or expired reset link.');
    err.status = 400;
    err.code = 'INVALID_RESET_TOKEN';
    throw err;
  }

  const tokenHash = hashResetToken(token);
  const passwordHash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);

  // Atomic find-and-update so the token cannot be reused even under race.
  const user = await User.findOneAndUpdate(
    {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    },
    {
      $set: { password: passwordHash },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    },
    { new: true }
  ).select('_id email');

  if (!user) {
    const err = new Error('Invalid or expired reset link.');
    err.status = 400;
    err.code = 'INVALID_RESET_TOKEN';
    throw err;
  }

  return { message: 'Password reset successful. Please log in.', userId: user._id };
}

module.exports = {
  RESET_TTL_MS,
  GENERIC_FORGOT_MESSAGE,
  hashResetToken,
  requestPasswordReset,
  resetPasswordWithToken,
};
