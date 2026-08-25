import { describe, it, expect } from 'vitest';
import {
  BANDS, CLUE_MODES, DEFAULT_CLUE_MODE, DIAL_MAX, DIAL_MIN, MAX_CLUE_LEN,
  REVEAL_GRACE_MS,
  abandonRound, applyRoundScores, clearDial, dealsHand, drawsRandomTarget,
  everyoneGuessed, explainRound,
  finalScores, guesserIds, hasDialled, normalizeCard, normalizeDials,
  normalizePlayedCardIds, normalizeRound,
  needsCardPool, pendingGuessers, pickTarget, placeDial, psychicFor, revealTarget, scoreDial,
  skipDepartedPsychic, startRound, submitClue,
} from './rules';

const IDS = ['kaito', 'rin', 'yuki', 'sora'];

// One card, in the shape utils/cards.js deals and the screens render.
const CARD = {
  id: 'hitori gotoh',
  title: 'Hitori Gotoh',
  subtitle: 'Bocchi the Rock!',
  imageUrl: 'bocchi.jpg',
};

// A round mid-guess: kaito is psychic, the clue is out, nobody has dialled.
function guessing(overrides = {}) {
  return {
    ...startRound(IDS, { psychicId: 'kaito', round: 0 }),
    spectrum: 'loyal',
    phase: 'guess',
    clue: 'your ride-or-die best friend',
    ...overrides,
  };
}

const apply = (state, { patch }) => ({ ...state, ...patch });

describe('BANDS', () => {
  // scoreDial returns the FIRST band a distance falls inside, so an out-of-order
  // entry silently pays the wrong points with nothing on screen looking wrong.
  it('stays sorted ascending by width', () => {
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].within).toBeGreaterThan(BANDS[i - 1].within);
    }
  });

  it('pays less the further out you get', () => {
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].points).toBeLessThan(BANDS[i - 1].points);
    }
  });
});

describe('REVEAL_GRACE_MS', () => {
  // The window a placed-but-unlocked dial submits itself into when a timed round
  // expires. Zero would put the reveal back in a race with the writes it is
  // meant to be collecting, which is the bug this constant exists to close, and
  // a long one reads at the table as the round having hung.
  it('is a real window and not a long one', () => {
    expect(REVEAL_GRACE_MS).toBeGreaterThan(0);
    expect(REVEAL_GRACE_MS).toBeLessThan(5000);
  });
});

describe('scoreDial', () => {
  // The edges, both sides. An off-by-one here is a scoring bug that never
  // announces itself — every round still ends, just with the wrong numbers.
  it('pays the band a distance falls exactly on', () => {
    expect(scoreDial(50, 50)).toBe(4);
    expect(scoreDial(54, 50)).toBe(4);
    expect(scoreDial(46, 50)).toBe(4);
    expect(scoreDial(55, 50)).toBe(3);
    expect(scoreDial(60, 50)).toBe(3);
    expect(scoreDial(61, 50)).toBe(2);
    expect(scoreDial(68, 50)).toBe(2);
    expect(scoreDial(69, 50)).toBe(0);
  });

  it('is symmetric about the target', () => {
    for (const d of [0, 4, 5, 10, 11, 18, 19, 40]) {
      expect(scoreDial(50 + d, 50), `+${d}`).toBe(scoreDial(50 - d, 50));
    }
  });

  // Never negative: a wild guess costs the round, never the running total.
  it('floors at zero and survives junk', () => {
    expect(scoreDial(DIAL_MIN, DIAL_MAX)).toBe(0);
    expect(scoreDial(undefined, 50)).toBe(0);
    expect(scoreDial(50, null)).toBe(0);
    expect(scoreDial(NaN, 50)).toBe(0);
  });
});

