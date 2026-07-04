const { grantSoundtracks } = require('../services/soundtrackService');

describe('soundtrackService', () => {
  test('grantSoundtracks dedupes existing ownership', () => {
    const user = { unlockedSoundtrackIds: ['final10_menu_theme_v1'] };
    const result = grantSoundtracks(user, [
      'final10_menu_theme_v1',
      'perk_machine_theme',
    ]);

    expect(result.newlyUnlocked).toEqual(['perk_machine_theme']);
    expect(result.alreadyOwned).toEqual(['final10_menu_theme_v1']);
    expect(user.unlockedSoundtrackIds).toEqual([
      'final10_menu_theme_v1',
      'perk_machine_theme',
    ]);
  });
});
