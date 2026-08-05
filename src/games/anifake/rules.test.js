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
      forRound: 3, character: null, hint: 'Action', isFake: true,
    });
    expect(secrets.b).toEqual({
      forRound: 3, character: secret, hint: null, isFake: false,
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
    expect(rules.dealRoles([], pool())).toEqual({ secrets: {}, fakeId: null, secret: null });
    expect(rules.dealRoles(['a'], [])).toEqual({ secrets: {}, fakeId: null, secret: null });
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
