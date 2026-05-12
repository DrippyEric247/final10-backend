/**
 * /api/parties — "Squad Sync" v1 routes.
 *
 * Endpoints:
 *   POST   /api/parties                     create a party (host = caller)
 *   GET    /api/parties/me                  get the caller's current party state
 *   GET    /api/parties/:id                 fetch a party's state (must be member)
 *   POST   /api/parties/:id/invite          (host-only) record an invite for a follower
 *   POST   /api/parties/:id/join            join a party (subject to eligibility)
 *   POST   /api/parties/:id/leave           leave the caller's party
 *   POST   /api/parties/:id/start           start the session (host-only)
 *   POST   /api/parties/:id/end             end the session (host-only)
 *   POST   /api/parties/:id/events          record a valid action during session
 *   GET    /api/parties/:id/summary         fetch last session summary
 */
const express = require('express');
const auth = require('../middleware/auth');
const Party = require('../models/Party');
const User = require('../models/User');
const PartySessionEvent = require('../models/PartySessionEvent');
const partyService = require('../services/partyService');

const router = express.Router();

function serializeMember(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    username: user.username || null,
    firstName: user.firstName || null,
    avatarUrl: user.avatarUrl || null,
  };
}

async function hydrateMembers(party) {
  const ids = (party.memberUserIds || []).map(String);
  if (!ids.length) return [];
  const rows = await User.find({ _id: { $in: ids } })
    .select('username firstName avatarUrl')
    .lean();
  return rows.map(serializeMember);
}

/** Build the full response the client wants for /me, /:id, /start, /end etc. */
async function buildResponse(party, { personalMultipliers = {} } = {}) {
  const state = await partyService.computeState(party, { personalMultipliers });
  const members = await hydrateMembers(party);
  return { party: state, members };
}

/** POST /api/parties — create a party with caller as host. */
router.post('/', auth, async (req, res) => {
  try {
    // One party at a time per user
    const existing = await partyService.findPartyForUser(req.user._id);
    if (existing) {
      return res.status(409).json({
        code: 'ALREADY_IN_PARTY',
        message: 'You are already in a squad.',
        partyId: String(existing._id),
      });
    }

    const name = String(req.body?.name || 'Squad').trim().slice(0, 40) || 'Squad';

    const party = await Party.create({
      hostUserId: req.user._id,
      memberUserIds: [req.user._id],
      name,
      maxMembers: partyService.PARTY.MAX_MEMBERS,
      status: 'idle',
      expiresAt: new Date(Date.now() + partyService.PARTY.LOBBY_EXPIRY_MS),
    });

    return res.json(await buildResponse(party));
  } catch (err) {
    console.error('parties.create.error', err);
    return res.status(500).json({ code: 'CREATE_FAILED', message: 'Failed to create squad' });
  }
});

/** GET /api/parties/me — caller's active/idle/cooldown party. */
router.get('/me', auth, async (req, res) => {
  try {
    const party = await partyService.findPartyForUser(req.user._id);
    if (!party) return res.json({ party: null, members: [] });
    return res.json(await buildResponse(party));
  } catch (err) {
    console.error('parties.me.error', err);
    return res.status(500).json({ code: 'STATE_FAILED', message: 'Failed to load squad' });
  }
});

/** GET /api/parties/:id — state for a specific party (must be member). */
router.get('/:id', auth, async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ code: 'NOT_FOUND', message: 'Squad not found' });
    if (!party.isMember(req.user._id)) {
      return res.status(403).json({ code: 'NOT_MEMBER', message: 'Not a member' });
    }
    return res.json(await buildResponse(party));
  } catch (err) {
    console.error('parties.get.error', err);
    return res.status(500).json({ code: 'STATE_FAILED', message: 'Failed to load squad' });
  }
});

/**
 * POST /api/parties/:id/invite
 * Host-only endpoint. Does NOT auto-add the invitee; it just validates that
 * the target user is a follower and returns their invite link/eligibility.
 * The invitee still has to call /join themselves.
 */
router.post('/:id/invite', auth, async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ code: 'NOT_FOUND', message: 'Squad not found' });
    if (!party.hostUserId.equals(req.user._id)) {
      return res.status(403).json({ code: 'NOT_HOST', message: 'Only the host can invite' });
    }
    const targetId = String(req.body?.userId || '').trim();
    if (!targetId) {
      return res.status(400).json({ code: 'MISSING_USER', message: 'Missing userId' });
    }
    if (party.isFull()) {
      return res.status(400).json({ code: 'PARTY_FULL', message: 'Squad is full' });
    }
    const target = await User.findById(targetId).select('username firstName avatarUrl followers following createdAt isBanned isFlagged');
    if (!target) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });

    const host = req.user;
    const check = await partyService.canJoinParty(target, host, party);
    if (!check.ok) return res.status(400).json(check);

    return res.json({
      ok: true,
      partyId: String(party._id),
      invitee: serializeMember(target),
    });
  } catch (err) {
    console.error('parties.invite.error', err);
    return res.status(500).json({ code: 'INVITE_FAILED', message: 'Failed to invite' });
  }
});