describe('pickTarget', () => {
  it('stays on the dial at both extremes of the rng', () => {
    for (const rng of [() => 0, () => 0.5, () => 0.999999]) {
      const t = pickTarget(rng);
      expect(t).toBeGreaterThanOrEqual(DIAL_MIN);
      expect(t).toBeLessThanOrEqual(DIAL_MAX);
      expect(Number.isInteger(t)).toBe(true);
    }
  });

  // The margin exists so a bullseye is reachable from BOTH sides of any target
  // — otherwise a target at 0 makes half its band unreachable and the round is
  // harder for a reason nobody can see.
  it('leaves room for a full bullseye at either end', () => {
    const lowest = pickTarget(() => 0);
    const highest = pickTarget(() => 0.999999);
    expect(lowest - BANDS[0].within).toBeGreaterThanOrEqual(DIAL_MIN);
    expect(highest + BANDS[0].within).toBeLessThanOrEqual(DIAL_MAX);
  });
});

describe('startRound', () => {
  // The security model in one assertion: round state is what every member of a
  // room subscribes to in full, so a target in it is a target everybody has.
  it('does not carry a target', () => {
    const state = startRound(IDS, { round: 0 });
    expect(state.target).toBeNull();
  });

  // The other half of it, and the reason a psychic can offer spectra they wrote
  // themselves: the host calls this, and the host has never seen them. Nothing
  // about what the round is ABOUT is decided until the psychic's device says so.
  it('decides nothing about the spectrum or the card', () => {
    const state = startRound(IDS, { round: 0, mode: 'cards' });
    expect(state.spectrum).toBeNull();
    expect(state.card).toBeNull();
  });

  it('opens in the clue phase with no clue, no dials and no clock', () => {
    const state = startRound(IDS, { round: 0 });
    expect(state.deadline).toBeNull();
    expect(state.phase).toBe('clue');
    expect(state.clue).toBe('');
    expect(state.dials).toEqual({});
    expect(state.abandoned).toBe(false);
  });

  it('defaults the psychic from the round index', () => {
    expect(startRound(IDS, { round: 2 }).psychicId).toBe('yuki');
  });

  it('defaults to the mode this game shipped with', () => {
    expect(startRound(IDS, {}).mode).toBe(DEFAULT_CLUE_MODE);
    expect(startRound(IDS, { mode: 'not_a_mode' }).mode).toBe(DEFAULT_CLUE_MODE);
    for (const mode of CLUE_MODES) {
      expect(startRound(IDS, { mode }).mode, mode).toBe(mode);
    }
  });

  it('carries last round’s spectrum forward so the suggestions don’t repeat it', () => {
    expect(startRound(IDS, { excludeSpectrumId: 'loyal' }).excludeSpectrumId).toBe('loyal');
    // A written spectrum's id is a string too; anything else is not an id.
    expect(startRound(IDS, { excludeSpectrumId: { id: 'loyal' } }).excludeSpectrumId).toBeNull();
    expect(startRound(IDS, {}).excludeSpectrumId).toBeNull();
  });
});

// The three questions the screens and the hooks ask about a mode. Named in
// rules.js so a setup screen cannot disagree with a hook about which modes need
// a card pool — which would show a pool warning for a round that deals no cards,
// or none for a round that cannot start without one.
describe('the mode predicates', () => {
  it('agrees on which modes need a card pool', () => {
    expect(needsCardPool('text')).toBe(false);
    expect(needsCardPool('cards')).toBe(true);
    expect(needsCardPool('readroom')).toBe(true);
  });

  // THE HALF THAT USED TO BE THE SAME QUESTION. `cards` needs a pool and is
  // dealt nothing out of it — the psychic searches it on their own device — so a
  // single predicate would write a hand into secrets/ that mode never reads, and
  // leave myDealReady waiting on a card that is never coming. That is a round
  // stuck on "Dealing you in…" forever, which is why it is pinned rather than
  // left to the two call sites to remember.
  it('deals a hand for readroom alone', () => {
    expect(dealsHand('text')).toBe(false);
    expect(dealsHand('cards')).toBe(false);
    expect(dealsHand('readroom')).toBe(true);
  });

  // Every dealt mode must also be a pooled mode: a hand has to come from
  // somewhere, and a mode the setup screen does not gate on MIN_CARD_POOL would
  // start with an empty deck.
  it('never deals a hand to a mode with no pool behind it', () => {
    for (const mode of CLUE_MODES) {
      if (dealsHand(mode)) expect(needsCardPool(mode), mode).toBe(true);
    }
  });

  it('agrees on which modes draw a random target', () => {
    expect(drawsRandomTarget('text')).toBe(true);
    expect(drawsRandomTarget('cards')).toBe(true);
    // readroom's answer key is the psychic's own opinion, not a draw.
    expect(drawsRandomTarget('readroom')).toBe(false);
  });

  it('covers every shipped mode', () => {
    for (const mode of CLUE_MODES) {
      expect(typeof needsCardPool(mode), mode).toBe('boolean');
      expect(typeof dealsHand(mode), mode).toBe('boolean');
      expect(typeof drawsRandomTarget(mode), mode).toBe('boolean');
    }
  });
});

