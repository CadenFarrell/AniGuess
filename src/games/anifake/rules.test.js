import { describe, it, expect } from 'vitest';
import * as rules from './rules';

// A deterministic rng: replays the given sequence, then repeats the last value.
// dealRoles draws in a fixed order — fake, then secret, then the decoy (decoy
// mode) or the hint (blind mode) — so every deal test has to know that order to
// know what came out.
const seq = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

// `id` is the folded name, because that is what utils/pool.js's
// collapseCharacters puts there and what deriveTruth groups by.
const pool = (n = 16) => Array.from({ length: n }, (_, i) => ({
  id: `char ${i}`,
  name: `Char ${i}`,
  series: i < 8 ? 'Show A' : 'Show B',
  imageUrl: '',
  role: 'Main',
  genres: ['Action'],
}));

// A published card, the shape revealCardFor produces and deriveTruth reads.
const card = (name) => ({ key: name.toLowerCase(), name, series: 'Show A', imageUrl: '' });

const round = (overrides = {}) => ({
  ...rules.startRound(['a', 'b', 'c'], { rng: () => 0 }),
  ...overrides,
});

describe('minPool', () => {
  it('asks for one character in blind mode and two in decoy', () => {
    // Blind deals the fake a word, not a character, so one is genuinely enough.
    // Decoy has to hand them a different one.
    expect(rules.minPool('blind')).toBe(1);
    expect(rules.minPool('decoy')).toBe(2);
  });
});

