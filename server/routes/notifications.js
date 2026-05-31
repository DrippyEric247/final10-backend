const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

router.get('/', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('notifications');
  if (!user) return res.status(404).json({ message: 'User not found' });

  const notifications = (user.notifications || []).slice(0, 50);
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const alertUnreadCount = notifications.filter(
    (n) => n.kind === 'alert_match' && !n.readAt
  ).length;

  res.json({ notifications, unreadCount, alertUnreadCount });
});

router.patch('/read', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const kind = req.body?.kind ? String(req.body.kind) : null;
  const now = new Date();

  user.notifications = (user.notifications || []).map((n) => {
    const row = n.toObject ? n.toObject() : { ...n };
    if (row.readAt) return row;
    if (kind && row.kind !== kind) return row;
    return { ...row, readAt: now };
  });

  await user.save();

  const alertUnreadCount = user.notifications.filter(
    (n) => n.kind === 'alert_match' && !n.readAt
  ).length;

  res.json({ ok: true, alertUnreadCount });
});

module.exports = router;
