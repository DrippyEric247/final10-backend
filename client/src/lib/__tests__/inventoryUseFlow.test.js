import {
  beginInventoryUseConfirmation,
  lockPageScrollForInventoryModal,
  unlockPageScrollForInventoryModal,
} from '../inventoryUseFlow';

describe('inventoryUseFlow', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  });

  it('beginInventoryUseConfirmation opens confirmation without scrolling', () => {
    window.scrollTo = jest.fn();
    const open = jest.fn();
    const item = { itemType: 'savvy_level_xp_token' };

    beginInventoryUseConfirmation(open, item);

    expect(open).toHaveBeenCalledWith(item);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('locks and unlocks body scroll for modal', () => {
    lockPageScrollForInventoryModal();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');

    unlockPageScrollForInventoryModal();
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.touchAction).toBe('');
  });
});
