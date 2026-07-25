import { describe, it, expect } from 'vitest';
import { buildWhoIsWho } from './whoIsWho';

const player = (id, name = id) => ({ id, name });
const char = (name) => ({ id: `anilist_${name}`, name, series: 'Some Show' });

// The local caller's lookup shape: an array of { playerId, character }.
const fromAssignments = (assignments) => (id) =>
  assignments.find((a) => a.playerId === id)?.character;

describe('buildWhoIsWho', () => {
  const players = [player('ana', 'Ana'), player('bea', 'Bea'), player('cai', 'Cai')];
  const assignments = [
    { playerId: 'ana', character: char('Levi') },
    { playerId: 'bea', character: char('Mikasa') },
    { playerId: 'cai', character: char('Eren') },
  ];

  it('keeps every player in turn order when nobody is excluded', () => {
    const entries = buildWhoIsWho({ players, characterFor: fromAssignments(assignments) });

    expect(entries.map((e) => e.name)).toEqual(['Ana', 'Bea', 'Cai']);
    expect(entries.map((e) => e.character.name)).toEqual(['Levi', 'Mikasa', 'Eren']);
  });

  it('leaves out the excluded player — online, that is the device owner', () => {
    const entries = buildWhoIsWho({
      players,
      characterFor: fromAssignments(assignments),
      excludePlayerId: 'bea',
    });

    expect(entries.map((e) => e.playerId)).toEqual(['ana', 'cai']);
  });

  it('drops players with no character yet', () => {
    const entries = buildWhoIsWho({
      players,
      characterFor: fromAssignments([assignments[0]]),
    });

    expect(entries.map((e) => e.playerId)).toEqual(['ana']);
  });

  it('drops players whose assignment read back null — a stale round', () => {
    const entries = buildWhoIsWho({ players, characterFor: () => null });

    expect(entries).toEqual([]);
  });

  it('marks players who already guessed correctly as locked', () => {
    const entries = buildWhoIsWho({
      players,
      characterFor: fromAssignments(assignments),
      lockedPositions: [{ playerId: 'cai', name: 'Cai', position: 1, points: 3, turnsUsed: 4 }],
    });

    expect(entries.map((e) => e.locked)).toEqual([false, false, true]);
  });

  it('returns nothing when called with no players', () => {
    expect(buildWhoIsWho()).toEqual([]);
    expect(buildWhoIsWho({ players: [] })).toEqual([]);
  });
});
