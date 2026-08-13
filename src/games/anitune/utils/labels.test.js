import { describe, it, expect } from 'vitest';
import { themeLabel, themeAndYear, songCredit } from './labels';

describe('themeLabel', () => {
  it('names the two types', () => {
    expect(themeLabel({ type: 'OP', sequence: 2 })).toBe('Opening 2');
    expect(themeLabel({ type: 'ED', sequence: 1 })).toBe('Ending 1');
  });

  // A show with a single ED stores null, not 1. "Ending null" reached the screen
  // once already.
  it('omits an absent sequence rather than printing it', () => {
    expect(themeLabel({ type: 'ED', sequence: null })).toBe('Ending');
    expect(themeLabel({ type: 'OP' })).toBe('Opening');
  });

  it('falls back for a type it does not know', () => {
    expect(themeLabel({ type: 'IN', sequence: 3 })).toBe('Theme 3');
    expect(themeLabel(undefined)).toBe('Theme');
  });
});

describe('themeAndYear', () => {
  it('joins both halves', () => {
    expect(themeAndYear({ type: 'ED', sequence: 2, year: 2020 })).toBe('Ending 2 · 2020');
  });

  it('leaves no stranded separator when the year is missing', () => {
    expect(themeAndYear({ type: 'ED', sequence: 2 })).toBe('Ending 2');
    expect(themeAndYear({ type: 'ED', sequence: 2, year: null })).toBe('Ending 2');
  });
});

describe('songCredit', () => {
  it('joins the song to its performers', () => {
    expect(songCredit({ songTitle: 'give it back', artists: ['Cö shu Nie'] }))
      .toBe('give it back — Cö shu Nie');
  });

  it('lists every performer', () => {
    expect(songCredit({ songTitle: 'Tank!', artists: ['The Seatbelts', 'Mai Yamane'] }))
      .toBe('Tank! — The Seatbelts, Mai Yamane');
  });

  // Uncredited is ordinary, not exceptional — a lot of older entries have no
  // artist rows, and show-performed songs often carry none.
  it('drops the dash when nobody is credited', () => {
    expect(songCredit({ songTitle: 'Tank!', artists: [] })).toBe('Tank!');
    expect(songCredit({ songTitle: 'Tank!' })).toBe('Tank!');
  });

  it('survives a song with no title at all', () => {
    expect(songCredit({ artists: ['FLOW'] })).toBe('FLOW');
    expect(songCredit({})).toBe('');
    expect(songCredit(undefined)).toBe('');
  });
});