/** POST /api/parties/:id/join — join an existing party. */
router.post('/:id/join', auth, async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ code: 'NOT_FOUND', message: 'Squad not found' });
    const host = await User.findById(party.hostUserId).select('username firstName followers following');
    if (!host) return res.status(404).json({ code: 'HOST_MISSING', message: 'Host not found' });

    const check = await partyService.canJoinParty(req.user, host, party);
    if (!check.ok) return res.status(400).json(check);

    party.memberUserIds.push(req.user._id);
    await party.save();

    return res.json(await buildResponse(party));
  } catch (err) {
    console.error('parties.join.error', err);
    return res.status(500).json({ code: 'JOIN_FAILED', message: 'Failed to join squad' });
  }
});

/** POST /api/parties/:id/leave — leave a squad. */
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ code: 'NOT_FOUND', message: 'Squad not found' });
    if (!party.isMember(req.user._id)) {
      return res.status(400).json({ code: 'NOT_MEMBER', message: 'Not a member' });
    }

    const uid = String(req.user._id);
    party.memberUserIds = (party.memberUserIds || []).filter((m) => String(m) !== uid);

    // If host leaves, promote the next member; if empty, end the party.
    if (party.hostUserId.equals(req.user._id)) {
      if (party.memberUserIds.length > 0) {
        party.hostUserId = party.memberUserIds[0];
      } else {
        party.status = 'ended';
      }
    }

    // If too few members remain to maintain an active session, cool it down.
    if (party.status === 'active' && party.memberUserIds.length < 2) {
      await partyService.endSession(party);
    } else {
      await party.save();
    }

    return res.json({ ok: true, partyId: String(party._id), status: party.status });
  } catch (err) {
    console.error('parties.leave.error', err);
    return res.status(500).json({ code: 'LEAVE_FAILED', message: 'Failed to leave squad' });
  }
});

/** POST /api/parties/:id/start — host starts an active session. */
router.post('/:id/start', auth, async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ code: 'NOT_FOUND', message: 'Squad not found' });
    if (!party.hostUserId.equals(req.user._id)) {
      return res.status(403).json({ code: 'NOT_HOST', message: 'Only the host can start' });
    }
    await partyService.startSession(party);
    return res.json(await buildResponse(party));
  } catch (err) {
    console.error('parties.start.error', err);
    const code = err.code === 'COOLDOWN' || err.code === 'NOT_ENOUGH_MEMBERS' ? 400 : 500;
    return res.status(code).json({
      code: err.code || 'START_FAILED',
      message: err.message || 'Failed to start session',
    });
  }
});

/** POST /api/parties/:id/end — host ends a session early. */
router.post('/:id/end', auth, async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ code: 'NOT_FOUND', message: 'Squad not found' });
    if (!party.hostUserId.equals(req.user._id)) {
      return res.status(403).json({ code: 'NOT_HOST', message: 'Only the host can end' });
    }
    const summary = await partyService.endSession(party);
    const payload = await buildResponse(party);
    return res.json({ ...payload, summary });
  } catch (err) {
    console.error('parties.end.error', err);
    return res.status(500).json({ code: 'END_FAILED', message: 'Failed to end session' });
  }
});

/** GET /api/parties/:id/summary — last session summary. */
router.get('/:id/summary', auth, async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ code: 'NOT_FOUND', message: 'Squad not found' });
    if (!party.isMember(req.user._id)) {
      return res.status(403).json({ code: 'NOT_MEMBER', message: 'Not a member' });
    }
    const summary = await partyService.buildSessionSummary(party);
    return res.json({ partyId: String(party._id), summary });
  } catch (err) {
    console.error('parties.summary.error', err);
    return res.status(500).json({ code: 'SUMMARY_FAILED', message: 'Failed to load summary' });
  }
});

/**
 * POST /api/parties/:id/events — record a valid party action.
 *
 * Body: { eventType, personalMultiplier, baseSavvy, refId? }
 *
 * The server caller can use the returned savvyEarned to credit points in
 * other ledger flows (already handled by offers/auctions routes). This
 * endpoint is the source of truth for energy + boost state.
 */
router.post('/:id/events', auth, async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ code: 'NOT_FOUND', message: 'Squad not found' });

    const result = await partyService.recordEvent({
      party,
      userId: req.user._id,
      eventType: String(req.body?.eventType || ''),
      personalMultiplier: Number(req.body?.personalMultiplier) || 1,
      baseSavvy: Number(req.body?.baseSavvy) || 0,
      refId: req.body?.refId ? String(req.body.refId) : null,
    });

    return res.json({
      ok: true,
      event: {
        id: String(result.event._id),
        eventType: result.event.eventType,
        energyGranted: result.energyGranted,
        savvyEarned: result.savvyEarned,
        finalMultiplier: result.finalMultiplier,
      },
      partyState: result.partyState,
    });
  } catch (err) {
    if (err.code === 'NOT_ACTIVE' || err.code === 'NOT_MEMBER' || err.code === 'INVALID_EVENT') {
      return res.status(400).json({ code: err.code, message: err.message });
    }
    console.error('parties.events.error', err);
    return res.status(500).json({ code: 'EVENT_FAILED', message: 'Failed to record event' });
  }
});

module.exports = router;