describe('psychicFor', () => {
  it('walks the roster rather than re-picking, so nobody sits out all night', () => {
    expect(IDS.map((_, i) => psychicFor(IDS, i))).toEqual(IDS);
    expect(psychicFor(IDS, 4)).toBe('kaito');
  });

  it('has no psychic for an empty roster', () => {
    expect(psychicFor([], 0)).toBeNull();
  });
});

describe('submitClue', () => {
  const base = startRound(IDS, { psychicId: 'kaito', round: 0 });
  const say = (state, playerId, text, spectrum = 'loyal') => (
    submitClue(state, playerId, { text, spectrum })
  );

  it('opens the guess phase', () => {
    const { patch } = say(base, 'kaito', 'the beach episode');
    expect(patch).toEqual({ spectrum: 'loyal', clue: 'the beach episode', phase: 'guess' });
  });

  // Same idiom as anifake's submitClue, applied in rules rather than in the
  // input so a clue arriving from another device is cleaned the same way.
  it('trims and collapses whitespace', () => {
    expect(say(base, 'kaito', '  the   beach \n episode  ').patch.clue)
      .toBe('the beach episode');
  });

  it('truncates at MAX_CLUE_LEN', () => {
    const long = 'x'.repeat(MAX_CLUE_LEN + 40);
    expect(say(base, 'kaito', long).patch.clue.length).toBe(MAX_CLUE_LEN);
  });

  it('rejects an empty or whitespace-only clue', () => {
    expect(say(base, 'kaito', '   ').patch).toEqual({});
    expect(say(base, 'kaito', '').patch).toEqual({});
  });

  it('rejects anyone who is not the psychic', () => {
    expect(say(base, 'rin', 'nope').patch).toEqual({});
  });

  // A double tap, a replayed write, or a device still showing a phase the room
  // has moved past.
  it('rejects a second clue once the guess phase is open', () => {
    const state = apply(base, say(base, 'kaito', 'first'));
    expect(say(state, 'kaito', 'second').patch).toEqual({});
  });

  // The pairing that makes a spectrum-less guess phase unrepresentable. Two
  // separate writes could arrive in either order or half-fail, leaving the room
  // dialling against a dial with no ends.
  describe('the spectrum rides along with the clue', () => {
    it('publishes a built-in as its id', () => {
      expect(say(base, 'kaito', 'a clue', 'burn').patch.spectrum).toBe('burn');
    });

    // The whole definition, because the only device that has ever seen the text
    // is the one it was written on — no id would resolve to anything elsewhere.
    it('publishes a written spectrum as its whole definition', () => {
      const mine = { id: 'custom_1', leftLabel: 'MID', rightLabel: 'PEAK', custom: true };
      expect(say(base, 'kaito', 'a clue', mine).patch.spectrum).toEqual(mine);
    });

    it('refuses to open the guess phase without one', () => {
      expect(say(base, 'kaito', 'a clue', null).patch).toEqual({});
      expect(say(base, 'kaito', 'a clue', '').patch).toEqual({});
      // RTDB does not store an empty object, so this would read back absent.
      expect(say(base, 'kaito', 'a clue', {}).patch).toEqual({});
      expect(say(base, 'kaito', 'a clue', []).patch).toEqual({});
    });
  });

  describe('in cards mode', () => {
    const cards = startRound(IDS, { psychicId: 'kaito', round: 0, mode: 'cards' });

    it('publishes the played card and no clue text', () => {
      const { patch } = submitClue(cards, 'kaito', { card: CARD, spectrum: 'loyal' });
      expect(patch).toEqual({ spectrum: 'loyal', card: CARD, phase: 'guess' });
      expect(patch.clue).toBeUndefined();
    });

    it('will not open the guess phase without a card', () => {
      expect(submitClue(cards, 'kaito', { spectrum: 'loyal' }).patch).toEqual({});
      // Typing something is not playing a card.
      expect(submitClue(cards, 'kaito', { text: 'a clue', spectrum: 'loyal' }).patch).toEqual({});
    });
  });

  // No clue and no card to choose between — the psychic's own dial is the
  // answer key, and it is already in secrets/ by the time this is called.
  describe('in readroom mode', () => {
    const rr = startRound(IDS, { psychicId: 'kaito', round: 0, mode: 'readroom' });

    it('publishes the card the table is being asked to place', () => {
      const { patch } = submitClue(rr, 'kaito', { card: CARD, spectrum: 'loyal' });
      expect(patch).toEqual({ spectrum: 'loyal', card: CARD, phase: 'guess' });
    });

    it('ignores clue text entirely', () => {
      const { patch } = submitClue(rr, 'kaito', { text: 'ignored', card: CARD, spectrum: 'loyal' });
      expect(patch.clue).toBeUndefined();
    });
  });
});

