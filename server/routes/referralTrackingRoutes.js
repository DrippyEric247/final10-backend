const express = require('express');
const {
  trackLinkVisit,
  normalizeReferralCode,
} = require('../services/referralTrackingService');

const router = express.Router();

/**
 * POST /api/referrals/track-visit
 * Public beacon when a user lands with ?ref= (fire-and-forget).
 */
router.post('/track-visit', async (req, res) => {
  try {
    const referralCode = normalizeReferralCode(
      req.body?.referralCode || req.query?.ref
    );

    if (!referralCode) {
      return res.status(400).json({ message: 'referralCode is required' });
    }

    const row = await trackLinkVisit(req, referralCode);

    return res.status(201).json({
      ok: true,
      logged: Boolean(row),
      referralLogId: row ? String(row._id) : null,
    });
  } catch (err) {
    console.error('[referrals/track-visit]', err?.message || err);
    return res.status(500).json({ message: 'Could not log referral visit' });
  }
});

module.exports = router;