describe('dealRoles', () => {
  it('gives every crew member the character and the fake a hint, in blind mode', () => {
    // rng: fake index -> 0 (player a), secret -> 0.5 * 16 = Char 8, hint -> the
    // one genre.
    const { secrets, fakeId, secret } = rules.dealRoles(['a', 'b', 'c'], pool(), {
      mode: 'blind', round: 3, rng: seq(0, 0.5),
    });
    expect(fakeId).toBe('a');
    expect(secret.name).toBe('Char 8');
    // The fake holds a word and no character at all — the whole point of the
    // redesign. A character here would be the old face-up board's job.
    expect(secrets.a).toEqual({
      forRound: 3, forDeal: 1, character: null, hint: 'Action', isFake: true,
      discarded: null,
    });
    expect(secrets.b).toEqual({
      forRound: 3, forDeal: 1, character: secret, hint: null, isFake: false,
      discarded: null,
    });
    expect(secrets.c.character).toEqual(secret);
  });

  it('deals no hint when the secret carries no genres, rather than inventing one', () => {
    const blank = pool().map((c) => ({ ...c, genres: [] }));
    const { secrets, fakeId } = rules.dealRoles(['a', 'b'], blank, {
      mode: 'blind', rng: seq(0, 0.5),
    });
    expect(secrets[fakeId].isFake).toBe(true);
    expect(secrets[fakeId].hint).toBeNull();
  });

  it('prefers a secret that has genres, so the fake usually gets a hint', () => {
    // Only one entry is hintable, and the rng would otherwise land elsewhere.
    const mostlyBlank = pool().map((c, i) => ({ ...c, genres: i === 3 ? ['Romance'] : [] }));
    const { secret, secrets, fakeId } = rules.dealRoles(['a', 'b'], mostlyBlank, {
      mode: 'blind', rng: seq(0, 0.9),
    });
    expect(secret.name).toBe('Char 3');
    expect(secrets[fakeId].hint).toBe('Romance');
  });

  it('never tells anyone they are the fake in decoy mode, and deals them no hint', () => {
    const { secrets, fakeId } = rules.dealRoles(['a', 'b', 'c'], pool(), {
      mode: 'decoy', rng: seq(0, 0.5, 0),
    });
    expect(fakeId).toBe('a');
    expect(Object.values(secrets).every((s) => s.isFake === false)).toBe(true);
    // A hint would be a tell: in decoy mode the fake must not be able to spot
    // that their card differs from everyone else's.
    expect(Object.values(secrets).every((s) => s.hint === null)).toBe(true);
    // ...but they are holding a different character from everyone else.
    expect(secrets.a.character).not.toEqual(secrets.b.character);
    expect(secrets.b.character).toEqual(secrets.c.character);
  });

  it('draws the decoy from the same show as the secret when it can', () => {
    // Exactly one other entry shares the secret's show, so "same show" pins the
    // decoy to a single character. Asserting only the series would pass by
    // chance on a pool where half the entries share it.
    const rare = pool().map((c, i) => ({
      ...c, series: i === 8 || i === 12 ? 'Rare Show' : 'Show A',
    }));
    const { secrets, fakeId } = rules.dealRoles(['a', 'b'], rare, {
      mode: 'decoy', rng: seq(0, 0.5, 0.99), // Char 8; 0.99 would land elsewhere
    });
    expect(secrets[fakeId].character.name).toBe('Char 12');
  });

  it('falls back to any other character when the secret is alone in its show', () => {
    const lonely = pool().map((c, i) => ({ ...c, series: i === 8 ? 'Solo' : 'Show A' }));
    const { secrets, fakeId, secret } = rules.dealRoles(['a', 'b'], lonely, {
      mode: 'decoy', rng: seq(0, 0.5, 0),
    });
    expect(secrets[fakeId].character).not.toBeNull();
    expect(secrets[fakeId].character.name).not.toBe(secret.name);
  });

  it('deals nothing at all rather than throwing on an empty pool or roster', () => {
    const nothing = { secrets: {}, fakeId: null, secret: null, secretName: null, dealt: [] };
    expect(rules.dealRoles([], pool())).toEqual(nothing);
    expect(rules.dealRoles(['a'], [])).toEqual(nothing);
  });

  it('stamps the deal number, so a superseded card can be told from a current one', () => {
    const { secrets } = rules.dealRoles(['a', 'b'], pool(), { round: 2, deal: 3 });
    expect(Object.values(secrets).every((s) => s.forRound === 2 && s.forDeal === 3)).toBe(true);
  });

  it('reports the decoy as dealt too, not just the secret', () => {
    // A re-deal excludes what it reports here. The decoy has to be in it: in
    // decoy mode the fake really did hold that character, so promoting it to the
    // next secret would have the table giving clues about someone one of them
    // was privately holding a minute ago.
    const { dealt, secret, secrets, fakeId } = rules.dealRoles(['a', 'b'], pool(), {
      mode: 'decoy', rng: seq(0, 0.5, 0),
    });
    expect(dealt).toHaveLength(2);
    expect(dealt).toContain(secret.id);
    expect(dealt).toContain(secrets[fakeId].character.id);
  });

  it('reports only the secret as dealt in blind mode, where there is no decoy', () => {
    const { dealt, secret } = rules.dealRoles(['a', 'b'], pool(), { mode: 'blind' });
    expect(dealt).toEqual([secret.id]);
  });

  it('keeps a re-deal off the characters already in someone\'s hand', () => {
    const two = pool(2);
    const { secret } = rules.dealRoles(['a', 'b'], two, {
      mode: 'blind', exclude: ['char 0'], rng: seq(0, 0),
    });
    // rng 0 would pick Char 0 unexcluded.
    expect(secret.id).toBe('char 1');
  });

  it('keeps the pinned player as the fake while the character changes', () => {
    // The rng says player index 0 every time, so an unpinned re-deal would make
    // `a` the fake again and the test would pass for the wrong reason. 0.9 picks
    // a different secret from 0.1, which is what makes this a re-DEAL.
    const first = rules.dealRoles(['a', 'b', 'c'], pool(), {
      mode: 'blind', deal: 1, rng: seq(0.5, 0.1),
    });
    expect(first.fakeId).toBe('b');

    const second = rules.dealRoles(['a', 'b', 'c'], pool(), {
      mode: 'blind', deal: 2, pinFake: first.fakeId, rng: seq(0, 0.9),
    });
    expect(second.fakeId).toBe('b');
    expect(second.secret.id).not.toBe(first.secret.id);
    // The role carries over intact, not just the id: a pinned fake still holds
    // no character and still gets a hint off the NEW secret.
    expect(second.secrets.b).toEqual({
      forRound: 1, forDeal: 2, character: null, hint: 'Action', isFake: true,
      discarded: null,
    });
    expect(second.secrets.a.character).toEqual(second.secret);
  });

  it('pins the fake in decoy mode too, where nobody knows the role moved', () => {
    const first = rules.dealRoles(['a', 'b', 'c'], pool(), {
      mode: 'decoy', deal: 1, rng: seq(0.5, 0.1, 0),
    });
    const second = rules.dealRoles(['a', 'b', 'c'], pool(), {
      mode: 'decoy', deal: 2, pinFake: first.fakeId, rng: seq(0, 0.9, 0),
    });
    expect(second.fakeId).toBe(first.fakeId);
    // Still told nothing, and still holding a character of their own.
    expect(second.secrets[second.fakeId].isFake).toBe(false);
    expect(second.secrets[second.fakeId].character)
      .not.toEqual(second.secrets.a.character);
  });

  it('draws a fresh fake when the pinned player is not in this deal', () => {
    // The pin rides a ref across a phase online and a prop locally, so neither
    // guarantees the pinned player is still being dealt to. A stale pin must
    // fall back rather than leave the round with a fake nobody is holding.
    const { fakeId, secrets } = rules.dealRoles(['a', 'b'], pool(), {
      mode: 'blind', pinFake: 'gone', rng: seq(0, 0.5),
    });
    expect(fakeId).toBe('a');
    expect(secrets.a.isFake).toBe(true);
  });

  it('publishes the discards on every card in blind mode, the fake included', () => {
    // The fake's copy is the entire point. The crew all saw the discarded
    // character and the blind fake never did, so without it "everyone name the
    // one we threw out" identifies them for free. See rules.js's note.
    const { secrets, fakeId } = rules.dealRoles(['a', 'b', 'c'], pool(), {
      mode: 'blind', deal: 2, discarded: ['Char 8'], rng: seq(0, 0.1),
    });
    expect(secrets[fakeId].isFake).toBe(true);
    expect(Object.values(secrets).every((s) => s.discarded)).toBe(true);
    expect(new Set(Object.values(secrets).map((s) => s.discarded.join()))).toEqual(
      new Set(['Char 8'])
    );
  });

  it('publishes no discards in decoy mode however many are passed', () => {
    // The decoy fake discarded a DIFFERENT character, so one shared list would
    // tell them their card differs — the same reason they get no hint.
    const { secrets } = rules.dealRoles(['a', 'b'], pool(), {
      mode: 'decoy', deal: 3, discarded: ['Char 8', 'Char 2'], rng: seq(0, 0.5, 0),
    });
    expect(Object.values(secrets).every((s) => s.discarded === null)).toBe(true);
  });

  it('publishes no discards on the first deal, where nothing has been thrown out', () => {
    const { secrets } = rules.dealRoles(['a', 'b'], pool(), { mode: 'blind', deal: 1 });
    expect(Object.values(secrets).every((s) => s.discarded === null)).toBe(true);
  });

  it('reports the secret by display name, for the caller to publish next deal', () => {
    // `dealt` carries folded ids for exclusion; a discard goes on screen, so it
    // needs the readable form. Same character, two spellings.
    const { secret, secretName, dealt } = rules.dealRoles(['a', 'b'], pool(), {
      mode: 'blind', rng: seq(0, 0.5),
    });
    expect(secretName).toBe('Char 8');
    expect(secretName).toBe(secret.name);
    expect(dealt).toEqual([secret.id]);
  });

  it('consumes the same rng draws whether or not the fake is pinned', () => {
    // dealRoles draws in a fixed order (see the note at the top of this file),
    // and pinning must not skip the fake's draw — a pinned deal would then take
    // the SECRET's value out of the fake's slot and land on a different
    // character than the same seed gives unpinned. Nothing else here would
    // notice, which is why this test exists.
    const draws = () => seq(0.5, 0.3, 0.7);
    const loose = rules.dealRoles(['a', 'b', 'c'], pool(), { mode: 'decoy', rng: draws() });
    const pinned = rules.dealRoles(['a', 'b', 'c'], pool(), {
      mode: 'decoy', pinFake: 'c', rng: draws(),
    });
    expect(pinned.fakeId).toBe('c');
    expect(loose.fakeId).not.toBe('c'); // the pin really did override a draw
    expect(pinned.secret).toEqual(loose.secret);
    expect(pinned.secrets[pinned.fakeId].character)
      .toEqual(loose.secrets[loose.fakeId].character);
  });
});

