/**
 * Scout Flight Tournament Ticket progress — modular spin counter + grant logic.
 */

const { SPINS_PER_TOURNAMENT_TICKET } = require('../config/scoutFlightTicketConfig');

function ensureEventInventory(user) {
  if (!user.eventInventory || typeof user.eventInventory !== 'object') {
    user.eventInventory = {};
  }
  const inv = user.eventInventory;
  if (typeof inv.scoutFlightTicket !== 'number') inv.scoutFlightTicket = 0;
  return inv;
}

function ensureTicketSpinProgress(pm) {
  if (typeof pm.ticketSpinProgress !== 'number' || pm.ticketSpinProgress < 0) {
    pm.ticketSpinProgress = 0;
  }
  return pm.ticketSpinProgress;
}

function buildTournamentTicketProgress(user, pm) {
  const required = SPINS_PER_TOURNAMENT_TICKET;
  const current = ensureTicketSpinProgress(pm);
  const inv = ensureEventInventory(user);
  const ticketsOwned = Number(inv.scoutFlightTicket) || 0;

  return {
    current,
    required,
    spinsRemaining: Math.max(0, required - current),
    ticketsOwned,
    progressPct: required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 100,
  };
}

/**
 * Increment spin progress after a successful Perk Machine spin.
 * @returns {{ ticketEarned: boolean, ticketsEarned: number, tournamentTicketProgress: object }}
 */
function recordSpinForTournamentTicket(user, pm) {
  ensureEventInventory(user);
  let progress = ensureTicketSpinProgress(pm) + 1;
  let ticketsEarned = 0;

  while (progress >= SPINS_PER_TOURNAMENT_TICKET) {
    progress -= SPINS_PER_TOURNAMENT_TICKET;
    user.eventInventory.scoutFlightTicket = Number(user.eventInventory.scoutFlightTicket) + 1;
    ticketsEarned += 1;
  }

  pm.ticketSpinProgress = progress;
  user.markModified('perkMachine');
  user.markModified('eventInventory');

  return {
    ticketEarned: ticketsEarned > 0,
    ticketsEarned,
    tournamentTicketProgress: buildTournamentTicketProgress(user, pm),
  };
}

module.exports = {
  SPINS_PER_TOURNAMENT_TICKET,
  buildTournamentTicketProgress,
  recordSpinForTournamentTicket,
  ensureEventInventory,
};
