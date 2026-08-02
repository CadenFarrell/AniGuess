import { describe, it, expect } from 'vitest';
import { getPositionEmoji, normalizeTitle, computeRankedPlayers } from './ranking';

const p = (id, name = id) => ({ id, name });

describe('getPositionEmoji', () => {
  it('medals the top three', () => {
    expect(getPositionEmoji(1)).toBe('🥇');
    expect(getPositionEmoji(2)).toBe('🥈');
    expect(getPositionEmoji(3)).toBe('🥉');
  });

  it('numbers everyone below the podium', () => {
    expect(getPositionEmoji(4)).toBe('#4');
    expect(getPositionEmoji(12)).toBe('#12');
  });
});

describe('normalizeTitle', () => {
  it('ignores case and surrounding whitespace, so one show in two lists is one show', () => {
    expect(normalizeTitle('  Cowboy Bebop ')).toBe('cowboy bebop');
    expect(normalizeTitle('COWBOY BEBOP')).toBe(normalizeTitle('cowboy bebop'));
  });

  it('treats a missing title as empty rather than throwing', () => {
    expect(normalizeTitle(undefined)).toBe('');
    expect(normalizeTitle(null)).toBe('');
  });
});

describe('computeRankedPlayers', () => {
  it('orders by total score, highest first', () => {
    const out = computeRankedPlayers([p('a'), p('b'), p('c')], { a: 1, b: 5, c: 3 });
    expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(out.map((x) => x.position)).toEqual([1, 2, 3]);
  });

  it('treats a player with no entry in the score map as zero', () => {
    const out = computeRankedPlayers([p('a'), p('b')], { a: 2 });
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
    expect(out[1].total).toBe(0);
  });

  it('lets tied players share a position instead of inventing an order between them', () => {
    const out = computeRankedPlayers([p('a'), p('b'), p('c')], { a: 5, b: 3, c: 3 });
    expect(out.map((x) => x.position)).toEqual([1, 2, 2]);
  });

  it('resumes counting from the ordinal, so the player after a tie for 2nd is 4th', () => {
    // Two players tied for 2nd occupy slots 2 and 3, so the next is 4th — not 3rd.
    const out = computeRankedPlayers([p('a'), p('b'), p('c'), p('d')], { a: 9, b: 5, c: 5, d: 1 });
    expect(out.map((x) => x.position)).toEqual([1, 2, 2, 4]);
  });

  it('shares first place when the leaders tie', () => {
    const out = computeRankedPlayers([p('a'), p('b'), p('c')], { a: 4, b: 4, c: 1 });
    expect(out.map((x) => x.position)).toEqual([1, 1, 3]);
  });

  it('breaks ties by name so every device renders the same order', () => {
    const out = computeRankedPlayers([p('z', 'Zoe'), p('a', 'Ana')], { z: 3, a: 3 });
    expect(out.map((x) => x.name)).toEqual(['Ana', 'Zoe']);
  });

  it('does not mutate the players it was given', () => {
    const players = [p('a'), p('b')];
    computeRankedPlayers(players, { a: 1, b: 2 });
    expect(players.map((x) => x.id)).toEqual(['a', 'b']);
    expect(players[0]).not.toHaveProperty('position');
  });

  it('handles an empty roster', () => {
    expect(computeRankedPlayers([], {})).toEqual([]);
  });
});