describe('the card check', () => {
  const checking = (overrides = {}) => round({
    check: { responded: {}, asked: false },
    ...overrides,
  });

  it('opens the phase only when the table asked for it', () => {
    expect(rules.startRound(['a'], { allowRedeal: true }).check).toEqual({
      responded: {}, asked: false,
    });
    // Off means no node at all, which is also what a round dealt before this
    // existed reads as — the whole backward-compatibility story.
    expect(rules.startRound(['a']).check).toBeNull();
    expect(rules.needsCheck(rules.startRound(['a']))).toBe(false);
  });

  it('starts every round on deal one, phase or no phase', () => {
    expect(rules.startRound(['a'], { allowRedeal: true }).deal).toBe(1);
    expect(rules.startRound(['a']).deal).toBe(1);
  });

  it('records that someone answered, never how', () => {
    // THE anonymity assertion. In blind mode the fake holds no character, so a
    // per-player record of who asked would make them bluff about a card they
    // cannot see. This test fails the moment anyone adds one.
    const confirmed = rules.respondToCheck(checking(), 'a', { asked: false }).patch;
    const requested = rules.respondToCheck(checking(), 'b', { asked: true }).patch;

    expect(Object.keys(confirmed.check).sort()).toEqual(['asked', 'responded']);
    expect(Object.keys(requested.check).sort()).toEqual(['asked', 'responded']);
    // Identical per-player values. The only difference between a confirmer and
    // an asker anywhere in the round state is one shared boolean with no owner.
    expect(confirmed.check.responded).toEqual({ a: true });
    expect(requested.check.responded).toEqual({ b: true });
    expect(requested.check.asked).toBe(true);
  });

  it('latches the request, so a later confirmation cannot clear it', () => {
    let s = checking();
    s = { ...s, ...rules.respondToCheck(s, 'a', { asked: true }).patch };
    s = { ...s, ...rules.respondToCheck(s, 'b', { asked: false }).patch };
    s = { ...s, ...rules.respondToCheck(s, 'c', { asked: false }).patch };
    expect(s.check.asked).toBe(true);
  });

  it('takes each player\'s first answer and no other', () => {
    // Same reason castVote is final: letting a confirmer switch after watching
    // everyone else respond hands the last responder the decision alone.
    let s = checking();
    s = { ...s, ...rules.respondToCheck(s, 'a', { asked: false }).patch };
    expect(rules.respondToCheck(s, 'a', { asked: true }).patch).toEqual({});
    expect(s.check.asked).toBe(false);
  });

  it('is a no-op when the phase is off, so a stray tap cannot invent one', () => {
    expect(rules.respondToCheck(round(), 'a', { asked: true }).patch).toEqual({});
    expect(rules.applyRedeal(round(), 2).patch).toEqual({});
  });

  it('waits on the active roster only, so a closed tab cannot wedge it', () => {
    const s = checking({ check: { responded: { a: true, b: true }, asked: false } });
    expect(rules.everyoneChecked(s, ['a', 'b', 'c'])).toBe(false);
    // c left; the gate clears itself rather than waiting forever.
    expect(rules.everyoneChecked(s, ['a', 'b'])).toBe(true);
    expect(rules.pendingCheckers(s, ['a', 'b', 'c'])).toEqual(['c']);
    expect(rules.pendingCheckers(s, ['a', 'b'])).toEqual([]);
  });

  it('reads out the four ways the phase can stand', () => {
    const ids = ['a', 'b', 'c'];
    const all = { a: true, b: true, c: true };

    expect(rules.checkOutcome(checking(), ids).next).toBeNull();
    expect(rules.checkOutcome(checking({
      check: { responded: all, asked: false },
    }), ids).next).toBe('clues');
    expect(rules.checkOutcome(checking({
      check: { responded: all, asked: true },
    }), ids).next).toBe('redeal');
    // Asked for, but the cap is spent — the round starts anyway rather than
    // looping. See MAX_DEALS.
    expect(rules.checkOutcome(checking({
      deal: rules.MAX_DEALS, check: { responded: all, asked: true },
    }), ids).next).toBe('clues');
  });

  it('claims the next deal exactly once, so two hosts cannot both re-deal', () => {
    const s = checking({ deal: 1, check: { responded: { a: true }, asked: true } });
    const { patch } = rules.applyRedeal(s, 2);
    expect(patch).toEqual({ deal: 2, check: { responded: {}, asked: false } });
    // The loser of the race re-runs against the already-bumped state and aborts.
    expect(rules.applyRedeal({ ...s, ...patch }, 2).patch).toEqual({});
    // And nothing can skip a number or run past the cap.
    expect(rules.applyRedeal(s, 3).patch).toEqual({});
    expect(rules.applyRedeal(checking({ deal: rules.MAX_DEALS }), rules.MAX_DEALS + 1).patch)
      .toEqual({});
  });

  it('reaches the clues within MAX_DEALS however stubbornly the table asks', () => {
    // Structural termination, the property the runoff's cap note is about: a
    // player asking every single time must not be able to loop the room.
    const ids = ['a', 'b', 'c'];
    let s = checking();
    let deals = 1;
    for (let guard = 0; guard < 20; guard += 1) {
      for (const id of ids) s = { ...s, ...rules.respondToCheck(s, id, { asked: true }).patch };
      const outcome = rules.checkOutcome(s, ids);
      if (outcome.next !== 'redeal') break;
      deals += 1;
      s = { ...s, ...rules.applyRedeal(s, deals).patch };
    }
    expect(rules.checkOutcome(s, ids).next).toBe('clues');
    expect(deals).toBe(rules.MAX_DEALS);
  });
});

