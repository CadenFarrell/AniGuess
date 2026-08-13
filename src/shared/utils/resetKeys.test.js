import { describe, it, expect } from 'vitest';
import { keysToClear, PRESERVED_KEYS } from './resetKeys';

describe('keysToClear', () => {
  it('clears in-progress game state', () => {
    const keys = keysToClear([
      'aniguess_session',
      'anifake_online_room',
      'anirank_tier_lists',
      'aniarcade_game_prefs',
    ]);
    expect(keys).toEqual([
      'aniguess_session',
      'anifake_online_room',
      'anirank_tier_lists',
      'aniarcade_game_prefs',
    ]);
  });

  it('never clears the player’s imported data', () => {
    const keys = keysToClear(['aniguess_profiles', 'aniarcade_active_profile', 'aniguess_session']);
    expect(keys).toEqual(['aniguess_session']);
  });

  // The bug this module exists for: the old reset named one key, so every key a
  // later game added survived it. A game that does not exist yet must still be
  // cleared without anyone remembering to come back here.
  it('clears keys belonging to a game that did not exist when this was written', () => {
    expect(keysToClear(['anibingo_online_room', 'anibingo_session'])).toEqual([
      'anibingo_online_room',
      'anibingo_session',
    ]);
  });

  it('keeps every preserved key, whatever else is stored', () => {
    const cleared = keysToClear([...PRESERVED_KEYS, 'some_game_session']);
    for (const preserved of PRESERVED_KEYS) {
      expect(cleared).not.toContain(preserved);
    }
    expect(cleared).toEqual(['some_game_session']);
  });

  it('survives junk and an empty store', () => {
    expect(keysToClear([])).toEqual([]);
    expect(keysToClear()).toEqual([]);
    expect(keysToClear(null)).toEqual([]);
    expect(keysToClear(['', 'ok'])).toEqual(['ok']);
  });
});