describe('normalizeCard', () => {
  it('keeps a whole card', () => {
    expect(normalizeCard(CARD)).toEqual(CARD);
  });

  // RTDB stores neither, so both come back ABSENT — and a screen reading
  // .subtitle.length on the far side crashes the round for everyone but the
  // psychic who sent it. A show card always has an empty subtitle, and a
  // hand-entered profile always has an empty imageUrl, so both arrive normally.
  it('restores the empty strings Realtime Database drops', () => {
    const card = normalizeCard({ id: 'gintama', title: 'Gintama' });
    expect(card.subtitle).toBe('');
    expect(card.imageUrl).toBe('');
  });

  it('refuses a card with nothing to render', () => {
    expect(normalizeCard(null)).toBeNull();
    expect(normalizeCard({})).toBeNull();
    expect(normalizeCard({ id: 'x' })).toBeNull();
    expect(normalizeCard({ title: 'x' })).toBeNull();
    expect(normalizeCard('Gintama')).toBeNull();
  });

  it('drops anything else that rode in', () => {
    expect(Object.keys(normalizeCard({ ...CARD, value: null, favourites: 900 })).sort())
      .toEqual(['id', 'imageUrl', 'subtitle', 'title']);
  });
});

describe('normalizePlayedCardIds', () => {
  it('reads back the dense array it was written as', () => {
    expect(normalizePlayedCardIds(['a', 'b'])).toEqual(['a', 'b']);
  });

  // The three shapes CLAUDE.md warns an array comes back as.
  it('reads an index-keyed object, which is what a sparse array degrades to', () => {
    expect(normalizePlayedCardIds({ 0: 'a', 2: 'c' })).toEqual(['a', 'c']);
  });

  it('reads absent as nothing played yet', () => {
    expect(normalizePlayedCardIds(null)).toEqual([]);
    expect(normalizePlayedCardIds(undefined)).toEqual([]);
  });

  it('drops holes and junk rather than handing them to the dealer', () => {
    expect(normalizePlayedCardIds(['a', null, '', 7, 'b'])).toEqual(['a', 'b']);
  });
});