describe('the clue lap', () => {
  it('walks the order and ends after the configured number of laps', () => {
    let s = round({ order: ['a', 'b', 'c'], laps: 2, turn: 0 });
    const said = [];
    for (let i = 0; i < 6; i++) {
      const who = rules.currentSpeakerId(s);
      said.push(`${who}${rules.lapOf(s)}`);
      s = { ...s, ...rules.submitClue(s, who, 'word').patch };
    }
    expect(said).toEqual(['a0', 'b0', 'c0', 'a1', 'b1', 'c1']);
    expect(rules.cluesDone(s)).toBe(true);
    expect(rules.currentSpeakerId(s)).toBeNull();
  });

  it('refuses a clue from anyone but the current speaker', () => {
    const s = round({ order: ['a', 'b', 'c'], turn: 0 });
    expect(rules.submitClue(s, 'b', 'nope').patch).toEqual({});
  });

  it('refuses a clue over the word limit, and an empty one', () => {
    const s = round({ order: ['a', 'b', 'c'], turn: 0, wordLimit: 1 });
    expect(rules.submitClue(s, 'a', 'two words').patch).toEqual({});
    expect(rules.submitClue(s, 'a', '   ').patch).toEqual({});
    expect(rules.submitClue(s, 'a', 'one').patch.clues).toHaveLength(1);
  });

  it('skips a departed player mid-lap without ending the lap early', () => {
    // b has gone; the turn should land on c, and the lap still has c to hear.
    const s = round({ order: ['a', 'b', 'c'], laps: 1, turn: 1 });
    const { patch } = rules.skipDepartedTurn(s, ['b']);
    expect(patch).toEqual({ turn: 2 });
    const after = { ...s, ...patch };
    expect(rules.currentSpeakerId(after)).toBe('c');
    expect(rules.cluesDone(after)).toBe(false);
  });

  it('ends the lap when everyone still to speak has gone', () => {
    const s = round({ order: ['a', 'b', 'c'], laps: 1, turn: 1 });
    const after = { ...s, ...rules.skipDepartedTurn(s, ['b', 'c']).patch };
    expect(rules.cluesDone(after)).toBe(true);
  });

  it('stops exactly at the end of the lap when the whole roster has gone', () => {
    // The walk wraps, so without an upper bound this runs forever — or, with a
    // loose one, past the end and into a turn count that means nothing. Pinning
    // the exact number is the only assertion that catches that: `cluesDone`
    // stays true either way.
    const s = round({ order: ['a', 'b', 'c'], laps: 2, turn: 1 });
    expect(rules.skipDepartedTurn(s, ['a', 'b', 'c']).patch).toEqual({ turn: 6 });
  });

  it('is a no-op when the current speaker is still here', () => {
    const s = round({ order: ['a', 'b', 'c'], turn: 1 });
    expect(rules.skipDepartedTurn(s, ['a']).patch).toEqual({});
  });

  it('groups the log into rounds, oldest first', () => {
    const clues = [
      { by: 'a', text: 'one', lap: 0 },
      { by: 'b', text: 'two', lap: 0 },
      { by: 'a', text: 'three', lap: 1 },
    ];
    expect(rules.cluesByLap(clues)).toEqual([
      { lap: 0, clues: [clues[0], clues[1]] },
      { lap: 1, clues: [clues[2]] },
    ]);
  });

  it('orders round 10 after round 2, not before it', () => {
    // The default sort comparator is lexicographic, which puts "10" before "2".
    // Reachable the moment MAX_CLUE_ROUNDS went past 9.
    const clues = [
      { by: 'a', text: 'late', lap: 9 },
      { by: 'a', text: 'early', lap: 1 },
    ];
    expect(rules.cluesByLap(clues).map((r) => r.lap)).toEqual([1, 9]);
  });

  it('keeps a round that lost a speaker as its own group', () => {
    // skipDepartedTurn can jump the counter, so a round can hold fewer clues
    // than there are players. Grouping by the stamp rather than by position is
    // what stops that smearing one round into the next.
    const clues = [
      { by: 'a', text: 'one', lap: 0 },
      { by: 'c', text: 'two', lap: 0 },
      { by: 'a', text: 'three', lap: 1 },
      { by: 'c', text: 'four', lap: 1 },
    ];
    expect(rules.cluesByLap(clues).map((r) => r.clues.length)).toEqual([2, 2]);
  });

  it('treats an unstamped clue as round one, and survives an empty log', () => {
    expect(rules.cluesByLap([{ by: 'a', text: 'old' }])).toEqual([
      { lap: 0, clues: [{ by: 'a', text: 'old' }] },
    ]);
    expect(rules.cluesByLap([])).toEqual([]);
    expect(rules.cluesByLap(undefined)).toEqual([]);
  });

  it('holds the walk together at the top of the settable range', () => {
    // The setting is a typed number now, not a three-option dropdown, so the
    // upper end is reachable in a way it wasn't. Same assertion as the exact
    // turn: 6 bound above, at the other end of the range.
    const s = rules.startRound(['a', 'b', 'c'], { laps: rules.MAX_CLUE_ROUNDS });
    expect(rules.totalTurns(s)).toBe(30);
    expect(rules.cluesDone(s)).toBe(false);
    expect(rules.skipDepartedTurn(s, ['a', 'b', 'c']).patch).toEqual({ turn: 30 });
  });

  it('clamps a laps count that would open the vote with nothing said', () => {
    // laps of 0 makes totalTurns 0, which makes cluesDone true on turn zero.
    // The host types this number, so it arrives unvalidated however hard the
    // input clamps.
    for (const bad of [0, -4, NaN, undefined, null, 'two']) {
      const s = rules.startRound(['a', 'b', 'c'], { laps: bad });
      expect(s.laps).toBe(1);
      expect(rules.cluesDone(s)).toBe(false);
      expect(rules.currentSpeakerId(s)).not.toBeNull();
    }
  });

  it('clamps a laps count above the cap, and drops a fractional one', () => {
    expect(rules.startRound(['a', 'b', 'c'], { laps: 999 }).laps).toBe(rules.MAX_CLUE_ROUNDS);
    expect(rules.startRound(['a', 'b', 'c'], { laps: 2.7 }).laps).toBe(2);
  });
});

