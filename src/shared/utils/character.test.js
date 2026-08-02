import { describe, it, expect } from 'vitest';
import { normalizeCharacter, characterNameKey } from './character';

describe('normalizeCharacter', () => {
  it('keeps an AniList character\'s genres array as-is', () => {
    const char = { name: 'Spike', genres: ['Action', 'Sci-Fi'] };
    expect(normalizeCharacter(char).genres).toEqual(['Action', 'Sci-Fi']);
  });

  it('lifts ListManager\'s singular genre string into an array', () => {
    expect(normalizeCharacter({ name: 'Spike', genre: 'Action' }).genres).toEqual(['Action']);
  });

  it('drops the singular key so consumers never see both shapes at once', () => {
    const out = normalizeCharacter({ name: 'Spike', genre: 'Action' });
    expect(out).not.toHaveProperty('genre');
  });

  it('gives an empty array when there is no genre at all, so callers can map unguarded', () => {
    expect(normalizeCharacter({ name: 'Spike' }).genres).toEqual([]);
    expect(normalizeCharacter({ name: 'Spike', genre: '' }).genres).toEqual([]);
  });

  it('prefers the array when a character somehow carries both', () => {
    const out = normalizeCharacter({ name: 'Spike', genres: ['Sci-Fi'], genre: 'Action' });
    expect(out.genres).toEqual(['Sci-Fi']);
    expect(out).not.toHaveProperty('genre');
  });

  it('preserves every other field', () => {
    const out = normalizeCharacter({ id: 'anilist_1', name: 'Spike', imageUrl: 'x', genre: 'Action' });
    expect(out).toMatchObject({ id: 'anilist_1', name: 'Spike', imageUrl: 'x' });
  });

  it('passes null and undefined straight through rather than inventing a character', () => {
    expect(normalizeCharacter(null)).toBe(null);
    expect(normalizeCharacter(undefined)).toBe(undefined);
  });
});

describe('characterNameKey', () => {
  it('folds the diacritics that make one character look like two across seasons', () => {
    expect(characterNameKey('Kaorū')).toBe(characterNameKey('Kaoru'));
    expect(characterNameKey('Jōtarō Kūjō')).toBe(characterNameKey('Jotaro Kujo'));
  });

  it('ignores case, because the two sources capitalise differently', () => {
    expect(characterNameKey('SPIKE SPIEGEL')).toBe(characterNameKey('spike spiegel'));
  });

  it('collapses runs of whitespace so a stray double space is not a new character', () => {
    expect(characterNameKey('  Spike   Spiegel  ')).toBe('spike spiegel');
  });

  it('treats missing names as empty rather than throwing', () => {
    expect(characterNameKey(undefined)).toBe('');
    expect(characterNameKey(null)).toBe('');
    expect(characterNameKey('')).toBe('');
  });

  it('still tells genuinely different people apart', () => {
    expect(characterNameKey('Edward Elric')).not.toBe(characterNameKey('Alphonse Elric'));
  });
});
