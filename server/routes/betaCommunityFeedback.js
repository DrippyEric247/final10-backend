const express = require('express');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { requireAdminAccess } = require('../middleware/requireRole');
const {
  getPublicSnapshot,
  castVote,
  submitReview,
  adminUpdateConfig,
  adminAddTopic,
  submitMembershipFeedback,
  listMembershipFeedback,
  submitSavvyShopFeedback,
  listSectionFeedback,
} = require('../services/betaCommunityFeedbackService');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const snapshot = await getPublicSnapshot(userId);
    res.json({ success: true, ...snapshot });
  } catch (err) {
    console.error('[betaCommunity] GET failed:', err?.message);
    res.status(500).json({ success: false, message: 'Failed to load community feedback' });
  }
});

router.post('/vote', auth, async (req, res) => {
  try {
    const { topicId } = req.body || {};
    if (!topicId) {
      return res.status(400).json({ success: false, message: 'topicId is required' });
    }
    const result = await castVote(req.user, String(topicId));
    if (!result.ok) {
      return res.status(result.code === 'ALREADY_VOTED' ? 409 : 400).json(result);
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[betaCommunity] vote failed:', err?.message);
    res.status(500).json({ success: false, message: 'Failed to record vote' });
  }
});

router.post('/review', auth, async (req, res) => {
  try {
    const { rating, enjoyed, improve, reportBug } = req.body || {};
    const result = await submitReview(req.user, { rating, enjoyed, improve, reportBug });
    if (!result.ok) {
      return res.status(result.code === 'DAILY_LIMIT' ? 409 : 400).json(result);
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[betaCommunity] review failed:', err?.message);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
});

router.post('/membership-feedback', auth, async (req, res) => {
  try {
    const { type, message } = req.body || {};
    const result = await submitMembershipFeedback(req.user, { type, message });
    if (!result.ok) {
      return res.status(result.code === 'DAILY_LIMIT' ? 409 : 400).json(result);
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[betaCommunity] membership feedback failed:', err?.message);
    res.status(500).json({ success: false, message: 'Failed to save membership feedback' });
  }
});

router.get('/admin/membership-feedback', auth, requireAdminAccess(), async (req, res) => {
  try {
    const items = await listMembershipFeedback({ limit: Number(req.query?.limit) || 50 });
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to load feedback' });
  }
});

router.post('/savvy-shop-feedback', auth, async (req, res) => {
  try {
    const { type, message } = req.body || {};
    const result = await submitSavvyShopFeedback(req.user, { type, message });
    if (!result.ok) {
      return res.status(result.code === 'DAILY_LIMIT' ? 409 : 400).json(result);
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[betaCommunity] savvy shop feedback failed:', err?.message);
    res.status(500).json({ success: false, message: 'Failed to save Savvy Shop feedback' });
  }
});

router.get('/admin/savvy-shop-feedback', auth, requireAdminAccess(), async (req, res) => {
  try {
    const items = await listSectionFeedback({
      section: 'savvy_shop',
      limit: Number(req.query?.limit) || 50,
    });
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to load feedback' });
  }
});

router.get('/admin', auth, requireAdminAccess(), async (req, res) => {
  try {
    const snapshot = await getPublicSnapshot();
    res.json({ success: true, ...snapshot });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || 'Admin load failed' });
  }
});

router.put('/admin/config', auth, requireAdminAccess(), async (req, res) => {
  try {
    const snapshot = await adminUpdateConfig(req.body || {});
    res.json({ success: true, ...snapshot });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || 'Config update failed' });
  }
});

router.post('/admin/topics', auth, requireAdminAccess(), async (req, res) => {
  try {
    const snapshot = await adminAddTopic(req.body || {});
    res.json({ success: true, ...snapshot });
  } catch (err) {
    res.status(400).json({ success: false, message: err?.message || 'Could not add topic' });
  }
});

module.exports = router;
