const express = require('express');
const fs = require('fs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const {
  buildLibraryPayload,
  assertTrackAccess,
} = require('../services/soundtrackService');
const { HttpError } = require('../middleware/apiErrors');

const router = express.Router();

router.get('/library', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('unlockedSoundtrackIds menuMusicTrackId');
    if (!user) return next(new HttpError(404, 'USER_NOT_FOUND', 'User not found'));
    return res.json(buildLibraryPayload(user));
  } catch (err) {
    return next(err);
  }
});

router.get('/:trackId/preview', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('unlockedSoundtrackIds');
    if (!user) return next(new HttpError(404, 'USER_NOT_FOUND', 'User not found'));

    const { track, absPath } = assertTrackAccess(user, req.params.trackId);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="${track.downloadFilename}"`);

    const stream = fs.createReadStream(absPath);
    stream.on('error', () => {
      if (!res.headersSent) next(new HttpError(503, 'AUDIO_UNAVAILABLE', 'Could not stream audio'));
    });
    stream.pipe(res);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: err.code, message: err.message });
    return next(err);
  }
});

router.get('/:trackId/download', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('unlockedSoundtrackIds');
    if (!user) return next(new HttpError(404, 'USER_NOT_FOUND', 'User not found'));

    const { track, absPath } = assertTrackAccess(user, req.params.trackId);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${track.downloadFilename}"`);

    const stream = fs.createReadStream(absPath);
    stream.on('error', () => {
      if (!res.headersSent) next(new HttpError(503, 'AUDIO_UNAVAILABLE', 'Could not download audio'));
    });
    stream.pipe(res);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: err.code, message: err.message });
    return next(err);
  }
});

/** Reserve menu music selection for a future settings flow. */
router.post('/menu-music', auth, async (req, res, next) => {
  try {
    const trackId = String(req.body?.trackId || '').trim();
    const user = await User.findById(req.user._id);
    if (!user) return next(new HttpError(404, 'USER_NOT_FOUND', 'User not found'));

    const { getTrackById } = require('../config/soundtrackCatalog');
    const track = getTrackById(trackId);
    if (!track) return next(new HttpError(404, 'TRACK_NOT_FOUND', 'Soundtrack not found'));
    if (!track.menuEligible) {
      return next(new HttpError(400, 'NOT_MENU_ELIGIBLE', 'This track cannot be set as menu music'));
    }
    if (!(user.unlockedSoundtrackIds || []).includes(trackId)) {
      return next(new HttpError(403, 'TRACK_LOCKED', 'Unlock this soundtrack first'));
    }

    user.menuMusicTrackId = trackId;
    await user.save();
    return res.json({ ok: true, menuMusicTrackId: trackId });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
