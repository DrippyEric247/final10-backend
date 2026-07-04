const fs = require('fs');
const path = require('path');
const {
  getTrackById,
  listAllTracks,
  expandRewardTrackIds,
} = require('../config/soundtrackCatalog');

function resolveAudioAbsolutePath(fileKey) {
  const key = String(fileKey || '').trim().replace(/^\/+/, '');
  if (!key || key.includes('..')) return null;

  const candidates = [
    path.join(__dirname, '../../client/public/audio', key),
    path.join(__dirname, '../private-audio', key),
  ];

  for (const abs of candidates) {
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function userOwnsTrack(user, trackId) {
  const ids = user?.unlockedSoundtrackIds || [];
  return ids.includes(String(trackId));
}

/**
 * Grant soundtrack ownership without duplicates.
 * @returns {{ newlyUnlocked: string[], alreadyOwned: string[] }}
 */
function grantSoundtracks(user, trackIds = []) {
  const set = new Set(user.unlockedSoundtrackIds || []);
  const newlyUnlocked = [];
  const alreadyOwned = [];

  for (const raw of trackIds) {
    const id = String(raw || '').trim();
    if (!id || !getTrackById(id)) continue;
    if (set.has(id)) {
      alreadyOwned.push(id);
      continue;
    }
    set.add(id);
    newlyUnlocked.push(id);
  }

  user.unlockedSoundtrackIds = [...set];
  return { newlyUnlocked, alreadyOwned };
}

function grantFromBattlePassReward(user, reward) {
  const trackIds = expandRewardTrackIds(reward);
  return grantSoundtracks(user, trackIds);
}

function buildLibraryPayload(user) {
  const unlocked = new Set(user?.unlockedSoundtrackIds || []);
  const tracks = listAllTracks().map((track) => ({
    id: track.id,
    title: track.title,
    description: track.description,
    source: track.source,
    menuEligible: track.menuEligible,
    unlocked: unlocked.has(track.id),
    lockedTeaser: track.lockedTeaser,
  }));

  return {
    tracks,
    unlockedTrackIds: [...unlocked],
    menuMusicTrackId: user?.menuMusicTrackId || null,
  };
}

function assertTrackAccess(user, trackId) {
  const track = getTrackById(trackId);
  if (!track) {
    const err = new Error('Soundtrack not found');
    err.status = 404;
    err.code = 'TRACK_NOT_FOUND';
    throw err;
  }
  if (!userOwnsTrack(user, trackId)) {
    const err = new Error('Soundtrack not unlocked');
    err.status = 403;
    err.code = 'TRACK_LOCKED';
    throw err;
  }
  const absPath = resolveAudioAbsolutePath(track.fileKey);
  if (!absPath) {
    const err = new Error('Audio file unavailable');
    err.status = 503;
    err.code = 'AUDIO_UNAVAILABLE';
    throw err;
  }
  return { track, absPath };
}

module.exports = {
  resolveAudioAbsolutePath,
  userOwnsTrack,
  grantSoundtracks,
  grantFromBattlePassReward,
  buildLibraryPayload,
  assertTrackAccess,
};
