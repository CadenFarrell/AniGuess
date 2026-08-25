import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREFS, MAX_GUESS_SECONDS, MAX_ROUNDS, MIN_GUESS_SECONDS, MIN_ROUNDS,
} from './prefs';
import { CLUE_MODES, needsCardPool } from './rules';
import { CLUE_MODE_HELP } from './help';
import { CARD_POOLS } from './utils/cards';

// AniWave's defaults carry one property that is not a preference at all, and a
// screen that reads a mode out of rules.js without the copy to go with it.
// Both are one edit away from breaking silently, so both are pinned here.

describe('DEFAULT_PREFS', () => {
  // THE NO-LIST PROPERTY. AniWave is the only game in the arcade playable before
  // an AniList import has ever run, and `clueMode` is the entire reason —
  // mergePrefs fills a missing key from the defaults, so everyone who never
  // opens the settings card gets the mode that deals nothing. CLAUDE.md says
  // changing this is a breaking change to be decided out loud; this is what
  // makes "out loud" mean something, because nothing else in the suite notices.
  it('opens in a mode that needs no anime list', () => {
    expect(DEFAULT_PREFS.clueMode).toBe('text');
    // The assertion that actually matters: the id is only a label, and a future
    // rename that kept 'text' while teaching it to deal would pass the line
    // above and break the property anyway.
    expect(needsCardPool(DEFAULT_PREFS.clueMode)).toBe(false);
  });

  it('covers every option the two screens can change', () => {
    expect(Object.keys(DEFAULT_PREFS).sort()).toEqual([
      'cardPool', 'clueMode', 'guessSeconds', 'rounds', 'sharedOnly', 'timed',
    ]);
  });

  // DEFAULT_PREFS is the schema mergePrefs validates against, and it only knows
  // TYPES — a default naming a mode or a pool that no longer exists would merge
  // cleanly and then deal nothing.
  it('defaults to values the game still recognises', () => {
    expect(CLUE_MODES).toContain(DEFAULT_PREFS.clueMode);
    expect(CARD_POOLS).toContain(DEFAULT_PREFS.cardPool);
  });

  // A default outside its own field's bounds arrives at a NumberInput that
  // clamps it, so the saved value and the rendered one disagree on first paint
  // and the reset link sits lit on an untouched card.
  it('defaults inside the bounds its own fields enforce', () => {
    expect(DEFAULT_PREFS.rounds).toBeGreaterThanOrEqual(MIN_ROUNDS);
    expect(DEFAULT_PREFS.rounds).toBeLessThanOrEqual(MAX_ROUNDS);
    expect(DEFAULT_PREFS.guessSeconds).toBeGreaterThanOrEqual(MIN_GUESS_SECONDS);
    expect(DEFAULT_PREFS.guessSeconds).toBeLessThanOrEqual(MAX_GUESS_SECONDS);
  });

  it('bounds a round count that is playable at both ends', () => {
    expect(MIN_ROUNDS).toBeGreaterThan(0);
    expect(MAX_ROUNDS).toBeGreaterThan(MIN_ROUNDS);
    expect(MAX_GUESS_SECONDS).toBeGreaterThan(MIN_GUESS_SECONDS);
  });
});

describe('clue mode copy', () => {
  // ClueModePicker maps over CLUE_MODES and reads CLUE_MODE_HELP[id].label
  // UNGUARDED, so a fourth mode added to rules.js without copy does not degrade
  // — it throws on mount and takes both setup screens down with it. The two
  // lists are meant to be edited together; this is what says so.
  it('has an entry for every mode rules.js will offer', () => {
    expect(Object.keys(CLUE_MODE_HELP).sort()).toEqual([...CLUE_MODES].sort());
  });

  it('gives every mode the three fields the picker renders', () => {
    for (const mode of CLUE_MODES) {
      const help = CLUE_MODE_HELP[mode];
      expect(help.label, mode).toBeTruthy();
      expect(help.tag, mode).toBeTruthy();
      expect(help.short, mode).toBeTruthy();
    }
  });

  // The tag is the control's whole point — it is where a player learns that
  // exactly one mode needs nothing imported — so it has to agree with the
  // function that decides.
  it('tags exactly the modes that need a card pool as needing a list', () => {
    for (const mode of CLUE_MODES) {
      expect(CLUE_MODE_HELP[mode].tag, mode)
        .toBe(needsCardPool(mode) ? 'Needs a list' : 'No list needed');
    }
  });
});