describe('passTurn (talk mode)', () => {
  it('advances the turn and records nothing', () => {
    const s = round({ order: ['a', 'b', 'c'], laps: 1, turn: 0, clues: [] });
    const { patch } = rules.passTurn(s, 'a');
    // The absent `clues` key is the whole point: a spoken clue leaves no trace,
    // so the vote screen has nothing to read back.
    expect(patch).toEqual({ turn: 1 });
    expect(rules.currentSpeakerId({ ...s, ...patch })).toBe('b');
  });

  it('refuses a pass from anyone but the current speaker', () => {
    const s = round({ order: ['a', 'b', 'c'], turn: 0 });
    expect(rules.passTurn(s, 'b').patch).toEqual({});
  });

  it('ends the lap after exactly one pass per speaker per lap', () => {
    let s = round({ order: ['a', 'b', 'c'], laps: 2, turn: 0 });
    for (let i = 0; i < 6; i++) {
      s = { ...s, ...rules.passTurn(s, rules.currentSpeakerId(s)).patch };
    }
    expect(rules.cluesDone(s)).toBe(true);
    expect(s.clues).toEqual([]);
  });

  it('is a no-op once the lap is done', () => {
    // currentSpeakerId is null here, so no real id matches and the turn cannot
    // run past the end — passTurn needs no bound of its own.
    const s = round({ order: ['a', 'b', 'c'], laps: 1, turn: 3 });
    expect(rules.passTurn(s, 'a').patch).toEqual({});
  });

  it('leaves clues already said in a mixed round untouched', () => {
    const s = round({ order: ['a', 'b', 'c'], laps: 1, turn: 0 });
    const afterClue = { ...s, ...rules.submitClue(s, 'a', 'loud').patch };
    const afterPass = { ...afterClue, ...rules.passTurn(afterClue, 'b').patch };
    expect(afterPass.clues).toEqual([{ by: 'a', text: 'loud', lap: 0 }]);
    expect(rules.currentSpeakerId(afterPass)).toBe('c');
  });
});

describe('voting', () => {
  it('records one final vote per player', () => {
    const s = round({ order: ['a', 'b', 'c'] });
    const after = { ...s, ...rules.castVote(s, 'a', 'b').patch };
    expect(after.votes).toEqual({ a: 'b' });
    // Changing your mind would let the last voter watch the tally settle first.
    expect(rules.castVote(after, 'a', 'c').patch).toEqual({});
  });

  it('refuses a self-vote and an unknown target', () => {
    const s = round({ order: ['a', 'b', 'c'] });
    expect(rules.castVote(s, 'a', 'a').patch).toEqual({});
    expect(rules.castVote(s, 'a', 'zzz').patch).toEqual({});
  });

  it('waits only on the players still here', () => {
    const s = round({ order: ['a', 'b', 'c'], votes: { a: 'b', b: 'a' } });
    expect(rules.everyoneVoted(s, ['a', 'b', 'c'])).toBe(false);
    expect(rules.everyoneVoted(s, ['a', 'b'])).toBe(true);
    expect(rules.pendingVoters(s, ['a', 'b', 'c'])).toEqual(['c']);
  });

  it('catches nobody when the vote ties', () => {
    const { caught, topIds } = rules.tallyVotes({ a: 'b', b: 'a', c: 'a', d: 'b' });
    expect(topIds).toEqual(['a', 'b']);
    expect(caught).toBeNull();
  });

  it('catches the plurality, not just a majority', () => {
    expect(rules.tallyVotes({ a: 'c', b: 'c', c: 'a', d: 'b' }).caught).toBe('c');
  });

  it('catches nobody when there are no votes at all', () => {
    expect(rules.tallyVotes({}).caught).toBeNull();
    expect(rules.tallyVotes(undefined).caught).toBeNull();
  });
});