describe('placeDial', () => {
  it('records a guesser dial', () => {
    expect(placeDial(guessing(), 'rin', 62).patch.dials).toEqual({ rin: 62 });
  });

  it('lets a guesser move their dial until the phase ends', () => {
    let state = apply(guessing(), placeDial(guessing(), 'rin', 62));
    state = apply(state, placeDial(state, 'rin', 20));
    expect(state.dials).toEqual({ rin: 20 });
  });

  it('keeps other players dials when one moves', () => {
    let state = guessing();
    state = apply(state, placeDial(state, 'rin', 10));
    state = apply(state, placeDial(state, 'yuki', 90));
    expect(state.dials).toEqual({ rin: 10, yuki: 90 });
  });

  it('clamps to the dial and rounds to an integer', () => {
    expect(placeDial(guessing(), 'rin', 999).patch.dials.rin).toBe(DIAL_MAX);
    expect(placeDial(guessing(), 'rin', -999).patch.dials.rin).toBe(DIAL_MIN);
    expect(placeDial(guessing(), 'rin', 62.7).patch.dials.rin).toBe(63);
  });

  it('refuses the psychic, who already knows the answer', () => {
    expect(placeDial(guessing(), 'kaito', 50).patch).toEqual({});
  });

  it('refuses outside the guess phase rather than throwing', () => {
    expect(placeDial(startRound(IDS, { psychicId: 'kaito' }), 'rin', 50).patch).toEqual({});
    expect(placeDial(guessing({ phase: 'reveal' }), 'rin', 50).patch).toEqual({});
  });

  // Number(null), Number(''), Number(false) and Number([]) are all 0 — a finite
  // number at the far left of the track. Anything that screens with
  // Number.isFinite(Number(v)) turns each of these into a confident guess of
  // DIAL_MIN instead of a rejection, which scores and moves the round on.
  it('refuses a value that is not a number, including the ones that coerce to 0', () => {
    for (const junk of ['over there', null, undefined, '', false, [], {}, NaN]) {
      expect(placeDial(guessing(), 'rin', junk).patch, String(junk)).toEqual({});
    }
  });

  // The same range input reports its value as a string, so these must pass.
  it('accepts the numeric strings a range input actually reports', () => {
    expect(placeDial(guessing(), 'rin', '62').patch.dials.rin).toBe(62);
  });
});

describe('clearDial', () => {
  it('removes the key entirely, so pendingGuessers sees them as waiting again', () => {
    const state = guessing({ dials: { rin: 40, yuki: 10 } });
    const next = apply(state, clearDial(state, 'rin'));
    expect(next.dials).toEqual({ yuki: 10 });
    expect(hasDialled(next, 'rin')).toBe(false);
  });

  it('no-ops on a player who has not dialled', () => {
    expect(clearDial(guessing(), 'rin').patch).toEqual({});
  });
});

describe('pendingGuessers', () => {
  it('excludes the psychic and anyone who has dialled, in roster order', () => {
    const state = guessing({ dials: { yuki: 30 } });
    expect(pendingGuessers(state, IDS)).toEqual(['rin', 'sora']);
  });

  // The active roster, never the full one: a closed tab would otherwise leave
  // the round waiting on someone who is never coming back.
  it('waits only on players still connected', () => {
    const state = guessing();
    expect(pendingGuessers(state, ['kaito', 'rin'])).toEqual(['rin']);
  });

  it('is empty outside the guess phase', () => {
    expect(pendingGuessers(guessing({ phase: 'reveal' }), IDS)).toEqual([]);
    expect(pendingGuessers(startRound(IDS, { psychicId: 'kaito' }), IDS)).toEqual([]);
  });
});

describe('everyoneGuessed', () => {
  it('is false while anyone active still owes a dial', () => {
    expect(everyoneGuessed(guessing({ dials: { rin: 1, yuki: 2 } }), IDS)).toBe(false);
  });

  it('is true once every active guesser has dialled', () => {
    const state = guessing({ dials: { rin: 1, yuki: 2, sora: 3 } });
    expect(everyoneGuessed(state, IDS)).toBe(true);
  });

  it('ignores a departed player who never dialled', () => {
    const state = guessing({ dials: { rin: 1, yuki: 2 } });
    expect(everyoneGuessed(state, ['kaito', 'rin', 'yuki'])).toBe(true);
  });

  // True, not false, and deliberately: a round with no guessers left cannot be
  // completed, and waiting here would wedge the room. Reconciliation abandons
  // it; this function's job is only to stop waiting.
  it('stops waiting when everyone but the psychic has gone', () => {
    expect(everyoneGuessed(guessing(), ['kaito'])).toBe(true);
  });
});

