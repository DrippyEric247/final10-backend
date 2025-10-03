const router = require('express').Router();
const Alert = require('../models/Alert');
const auth = require('../middleware/auth');  // your JWT middleware

// Get my alerts
router.get('/', auth, async (req, res) => {
  const alerts = await Alert.find({ user: req.user.id }).sort('-updatedAt');
  res.json(alerts);
});

// Create alert
router.post('/', auth, async (req, res) => {
  const { name, keywords = [], maxPrice, minConfidence = 70, sources = ['ebay'] } = req.body;
  if (!name || !Array.isArray(keywords)) return res.status(400).json({ message: 'Invalid payload' });

  const alert = await Alert.create({
    user: req.user.id,
    name,
    keywords: keywords.map(k => String(k).trim()).filter(Boolean),
    maxPrice,
    minConfidence,
    sources,
  });

  res.status(201).json(alert);
});

// Toggle on/off
router.patch('/:id/toggle', auth, async (req, res) => {
  const alert = await Alert.findOne({ _id: req.params.id, user: req.user.id });
  if (!alert) return res.status(404).json({ message: 'Not found' });
  alert.isActive = !alert.isActive;
  await alert.save();
  res.json(alert);
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  const del = await Alert.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!del) return res.status(404).json({ message: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;



