describe('the runoff', () => {
  // A 2–2 tie between a and c. Four players, because three cannot tie in a way a
  // runoff could repeat: the two candidates are forced to vote for each other,
  // so the third player always decides.
  const tied = (extra = {}) => round({
    order: ['a', 'b', 'c', 'd'],
    votes: { a: 'c', b: 'c', c: 'a', d: 'a' },
    ...extra,
  });
  const open = (votes = {}) => tied({ runoff: { candidates: ['a', 'c'], votes } });

  it('opens on a tie, with exactly the tied names as candidates', () => {
    const s = tied();
    expect(rules.openRunoff(s).patch).toEqual({ runoff: { candidates: ['a', 'c'], votes: {} } });
  });

  it('opens a three-way runoff on a three-way tie', () => {
    const s = round({ order: ['a', 'b', 'c', 'd'], votes: { a: 'b', b: 'c', c: 'd' } });
    expect(rules.openRunoff(s).patch.runoff.candidates).toEqual(['b', 'c', 'd']);
  });

  it('does not open on a decisive ballot, on no votes, or a second time', () => {
    expect(rules.openRunoff(round({ votes: { a: 'c', b: 'c' } })).patch).toEqual({});
    expect(rules.openRunoff(round({ votes: {} })).patch).toEqual({});
    expect(rules.openRunoff(round()).patch).toEqual({});
    // The cap is the rule, not a caller's discipline: any device may fire this.
    expect(rules.openRunoff(open()).patch).toEqual({});
  });

  it('reads the open ballot through currentBallot', () => {
    expect(rules.currentBallot(tied())).toEqual({
      isRunoff: false, candidates: ['a', 'b', 'c', 'd'], votes: { a: 'c', b: 'c', c: 'a', d: 'a' },
    });
    expect(rules.currentBallot(open({ b: 'a' }))).toEqual({
      isRunoff: true, candidates: ['a', 'c'], votes: { b: 'a' },
    });
  });

  it('takes the runoff vote on its own ballot, leaving the opening one intact', () => {
    const s = open();
    const after = { ...s, ...rules.castVote(s, 'b', 'a').patch };
    expect(after.runoff).toEqual({ candidates: ['a', 'c'], votes: { b: 'a' } });
    expect(after.votes).toEqual({ a: 'c', b: 'c', c: 'a', d: 'a' });
    // Final per ballot, exactly as the opening vote is.
    expect(rules.castVote(after, 'b', 'c').patch).toEqual({});
  });

  it('refuses a target who was not tied, and a candidate voting for themselves', () => {
    const s = open();
    expect(rules.castVote(s, 'b', 'd').patch).toEqual({});
    // Everyone votes in the runoff, the tied players included — the self-vote
    // guard is the whole of what stops a candidate voting themselves clear.
    expect(rules.castVote(s, 'a', 'a').patch).toEqual({});
    expect(rules.castVote(s, 'a', 'c').patch.runoff.votes).toEqual({ a: 'c' });
  });

  it('waits on the runoff ballot, not the one already closed', () => {
    const s = open({ a: 'c' });
    const all = ['a', 'b', 'c', 'd'];
    // Everyone voted on the opening ballot; that must not read as done here.
    expect(rules.everyoneVoted(s, all)).toBe(false);
    expect(rules.pendingVoters(s, all)).toEqual(['b', 'c', 'd']);
    expect(rules.everyoneVoted(s, ['a'])).toBe(true);
  });
});

describe('voteOutcome', () => {
  const tied = (runoff) => round({
    order: ['a', 'b', 'c', 'd'], votes: { a: 'c', b: 'c', c: 'a', d: 'a' }, runoff,
  });

  it('takes a decisive opening ballot as the answer', () => {
    const out = rules.voteOutcome(round({ votes: { a: 'c', b: 'c', c: 'a' } }));
    expect(out.caught).toBe('c');
    expect(out.needsRunoff).toBe(false);
    expect(out.isRunoff).toBe(false);
    expect(out.tiedOut).toBe(false);
  });

  it('asks for a runoff while the opening ballot is tied and none is open yet', () => {
    const out = rules.voteOutcome(tied(null));
    expect(out.caught).toBeNull();
    expect(out.needsRunoff).toBe(true);
    expect(out.candidates).toEqual(['a', 'c']);
  });

  it('stops asking once the runoff is open', () => {
    // Otherwise every device would keep trying to open one that already exists.
    expect(rules.voteOutcome(tied({ candidates: ['a', 'c'], votes: {} })).needsRunoff).toBe(false);
  });

  it('takes the runoff as the answer when it is decisive', () => {
    const out = rules.voteOutcome(tied({ candidates: ['a', 'c'], votes: { a: 'c', b: 'c', d: 'a' } }));
    expect(out.caught).toBe('c');
    expect(out.isRunoff).toBe(true);
    expect(out.tiedOut).toBe(false);
    // The counts a tally renders are the ballot that decided, with the opening
    // one kept alongside so the reveal can show what forced the runoff.
    expect(out.counts).toEqual({ c: 2, a: 1 });
    expect(out.firstCounts).toEqual({ c: 2, a: 2 });
  });

  it('catches nobody when the runoff ties as well — the fake walks', () => {
    // Where "no ties" stops. A table that could not agree twice will not agree a
    // third time, and looping would let two players wedge an online room.
    const out = rules.voteOutcome(tied({ candidates: ['a', 'c'], votes: { a: 'c', c: 'a' } }));
    expect(out.caught).toBeNull();
    expect(out.tiedOut).toBe(true);
    expect(out.needsRunoff).toBe(false);
  });

  it('asks for no runoff when nobody voted at all', () => {
    const out = rules.voteOutcome(round({ votes: {} }));
    expect(out.caught).toBeNull();
    expect(out.needsRunoff).toBe(false);
  });
});

describe('seating', () => {
  const players = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }];

  it('numbers players by the speaking order, not the roster order', () => {
    // The whole point: the clue log and the ballot become the same list.
    expect(rules.seating(round({ order: ['c', 'a', 'b'] }), players)).toEqual([
      { id: 'c', name: 'Cy', seat: 1 },
      { id: 'a', name: 'Ann', seat: 2 },
      { id: 'b', name: 'Bo', seat: 3 },
    ]);
  });

  it('keeps everyone their seat when a player drops off the roster', () => {
    // Numbering the survivors would renumber every seat below the one who went,
    // which is the exact shuffle seats exist to stop.
    expect(rules.seating(round({ order: ['c', 'a', 'b'] }), [players[0], players[1]])).toEqual([
      { id: 'a', name: 'Ann', seat: 2 },
      { id: 'b', name: 'Bo', seat: 3 },
    ]);
  });

  it('sorts a player who joined after the deal last, with no seat', () => {
    const late = { id: 'z', name: 'Zed' };
    expect(rules.seating(round({ order: ['a', 'b', 'c'] }), [...players, late])).toEqual([
      { id: 'a', name: 'Ann', seat: 1 },
      { id: 'b', name: 'Bo', seat: 2 },
      { id: 'c', name: 'Cy', seat: 3 },
      { id: 'z', name: 'Zed', seat: null },
    ]);
  });

  it('survives an empty roster and a round with no order', () => {
    expect(rules.seating(round({ order: ['a'] }), [])).toEqual([]);
    // Everyone is "late" when there is no order to seat them by — the ballot
    // still renders every row rather than coming back empty.
    expect(rules.seating({}, players)).toEqual(players.map((p) => ({ ...p, seat: null })));
    expect(rules.seating(undefined, undefined)).toEqual([]);
  });
});