describe('revealTarget', () => {
  it('is the only way a target enters round state', () => {
    const { patch } = revealTarget(guessing(), 63);
    expect(patch).toEqual({ target: 63, phase: 'reveal' });
  });

  it('clamps a target the same way a dial is clamped', () => {
    expect(revealTarget(guessing(), 140).patch.target).toBe(DIAL_MAX);
  });

  it('refuses outside the guess phase, so a revealed round cannot be rewritten', () => {
    expect(revealTarget(guessing({ phase: 'reveal' }), 50).patch).toEqual({});
    expect(revealTarget(startRound(IDS, { psychicId: 'kaito' }), 50).patch).toEqual({});
  });

  it('refuses a target that is not a number', () => {
    expect(revealTarget(guessing(), undefined).patch).toEqual({});
  });
});

describe('abandonRound', () => {
  it('ends the round unscored', () => {
    const state = apply(guessing({ dials: { rin: 50 } }), abandonRound(guessing()));
    expect(state.phase).toBe('reveal');
    expect(state.abandoned).toBe(true);
    expect(state.target).toBeNull();
    expect(finalScores(state, IDS)).toEqual({});
  });

  it('leaves running totals untouched — only this round is void', () => {
    const totals = { kaito: 7, rin: 4 };
    const state = apply(guessing(), abandonRound(guessing()));
    expect(applyRoundScores(totals, finalScores(state, IDS))).toEqual(totals);
  });

  it('no-ops on a round already revealed', () => {
    expect(abandonRound(guessing({ phase: 'reveal' })).patch).toEqual({});
  });
});

describe('skipDepartedPsychic', () => {
  // Nothing has been committed in the clue phase — no clue, no dials — so
  // handing the role on loses nothing, and abandoning would be gratuitous.
  it('hands the role to the next player present during the clue phase', () => {
    const state = startRound(IDS, { psychicId: 'kaito', round: 0 });
    const { patch } = skipDepartedPsychic(state, IDS, ['kaito']);
    expect(patch).toEqual({ psychicId: 'rin' });
  });

  // The clue is out and the table has been dialling against a target only the
  // departed psychic ever held. Nothing recovers it.
  it('abandons the round if the psychic leaves mid-guess', () => {
    const { patch } = skipDepartedPsychic(guessing(), IDS, ['kaito']);
    expect(patch.abandoned).toBe(true);
    expect(patch.phase).toBe('reveal');
  });

  it('abandons rather than spinning when everybody has gone', () => {
    const state = startRound(IDS, { psychicId: 'kaito', round: 0 });
    expect(skipDepartedPsychic(state, IDS, IDS).patch.abandoned).toBe(true);
  });

  it('no-ops when the psychic is still here', () => {
    expect(skipDepartedPsychic(guessing(), IDS, ['sora']).patch).toEqual({});
  });

  it('no-ops on a round already revealed', () => {
    expect(skipDepartedPsychic(guessing({ phase: 'reveal' }), IDS, ['kaito']).patch).toEqual({});
  });
});

describe('explainRound', () => {
  const state = guessing({ phase: 'reveal', target: 60, dials: { rin: 62, yuki: 10 } });

  it('describes every guesser in roster order and never the psychic', () => {
    expect(explainRound(state, IDS).map((r) => r.playerId)).toEqual(['rin', 'yuki', 'sora']);
  });

  it('reports distance and points against the target', () => {
    const rin = explainRound(state, IDS).find((r) => r.playerId === 'rin');
    expect(rin).toMatchObject({ value: 62, distance: 2, points: 4, placed: true });
  });

  // Both score zero, and a screen that drew them the same way would accuse
  // someone whose tab closed of guessing badly.
  it('separates never-dialled from dialled-and-wrong', () => {
    const sora = explainRound(state, IDS).find((r) => r.playerId === 'sora');
    const yuki = explainRound(state, IDS).find((r) => r.playerId === 'yuki');
    expect(sora).toMatchObject({ placed: false, value: null, distance: null, points: 0 });
    expect(yuki).toMatchObject({ placed: true, value: 10, points: 0 });
  });
});

