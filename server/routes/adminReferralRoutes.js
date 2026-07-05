const express = require('express');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
const {
  listTrackingLogs,
  manualGrantFromLog,
} = require('../services/referralTrackingService');

const router = express.Router();

/**
 * GET /api/admin/referrals/logs?status=manual_needed
 */
router.get('/logs', auth, requireAdminAccess(), async (req, res) => {
  try {
    const { status, limit } = req.query;
    const logs = await listTrackingLogs({ status, limit });
    return res.json({ logs, count: logs.length });
  } catch (err) {
    console.error('[admin/referrals/logs]', err?.message || err);
    return res.status(500).json({ message: 'Could not load referral logs' });
  }
});

/**
 * POST /api/admin/referrals/manual-grant
 * Body: { referralLogId }
 */
router.post('/manual-grant', auth, requireAdminAccess(), async (req, res) => {
  try {
    const { referralLogId } = req.body || {};
    if (!referralLogId) {
      return res.status(400).json({ message: 'referralLogId is required' });
    }

    const adminUserId = req.user?.id || req.user?._id;
    const result = await manualGrantFromLog(referralLogId, adminUserId);

    if (!result.ok) {
      return res.status(result.status || 400).json({ message: result.message });
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[admin/referrals/manual-grant]', err?.message || err);
    return res.status(500).json({ message: 'Manual grant failed' });
  }
});

module.exports = router;