describe('revealCardFor', () => {
  it('folds the name into the key both devices will group by', () => {
    const dealt = { character: { name: 'Rem', series: 'Re:Zero', imageUrl: 'x' } };
    expect(rules.revealCardFor(dealt)).toEqual({
      key: 'rem', name: 'Rem', series: 'Re:Zero', imageUrl: 'x',
    });
  });

  it('publishes a blind fake as a confession carrying the word they bluffed off', () => {
    expect(rules.revealCardFor({ isFake: true, character: null, hint: 'shounen' }))
      .toEqual({ isFake: true, hint: 'shounen' });
  });

  it('leaves the hint key absent, not null, for a fake who was dealt no word', () => {
    // RTDB drops nulls, so a null hint would round-trip as an absent key online
    // and as a present one locally — two shapes for the screen to branch on.
    const confession = rules.revealCardFor({ isFake: true, character: null, hint: null });
    expect(confession).toEqual({ isFake: true });
    expect('hint' in confession).toBe(false);
  });

  it('publishes nothing for a card with no character to name', () => {
    // Callers skip rather than write a malformed card deriveTruth would then
    // have to defend against.
    expect(rules.revealCardFor(null)).toBeNull();
    expect(rules.revealCardFor({ character: null })).toBeNull();
  });
});

describe('deriveTruth', () => {
  const ids = ['a', 'b', 'c'];
  const levi = card('Levi');

  it('takes the fake at their word in blind mode', () => {
    const confession = { isFake: true, hint: 'shounen' };
    const reveal = { a: confession, b: levi, c: levi };
    expect(rules.deriveTruth(reveal, ids))
      .toEqual({ fakeId: 'a', secret: levi, fakeCard: confession });
  });

  it('finds the odd card out in decoy mode, where nobody confesses', () => {
    const eren = card('Eren');
    const reveal = { a: eren, b: levi, c: levi };
    // The odd card is kept, not just its owner's id: it is the only record of
    // the decoy character anyone holds, and the reveal shows it beside the secret.
    expect(rules.deriveTruth(reveal, ids))
      .toEqual({ fakeId: 'a', secret: levi, fakeCard: eren });
  });

  it('finds a fake who refused to publish, by elimination', () => {
    const reveal = { b: levi, c: levi };
    // Named but empty-handed — there is no card to show for someone who never
    // published one, which the reveal renders as an unturned card.
    expect(rules.deriveTruth(reveal, ids))
      .toEqual({ fakeId: 'a', secret: levi, fakeCard: null });
  });

  it('finds a fake who left before the reveal', () => {
    // Same shape as refusing — their tab is gone, so no card ever arrives.
    const reveal = { b: card('Mikasa'), c: card('Mikasa') };
    expect(rules.deriveTruth(reveal, ids).fakeId).toBe('a');
  });

  it('gives up rather than guessing when two players are missing', () => {
    const reveal = { c: levi };
    expect(rules.deriveTruth(reveal, ids))
      .toEqual({ fakeId: null, secret: levi, fakeCard: null });
  });

  it('gives up when no character has majority support', () => {
    const reveal = { a: card('Levi'), b: card('Eren') };
    expect(rules.deriveTruth(reveal, ['a', 'b']))
      .toEqual({ fakeId: null, secret: null, fakeCard: null });
  });

  it('gives up on an empty reveal', () => {
    expect(rules.deriveTruth({}, ids)).toEqual({ fakeId: null, secret: null, fakeCard: null });
    expect(rules.deriveTruth(undefined, undefined))
      .toEqual({ fakeId: null, secret: null, fakeCard: null });
  });
});

describe('publishCard', () => {
  it('accepts a card once and refuses to let it be rewritten', () => {
    const s = round();
    const mine = card('Levi');
    const after = { ...s, ...rules.publishCard(s, 'a', mine).patch };
    expect(after.reveal).toEqual({ a: mine });
    expect(rules.publishCard(after, 'a', card('Eren')).patch).toEqual({});
  });

  it('waits only on the players still here', () => {
    const s = round({ reveal: { a: card('Levi'), b: card('Levi') } });
    expect(rules.everyoneRevealed(s, ['a', 'b', 'c'])).toBe(false);
    expect(rules.everyoneRevealed(s, ['a', 'b'])).toBe(true);
  });
});