describe('finalScores', () => {
  it('scores each guesser on their own dial', () => {
    const state = guessing({ phase: 'reveal', target: 60, dials: { rin: 62, yuki: 52, sora: 5 } });
    const scores = finalScores(state, IDS);
    expect(scores.rin).toBe(4);
    expect(scores.yuki).toBe(3);
    expect(scores.sora).toBe(0);
  });

  // The clue-giver's skill is only visible in how well everyone else read them —
  // the same reason anirank's opinion subject scores the mean of the guessers.
  it('gives the psychic the mean of the dials', () => {
    const state = guessing({ phase: 'reveal', target: 60, dials: { rin: 62, yuki: 52, sora: 5 } });
    // (4 + 3 + 0) / 3 = 2.33 → 2
    expect(finalScores(state, IDS).kaito).toBe(2);
  });

  // A player whose tab closed is not evidence the clue was bad; counting them as
  // a zero would make the psychic's score a measure of connection quality.
  it('excludes non-dialers from the psychic mean but still zeroes them', () => {
    const state = guessing({ phase: 'reveal', target: 60, dials: { rin: 62, yuki: 58 } });
    expect(finalScores(state, IDS).kaito).toBe(4); // mean of [4, 4], not [4, 4, 0]
    expect(finalScores(state, IDS).sora).toBe(0);
  });

  it('gives the psychic zero when nobody dialled at all', () => {
    const state = guessing({ phase: 'reveal', target: 60, dials: {} });
    expect(finalScores(state, IDS).kaito).toBe(0);
  });

  it('scores nothing without a target', () => {
    expect(finalScores(guessing({ dials: { rin: 60 } }), IDS)).toEqual({});
  });

  it('omits a psychic who is no longer in the roster it was handed', () => {
    const state = guessing({ phase: 'reveal', target: 60, dials: { rin: 62 } });
    expect(finalScores(state, ['rin', 'yuki', 'sora']).kaito).toBeUndefined();
  });
});

describe('applyRoundScores', () => {
  it('folds a round into the totals', () => {
    expect(applyRoundScores({ kaito: 5 }, { kaito: 2, rin: 4 })).toEqual({ kaito: 7, rin: 4 });
  });

  it('starts a player who has never scored from zero', () => {
    expect(applyRoundScores({}, { rin: 3 })).toEqual({ rin: 3 });
  });

  it('survives an empty round', () => {
    expect(applyRoundScores({ kaito: 5 }, {})).toEqual({ kaito: 5 });
  });
});

describe('normalizeDials', () => {
  // RTDB does not store empty objects, so a round nobody has dialled in yet
  // reads back absent rather than as {}.
  it('turns an absent node into an empty map', () => {
    expect(normalizeDials(undefined)).toEqual({});
    expect(normalizeDials(null)).toEqual({});
  });

  it('keeps numeric values and clamps them', () => {
    expect(normalizeDials({ rin: 40, yuki: 900, sora: -4 }))
      .toEqual({ rin: 40, yuki: DIAL_MAX, sora: DIAL_MIN });
  });

  // RTDB hands back null for a key that was cleared. Coercing it would turn
  // "this player has no dial" into "this player guessed the far left end".
  it('drops values that are not numbers, including the ones that coerce to 0', () => {
    expect(normalizeDials({
      rin: 40, a: 'x', b: null, c: '', d: false, e: [], f: {},
    })).toEqual({ rin: 40 });
  });

  it('keeps a genuine zero, which is a real place on the dial', () => {
    expect(normalizeDials({ rin: 0 })).toEqual({ rin: 0 });
  });

  // Every key found is kept and none is invented — which is what keeps
  // CLAUDE.md's "rebuilding from the active roster deletes departed players"
  // trap from biting: there is no roster here to rebuild against.
  it('keeps a departed player dial through later writes', () => {
    expect(normalizeDials({ gone: 12, rin: 40 })).toEqual({ gone: 12, rin: 40 });
  });

  // Seeding a placeholder would end the guess phase early with everyone scoring
  // whatever it was — an absent dial has to stay absent.
  it('does not invent a dial for anyone', () => {
    expect(normalizeDials({})).toEqual({});
  });
});

