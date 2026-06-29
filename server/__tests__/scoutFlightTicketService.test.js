const {
  buildTournamentTicketProgress,
  recordSpinForTournamentTicket,
  SPINS_PER_TOURNAMENT_TICKET,
} = require('../services/scoutFlightTicketService');

describe('scoutFlightTicketService', () => {
  function mockUser() {
    return {
      eventInventory: { scoutFlightTicket: 0 },
      perkMachine: { ticketSpinProgress: 0 },
      markModified: jest.fn(),
    };
  }

  it('exposes configurable spins per ticket', () => {
    expect(SPINS_PER_TOURNAMENT_TICKET).toBeGreaterThan(0);
  });

  it('awards a ticket and resets progress after enough spins', () => {
    const user = mockUser();
    const pm = user.perkMachine;

    for (let i = 0; i < SPINS_PER_TOURNAMENT_TICKET - 1; i += 1) {
      const r = recordSpinForTournamentTicket(user, pm);
      expect(r.ticketEarned).toBe(false);
    }

    const final = recordSpinForTournamentTicket(user, pm);
    expect(final.ticketEarned).toBe(true);
    expect(final.ticketsEarned).toBe(1);
    expect(user.eventInventory.scoutFlightTicket).toBe(1);
    expect(pm.ticketSpinProgress).toBe(0);
    expect(final.tournamentTicketProgress.current).toBe(0);
  });

  it('builds progress payload for status API', () => {
    const user = mockUser();
    user.perkMachine.ticketSpinProgress = 6;
    user.eventInventory.scoutFlightTicket = 2;
    const progress = buildTournamentTicketProgress(user, user.perkMachine);
    expect(progress.current).toBe(6);
    expect(progress.required).toBe(SPINS_PER_TOURNAMENT_TICKET);
    expect(progress.spinsRemaining).toBe(SPINS_PER_TOURNAMENT_TICKET - 6);
    expect(progress.ticketsOwned).toBe(2);
  });
});