describe('the steal', () => {
  it('is offered only to a caught fake, in blind mode, once', () => {
    const caught = round({ mode: 'blind', votes: { a: 'c', b: 'c' } });
    expect(rules.needsSteal(caught, 'c')).toBe(true);
    // Decoy mode dealt them a character of their own — nothing to steal.
    expect(rules.needsSteal({ ...caught, mode: 'decoy' }, 'c')).toBe(false);
    // A fake who was not caught does not get one.
    expect(rules.needsSteal(caught, 'a')).toBe(false);
    const stolen = { ...caught, ...rules.submitSteal(caught, 'Levi').patch };
    expect(stolen.steal).toEqual({ name: 'Levi' });
    expect(rules.needsSteal(stolen, 'c')).toBe(false);
    expect(rules.submitSteal(stolen, 'Eren').patch).toEqual({});
  });

  it('is offered to a fake caught in the runoff', () => {
    // Read off the opening ballot alone this is false, and a whole screen the
    // fake is owed never appears.
    const s = round({
      mode: 'blind',
      votes: { a: 'c', b: 'd' },
      runoff: { candidates: ['c', 'd'], votes: { a: 'c', b: 'c' } },
    });
    expect(rules.needsSteal(s, 'c')).toBe(true);
    // The one the runoff cleared does not get one.
    expect(rules.needsSteal(s, 'd')).toBe(false);
  });

  it('is not offered when the runoff tied as well', () => {
    const s = round({
      mode: 'blind',
      votes: { a: 'c', b: 'd' },
      runoff: { candidates: ['c', 'd'], votes: { a: 'c', b: 'd' } },
    });
    expect(rules.needsSteal(s, 'c')).toBe(false);
  });

  it('refuses an empty guess and tidies a messy one', () => {
    const s = round();
    expect(rules.submitSteal(s, '   ').patch).toEqual({});
    expect(rules.submitSteal(s, '').patch).toEqual({});
    expect(rules.submitSteal(s, undefined).patch).toEqual({});
    expect(rules.submitSteal(s, '  Levi   Ackerman  ').patch.steal).toEqual({
      name: 'Levi Ackerman',
    });
  });

  it('bounds what goes into the write', () => {
    const s = round();
    const long = 'x'.repeat(rules.MAX_STEAL_LEN + 20);
    expect(rules.submitSteal(s, long).patch.steal.name).toHaveLength(rules.MAX_STEAL_LEN);
  });

  it('forgives case and accents, because nobody types a macron', () => {
    const secret = { key: 'kaguya shinomiya', name: 'Kaguya Shinomiya' };
    expect(rules.stealIsCorrect({ name: 'KAGUYA SHINOMIYA' }, secret)).toBe(true);
    expect(rules.stealIsCorrect({ name: 'Kaguya Shinomiya' }, secret)).toBe(true);
    expect(rules.stealIsCorrect({ name: 'Kāguya Shinomiya' }, secret)).toBe(true);
    expect(rules.stealIsCorrect({ name: 'Chika Fujiwara' }, secret)).toBe(false);
  });

  it('is not correct when there is no guess or no reconstructed secret', () => {
    expect(rules.stealIsCorrect(null, { key: 'levi' })).toBe(false);
    expect(rules.stealIsCorrect({ name: 'Levi' }, null)).toBe(false);
  });
});

describe('scoreRound', () => {
  const truth = { fakeId: 'c', secret: card('Levi') };

  it('pays each crew member who voted the fake, and nothing to the fake', () => {
    const s = round({ mode: 'blind', votes: { a: 'c', b: 'c', c: 'a' } });
    expect(rules.scoreRound(s, truth)).toEqual({ a: 1, b: 1 });
  });

  it('pays the fake 2 for surviving the vote', () => {
    const s = round({ mode: 'blind', votes: { a: 'b', b: 'a', c: 'a' } });
    // a is caught (2 votes), not the fake — so c walks. Nobody voted c.
    expect(rules.scoreRound(s, truth)).toEqual({ c: 2 });
  });

  it('pays the fake 2 when the vote ties', () => {
    const s = round({ mode: 'blind', votes: { a: 'b', b: 'a' } });
    expect(rules.scoreRound(s, truth)).toEqual({ c: 2 });
  });

  it('pays a crew member who named the fake on either ballot, once', () => {
    const s = round({
      mode: 'blind',
      votes: { a: 'c', b: 'd' },
      runoff: { candidates: ['c', 'd'], votes: { a: 'c', b: 'c' } },
    });
    // a had the fake on both ballots and is paid once, not twice; b only found
    // them in the runoff and is paid the same — the runoff caught c, so no +2.
    expect(rules.scoreRound(s, truth)).toEqual({ a: 1, b: 1 });
  });

  it('still pays a crew member whose opening vote the runoff left behind', () => {
    // The runoff opened on two names that do not include the fake, so the table
    // was always going to accuse the wrong person — but a named them first.
    const s = round({
      mode: 'blind',
      votes: { a: 'c', b: 'd', d: 'b' },
      runoff: { candidates: ['b', 'd'], votes: { a: 'b', b: 'd', d: 'b' } },
    });
    expect(rules.scoreRound(s, truth)).toEqual({ a: 1, c: 2 });
  });

  it('pays the fake 2 when the runoff ties as well', () => {
    const s = round({
      mode: 'blind',
      votes: { a: 'b', b: 'a' },
      runoff: { candidates: ['a', 'b'], votes: { a: 'b', b: 'a' } },
    });
    expect(rules.scoreRound(s, truth)).toEqual({ c: 2 });
  });

  it('pays a caught fake 1 for naming the secret', () => {
    const s = round({ mode: 'blind', votes: { a: 'c', b: 'c' }, steal: { name: 'levi' } });
    expect(rules.scoreRound(s, truth)).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('pays a caught fake nothing for a wrong name', () => {
    const s = round({ mode: 'blind', votes: { a: 'c', b: 'c' }, steal: { name: 'Eren' } });
    expect(rules.scoreRound(s, truth)).toEqual({ a: 1, b: 1 });
  });

  it('never pays a steal in decoy mode', () => {
    const s = round({ mode: 'decoy', votes: { a: 'c', b: 'c' }, steal: { name: 'Levi' } });
    expect(rules.scoreRound(s, truth)).toEqual({ a: 1, b: 1 });
  });

  it('scores nothing at all when the truth could not be reconstructed', () => {
    const s = round({ votes: { a: 'c', b: 'c' } });
    expect(rules.scoreRound(s, { fakeId: null, secret: null })).toEqual({});
    expect(rules.scoreRound(s)).toEqual({});
  });

  it('does not pay the fake for voting themselves out', () => {
    // castVote refuses a self-vote, but a hand-written room could carry one.
    const s = round({ mode: 'blind', votes: { c: 'c', a: 'c' } });
    expect(rules.scoreRound(s, truth)).toEqual({ a: 1 });
  });
});

describe('applyRoundScores', () => {
  it('adds a round onto the running totals, leaving unscored players alone', () => {
    expect(rules.applyRoundScores({ a: 3, b: 1 }, { a: 2, c: 1 })).toEqual({ a: 5, b: 1, c: 1 });
  });

  it('survives an empty round and empty totals', () => {
    expect(rules.applyRoundScores({}, {})).toEqual({});
    expect(rules.applyRoundScores({ a: 2 }, undefined)).toEqual({ a: 2 });
  });
});
