import { describe, it, expect } from 'vitest';
import {
  GRACE_MS, playerStatus, isPresent, graceRemainingMs, rosterSnapshot, nextHostId,
} from './presence';

const NOW = 1_700_000_000_000;
const player = (id) => ({ id, name: id });
const online = () => ({ online: true });
const droppedAgo = (ms) => ({ online: false, at: NOW - ms });
const leftAgo = (ms) => ({ online: false, left: true, at: NOW - ms });

describe('playerStatus', () => {
  it('treats a missing record as present, so rooms written before presence still work', () => {
    expect(playerStatus(undefined, NOW)).toBe('active');
    expect(playerStatus(null, NOW)).toBe('active');
  });

  it('keeps a dropped player in the room until the grace window closes', () => {
    expect(playerStatus(droppedAgo(0), NOW)).toBe('dropping');
    expect(playerStatus(droppedAgo(GRACE_MS - 1), NOW)).toBe('dropping');
    expect(playerStatus(droppedAgo(GRACE_MS), NOW)).toBe('gone');
    expect(playerStatus(droppedAgo(GRACE_MS + 60_000), NOW)).toBe('gone');
  });

  it('never waits out a grace window for someone who left on purpose', () => {
    expect(playerStatus(leftAgo(0), NOW)).toBe('left');
    expect(playerStatus({ online: false, left: true }, NOW)).toBe('left');
  });

  it('gives up on an offline record with no timestamp rather than waiting forever', () => {
    // A missing `at` would otherwise restart the countdown on every read.
    expect(playerStatus({ online: false }, NOW)).toBe('gone');
  });

  it('tolerates clock skew that puts the drop in the future', () => {
    expect(playerStatus({ online: false, at: NOW + 5000 }, NOW)).toBe('dropping');
  });

  it('honours a caller-supplied grace window', () => {
    expect(playerStatus(droppedAgo(5000), NOW, 10_000)).toBe('dropping');
    expect(playerStatus(droppedAgo(5000), NOW, 1000)).toBe('gone');
  });
});

describe('isPresent', () => {
  it('counts the grace window as still in the room', () => {
    expect(isPresent('active')).toBe(true);
    expect(isPresent('dropping')).toBe(true);
    expect(isPresent('gone')).toBe(false);
    expect(isPresent('left')).toBe(false);
  });
});

describe('graceRemainingMs', () => {
  it('counts down from the drop, and reads zero for anyone not mid-drop', () => {
    expect(graceRemainingMs(droppedAgo(0), NOW)).toBe(GRACE_MS);
    expect(graceRemainingMs(droppedAgo(GRACE_MS - 3000), NOW)).toBe(3000);
    expect(graceRemainingMs(droppedAgo(GRACE_MS + 1000), NOW)).toBe(0);
    expect(graceRemainingMs(online(), NOW)).toBe(0);
    expect(graceRemainingMs(leftAgo(0), NOW)).toBe(0);
    expect(graceRemainingMs(undefined, NOW)).toBe(0);
  });

  it('never reports more than the full window, however stale the clock is', () => {
    // The caller's ticker only runs while someone is dropping, so the first
    // frame after a drop can be minutes behind. Show "20s", not "12m 20s".
    expect(graceRemainingMs({ online: false, at: NOW }, NOW - 600_000)).toBe(GRACE_MS);
  });
});

describe('rosterSnapshot', () => {
  const players = [player('ana'), player('ben'), player('cleo'), player('dev')];
  const presence = {
    ana: online(),
    ben: droppedAgo(5000),          // inside grace — still counted
    cleo: droppedAgo(GRACE_MS + 1), // grace expired
    dev: leftAgo(1000),             // pressed Leave
  };

  it('splits the roster into who is still waited on and who is not', () => {
    const snap = rosterSnapshot(players, presence, NOW);
    expect(snap.activeIds).toEqual(['ana', 'ben']);
    expect(snap.departedIds).toEqual(['cleo', 'dev']);
    expect(snap.statuses).toEqual({
      ana: 'active', ben: 'dropping', cleo: 'gone', dev: 'left',
    });
  });

  it('reports only mid-drop players for the countdown, with time left', () => {
    const snap = rosterSnapshot(players, presence, NOW);
    expect(snap.dropping).toHaveLength(1);
    expect(snap.dropping[0].player.id).toBe('ben');
    expect(snap.dropping[0].remainingMs).toBe(GRACE_MS - 5000);
  });

  it('keeps everyone when no presence has been written yet', () => {
    const snap = rosterSnapshot(players, {}, NOW);
    expect(snap.activeIds).toEqual(['ana', 'ben', 'cleo', 'dev']);
    expect(snap.departedIds).toEqual([]);
  });

  it('handles an empty room without blowing up', () => {
    const snap = rosterSnapshot([], {}, NOW);
    expect(snap.active).toEqual([]);
    expect(snap.departedIds).toEqual([]);
    expect(snap.dropping).toEqual([]);
  });
});

describe('nextHostId', () => {
  const players = [player('ana'), player('ben'), player('cleo')];

  it('hands the crown to the longest-standing connected player', () => {
    const statuses = { ana: 'gone', ben: 'active', cleo: 'active' };
    expect(nextHostId(players, statuses)).toBe('ben');
  });

  it('skips over players who left or timed out', () => {
    const statuses = { ana: 'left', ben: 'gone', cleo: 'active' };
    expect(nextHostId(players, statuses)).toBe('cleo');
  });

  it('prefers a connected player over one mid-drop, whatever the join order', () => {
    // Migrating to someone who is about to time out would just migrate again.
    const statuses = { ana: 'gone', ben: 'dropping', cleo: 'active' };
    expect(nextHostId(players, statuses)).toBe('cleo');
  });

  it('falls back to a mid-drop player when nobody is fully connected', () => {
    const statuses = { ana: 'left', ben: 'dropping', cleo: 'gone' };
    expect(nextHostId(players, statuses)).toBe('ben');
  });

  it('returns null when the room has emptied out', () => {
    expect(nextHostId(players, { ana: 'left', ben: 'gone', cleo: 'gone' })).toBe(null);
    expect(nextHostId([], {})).toBe(null);
  });
});