describe('normalizeRound', () => {
  it('leaves an absent round absent', () => {
    expect(normalizeRound(null)).toBeNull();
  });

  it('repairs everything RTDB drops', () => {
    const round = normalizeRound({ spectrum: 'loyal', psychicId: 'kaito' });
    expect(round).toEqual({
      mode: 'text',
      spectrum: 'loyal',
      card: null,
      excludeSpectrumId: null,
      psychicId: 'kaito',
      round: 0,
      phase: 'clue',
      clue: '',
      dials: {},
      target: null,
      deadline: null,
      abandoned: false,
    });
  });

  // A room created by the build before card modes existed carries neither
  // field, and both defaults are what that build actually played. Without this
  // a game in progress across a deploy changes its own rules mid-session.
  it('reads a round from the previous build as the game it was', () => {
    const old = normalizeRound({ spectrumId: 'loyal', psychicId: 'kaito', phase: 'guess' });
    expect(old.mode).toBe('text');
    expect(old.spectrum).toBe('loyal');
    expect(old.card).toBeNull();
  });

  it('keeps a written spectrum whole, since no id of it resolves anywhere else', () => {
    const mine = { id: 'custom_1', leftLabel: 'MID', rightLabel: 'PEAK', custom: true };
    expect(normalizeRound({ spectrum: mine }).spectrum).toEqual(mine);
  });

  it('refuses a spectrum with nothing in it — RTDB would not have stored one', () => {
    expect(normalizeRound({ spectrum: {} }).spectrum).toBeNull();
    expect(normalizeRound({}).spectrum).toBeNull();
  });

  it('repairs the card, including the empty strings RTDB drops out of it', () => {
    const round = normalizeRound({ card: { id: 'gintama', title: 'Gintama' } });
    expect(round.card).toEqual({
      id: 'gintama', title: 'Gintama', subtitle: '', imageUrl: '',
    });
  });

  it('falls back to the default mode on one it does not ship', () => {
    expect(normalizeRound({ mode: 'telepathy' }).mode).toBe(DEFAULT_CLUE_MODE);
    for (const mode of CLUE_MODES) {
      expect(normalizeRound({ mode }).mode, mode).toBe(mode);
    }
  });

  // This normalizer rebuilds from named fields rather than spreading `raw`, so
  // a field the online hook writes but this does not name is silently dropped on
  // the first read — for `deadline` that means a timed round whose clock never
  // starts, with nothing in the round looking wrong.
  it('preserves the deadline the online hook stamps', () => {
    expect(normalizeRound({ deadline: 1770000000000 }).deadline).toBe(1770000000000);
    expect(normalizeRound({ deadline: 'soon' }).deadline).toBeNull();
    expect(normalizeRound({}).deadline).toBeNull();
  });

  it('falls back to the clue phase on an unrecognised phase', () => {
    expect(normalizeRound({ phase: 'wat' }).phase).toBe('clue');
    expect(normalizeRound({ phase: 'reveal' }).phase).toBe('reveal');
  });

  it('never lets a non-numeric target through as a real one', () => {
    expect(normalizeRound({ target: 'soon' }).target).toBeNull();
    expect(normalizeRound({ target: 63 }).target).toBe(63);
  });

  it('treats a missing abandoned flag as not abandoned', () => {
    expect(normalizeRound({}).abandoned).toBe(false);
    expect(normalizeRound({ abandoned: true }).abandoned).toBe(true);
  });
});

describe('guesserIds', () => {
  it('is everyone but the psychic, in the order it was handed', () => {
    expect(guesserIds({ psychicId: 'yuki' }, IDS)).toEqual(['kaito', 'rin', 'sora']);
  });
});
