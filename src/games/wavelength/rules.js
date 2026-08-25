// All AniWave logic: no React, no storage, no network. Each function takes a
// slice of round state and returns a { patch } for the caller to apply however
// its persistence layer works — useState locally, a Firebase transaction online.
// See CLAUDE.md: change game behaviour here, not in the hooks, or local and
// online drift apart.
//
// The round is three phases:
//
//   clue    the psychic — and only the psychic — knows the target, and is
//           writing a word or phrase that points at it.
//   guess   everyone else places a dial. Nobody sees anyone else's.
//   reveal  the target is published, every dial is drawn against it, scores land.
//
// THE TARGET IS NOT IN ROUND STATE UNTIL THE REVEAL, and that is the whole
// security model. startRound does not take one and does not store one; both
// hooks hold it out of band (online in rooms/{code}/secrets/{psychicId}, which
// only the psychic can read; locally in the hook's own state, behind the
// pass-the-device gate) and both call revealTarget once the dials are in. Round
// state is the thing every member of a room subscribes to in full, so a target
// sitting in it during the guess phase is readable by anyone watching raw RTDB
// no matter what the screens render.
//
// LOCAL AND ONLINE ARE SYMMETRIC. `dials` is { [playerId]: number } in both:
// online each guesser writes their own from their own device, locally each
// guesser writes their own as the device is passed around. So finalScores is
// written once and branches nowhere, and pendingGuessers doubles as the online
// "waiting on…" list and the local hot-seat queue — the same trick anirank's
// pendingPlacers plays.
//
// THREE MODES, AND THEY DIFFER AT EXACTLY TWO POINTS. `mode` decides where the
// target comes from and what the psychic publishes; nothing else in this file
// branches on it, and neither scoreDial, explainRound nor finalScores knows it
// exists:
//
//   text      random hidden target · publishes a typed clue
//   cards     random hidden target · publishes one card, SEARCHED out of the
//             eligible pool on the psychic's own device
//   readroom  THE PSYCHIC'S OWN DIAL is the target · publishes the one card they
//             were DEALT, and the table guesses where they put it
//
// The dealt/searched split between the two card modes is deliberate and not a
// leftover. A hand of five is a physical-deck constraint: on a modest shared
// list it is half the deck, and the ordinary round is one where nothing in the
// hand sits near the target. readroom keeps its deal for the opposite reason —
// the whole mode is judging the psychic on a card they did NOT choose, and a
// psychic who can search picks something they have a loud obvious opinion
// about, which measures nothing.
//
// readroom is the one that sounds like a different game and isn't. The answer
// key stops being a random number and becomes an opinion, but it is still a
// number arriving through revealTarget from the psychic's device alone, so
// every guarantee below holds unchanged — including that a psychic who leaves
// mid-guess takes it with them.
//
// `mode` lives on the ROUND rather than only in settings because this file acts
// on it, which is CLAUDE.md's stated test for which prefs get copied onto the
// round node. normalizeRound defaults it to 'text' so a room created by the
// previous build finishes its game.

export const DIAL_MIN = 0;
export const DIAL_MAX = 100;

// Long enough for the phrase the game is actually played with ("your ride-or-die
// best friend") and short enough that a clue cannot become a paragraph that
// smuggles in a number. AniFake's MAX_CLUE_LEN is 24 because that game wants one
// word; this one wants a thought.
export const MAX_CLUE_LEN = 48;

// How long the psychic's device waits past a timed round's deadline before
// publishing the target.
//
// The gap exists so an auto-locked dial has somewhere to land. A guesser holding
// a placed-but-uncommitted dial submits it the moment the clock expires, and
// revealing on that same instant would race those writes and score as "no dial"
// the one guess the player can plainly see in front of them. Long enough for a
// transaction to land on a bad connection, short enough that the table reads it
// as the reveal rather than as a pause.
//
// The DURATION lives here and the INSTANT does not, for the reason startRound
// reads `deadline` and never invents one: a wall-clock moment is exactly what a
// pure module must not produce, while a span of milliseconds is just a rule.
export const REVEAL_GRACE_MS = 1500;

// A psychic and two guessers. With one guesser there is no spread to be right or
// wrong against — the psychic's score would just be a copy of the only dial.
export const MIN_PLAYERS = 3;

// What the psychic gives the table. See the header for what each one changes.
export const CLUE_MODES = ['text', 'cards', 'readroom'];
export const DEFAULT_CLUE_MODE = 'text';

// The three questions anything outside this file ever asks about a mode. Named
// rather than compared inline so a screen cannot quietly disagree with the hook
// about which modes need a card pool — and so a fourth mode is one edit here.
//
// THE FIRST TWO USED TO BE ONE PREDICATE, and splitting them is what the search
// picker cost. "Needs a card pool" and "has a card dealt to it" were the same
// question while both card modes were dealt one; now `cards` searches the pool
// on the psychic's device and only `readroom` is dealt. One name meaning both
// would have written a hand into secrets/ for a mode that never reads it, and
// left myDealReady waiting for it forever.
export const needsCardPool = (mode) => mode === 'cards' || mode === 'readroom';
export const dealsHand = (mode) => mode === 'readroom';
export const drawsRandomTarget = (mode) => mode !== 'readroom';

// Concentric bands by absolute distance from the target, and the game's
// difficulty dial. MUST stay sorted ascending by `within`: scoreDial returns the
// first band it falls inside, so an out-of-order entry silently pays the wrong
// points. Pinned by a test rather than trusted to review.
export const BANDS = [
  { within: 4, points: 4 },
  { within: 10, points: 3 },
  { within: 18, points: 2 },
];

// How far from each end a target can be drawn.
//
// Set to the BULLSEYE width, not the widest band, and the difference matters. A
// margin wide enough to fit every band (18) would guarantee perfectly symmetric
// scoring — and would also teach the table that no target is ever in the outer
// third, which is information the psychic is supposed to be the only one with. A
// margin this small leaks almost nothing while still guaranteeing a bullseye is
// reachable from both sides, so no round is unwinnable by accident.
const TARGET_MARGIN = BANDS[0].within;

const clampDial = (n) => Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(n)));

/**
 * A dial value, or null if the input is not one.
 *
 * The screening BEFORE Number() is the point. `Number(null)`, `Number('')`,
 * `Number(false)` and `Number([])` are all 0 — a perfectly finite number sitting
 * at the far left of the track — so the obvious `Number.isFinite(Number(v))`
 * turns every one of those into a confident guess of DIAL_MIN rather than
 * rejecting it. That is a wrong answer, not a no-op: it scores, it moves the
 * round on, and nothing on screen looks broken. RTDB hands back null for a
 * cleared key and an <input type="range"> hands back '' before first paint, so
 * both arrive in normal play.
 *
 * Numeric strings still pass, because that same range input reports its value as
 * one.
 */
const toDial = (v) => {
  if (v === undefined || v === '' || typeof v === 'object' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * A spectrum spec, or null.
 *
 * DELIBERATELY DOES NOT INTERPRET IT. This module still does not know what a
 * spectrum is — the same way anirank's rules.js never learns what it is ranking
 * — so all it checks is that the value is one of the two shapes spectra.js
 * resolves (a built-in's id, or a written spectrum's whole definition) and that
 * it carries *something*. That last part is not fussiness: an object with no
 * keys is not stored by Realtime Database at all, so accepting `{}` here would
 * publish a guess phase whose spectrum reads back as absent.
 */
const toSpec = (spec) => {
  if (typeof spec === 'string' && spec) return spec;
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    if (spec.id || (spec.leftLabel && spec.rightLabel)) return spec;
  }
  return null;
};

/**
 * A clue card, repaired, or null if there is not one.
 *
 * Field-by-field rather than a spread, for the reason normalizeRound rebuilds
 * from named fields — but with a second reason of its own. `subtitle` is empty
 * for every show card and `imageUrl` is empty for every hand-entered profile,
 * and RTDB does not store an empty string: both come back ABSENT, and a screen
 * reading `card.subtitle.length` on the far side of that would crash the round
 * for everyone except the psychic who sent it.
 *
 * `id` and `title` are required. A card with no title renders as a blank tile
 * the table is being asked to have an opinion about.
 */
export function normalizeCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const title = typeof raw.title === 'string' ? raw.title : '';
  if (!id || !title) return null;
  return {
    id,
    title,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
  };
}

/**
 * Draws a hidden target.
 *
 * Whoever calls this learns it — see the header. Online that is deliberately the
 * psychic's own device and nobody else's, which is how AniWave avoids the
 * "whoever computes the deal learns it" concession AniFake had to make.
 */
export function pickTarget(rng = Math.random) {
  const span = (DIAL_MAX - TARGET_MARGIN) - (DIAL_MIN + TARGET_MARGIN);
  return clampDial(DIAL_MIN + TARGET_MARGIN + rng() * span);
}

/**
 * A fresh round.
 *
 * NOTHING ABOUT WHAT THE ROUND IS *ABOUT* IS DECIDED HERE. No spectrum, no
 * card, no target — only who is psychic and which mode they are playing. That
 * is a change from the first version, which dealt a spectrum at this point, and
 * it is the change that lets the psychic offer their OWN written spectra: this
 * function is called by the host online, and the host has never seen them. The
 * psychic's device chooses the spectrum, deals its own hand and draws its own
 * target, and only what it picks is published — see submitClue.
 *
 * `excludeSpectrumId` is last round's, so the psychic's suggestions don't
 * repeat it. Public and harmless: it names a spectrum everyone just played.
 */
export function startRound(playerIds, {
  psychicId, round = 0, mode = DEFAULT_CLUE_MODE, excludeSpectrumId = null,
} = {}) {
  return {
    mode: CLUE_MODES.includes(mode) ? mode : DEFAULT_CLUE_MODE,
    // Both published by the psychic when the guess phase opens, never before.
    spectrum: null,
    card: null,
    excludeSpectrumId: typeof excludeSpectrumId === 'string' ? excludeSpectrumId : null,
    psychicId: psychicId ?? psychicFor(playerIds, round),
    round,
    phase: 'clue',
    clue: '',
    dials: {},
    // Absent until revealTarget, always. See the header.
    target: null,
    // When the guess phase closes itself, in SERVER time. Stamped by the online
    // hook at the moment the clue lands and null in an untimed round — read here
    // but never invented here, because an absolute wall-clock instant is exactly
    // the kind of thing a pure module must not produce.
    deadline: null,
    abandoned: false,
  };
}

// Whose turn it is to be psychic. Indexed by round so it walks the roster
// instead of re-picking at random and leaving someone out all night — copied
// from anirank's subjectFor, which exists for the same reason.
export function psychicFor(playerIds, roundIndex = 0) {
  if (!playerIds?.length) return null;
  return playerIds[roundIndex % playerIds.length];
}

// Everyone who is not the psychic. The roster passed in decides whether this
// means "in the room" or "still connected" — callers pick, deliberately.
export function guesserIds(state, playerIds = []) {
  return playerIds.filter((id) => id !== state?.psychicId);
}

/**
 * Everything the psychic publishes, at once, opening the guess phase.
 *
 * ONE ENTRY POINT FOR ALL THREE MODES, and the spectrum rides along with the
 * clue in every one of them. That pairing is the point rather than a tidy-up:
 * the spectrum is chosen on the psychic's device moments earlier, so writing it
 * separately would leave a window in which the room sits in the guess phase
 * with nothing to dial against — and online those would be two writes that can
 * arrive in either order or half-fail. Published together, a guess phase
 * without a spectrum is unrepresentable.
 *
 * What else is required depends on the mode:
 *
 *   text      a typed clue, cleaned by anifake's submitClue idiom — trim,
 *             collapse runs of whitespace, truncate. Applied here rather than
 *             in the input so a clue arriving from another device is cleaned by
 *             the same rule as one being typed.
 *   cards     the card the psychic searched up. Everything else they looked at
 *             — every query they typed, every candidate the list offered —
 *             never leaves their device, the same way the four unplayed cards
 *             of the old hand never did.
 *   readroom  neither. The psychic's own dial IS the answer key and is already
 *             committed to secrets/ by the time this is called; all this
 *             publishes is the card the table is being asked to place.
 *
 * Rejects rather than throws on every way this arrives twice: a double tap, a
 * replayed write, or a device still showing a phase the room has moved past.
 */
export function submitClue(state, playerId, { text, card, spectrum } = {}) {
  if (!state || state.phase !== 'clue') return { patch: {} };
  if (state.psychicId !== playerId) return { patch: {} };

  const chosen = toSpec(spectrum);
  if (!chosen) return { patch: {} };

  if (state.mode === 'text') {
    const clue = (text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_CLUE_LEN);
    if (!clue) return { patch: {} };
    return { patch: { spectrum: chosen, clue, phase: 'guess' } };
  }

  const played = normalizeCard(card);
  if (!played) return { patch: {} };
  return { patch: { spectrum: chosen, card: played, phase: 'guess' } };
}

/**
 * One player's dial.
 *
 * Returns the whole `dials` map rather than a scoped path because every online
 * mutation funnels through a single runTransaction on the round node (see
 * useWavelengthRoom's applyRound, and anirank's applyGame before it) — two
 * devices dialling at the same instant retry rather than clobber each other.
 *
 * A dial can be moved freely until the phase ends; there is no lock-in, because
 * the reveal is gated on everyone having placed rather than on anyone
 * committing, and a player who cannot change their mind just guesses worse.
 */
export function placeDial(state, playerId, value) {
  if (!state || state.phase !== 'guess') return { patch: {} };
  if (!playerId || playerId === state.psychicId) return { patch: {} };
  const n = toDial(value);
  if (n === null) return { patch: {} };
  return { patch: { dials: { ...state.dials, [playerId]: clampDial(n) } } };
}

export function clearDial(state, playerId) {
  if (!state || state.phase !== 'guess') return { patch: {} };
  if (!Number.isFinite(state.dials?.[playerId])) return { patch: {} };
  const dials = { ...state.dials };
  delete dials[playerId];
  return { patch: { dials } };
}

export function hasDialled(state, playerId) {
  return Number.isFinite(state?.dials?.[playerId]);
}

/**
 * Who the round is still waiting on, in roster order.
 *
 * Pass the ACTIVE roster: a closed tab would otherwise wedge the round forever.
 * Local play takes the head of this as the hot seat and online play renders it
 * as "waiting on…", which is why it returns an ordered list rather than a count.
 */
export function pendingGuessers(state, activeIds = []) {
  if (!state || state.phase !== 'guess') return [];
  return guesserIds(state, activeIds).filter((id) => !hasDialled(state, id));
}

/**
 * Is the guess phase over?
 *
 * True when nobody active is still pending — INCLUDING the case where everyone
 * but the psychic has left, which returns true rather than false on purpose: a
 * round with no guessers left cannot be completed, and hanging here would wedge
 * the room. The hooks' departure reconciliation abandons that round; this
 * function's job is only to stop waiting.
 */
export function everyoneGuessed(state, activeIds = []) {
  if (!state || state.phase !== 'guess') return false;
  return pendingGuessers(state, activeIds).length === 0;
}

/**
 * Publishes the target and ends the round.
 *
 * The only way a target ever enters round state. Online this is called by the
 * psychic's device alone, at the moment the last dial lands — never at clue
 * time, because a target sitting in state/ during the guess phase is readable by
 * anyone watching raw RTDB however the screens behave.
 */
export function revealTarget(state, target) {
  if (!state || state.phase !== 'guess') return { patch: {} };
  const n = toDial(target);
  if (n === null) return { patch: {} };
  return { patch: { target: clampDial(n), phase: 'reveal' } };
}

/**
 * Ends a round that can no longer be scored.
 *
 * The honest limit of a serverless hidden target: the psychic is its sole
 * holder, so a psychic who disappears between clueing and revealing takes the
 * answer with them. Nothing recovers it — deliberately, since the alternative is
 * a backup copy on the host's device, and the host is a guesser this round.
 * Totals survive; only this round is void. Sits beside anitune's giveUp and
 * revealNow as an escape hatch rather than an error path.
 */
export function abandonRound(state) {
  if (!state || state.phase === 'reveal') return { patch: {} };
  return { patch: { phase: 'reveal', abandoned: true, target: null } };
}

/**
 * Repairs a round after a departure. Returns a no-op patch when nothing broke.
 *
 * Two genuinely different cases, and conflating them costs a playable round:
 *
 *   clue    nothing has been committed yet — no clue, no dials, and the target
 *           only ever existed on the departed device. Hand the role to the next
 *           player present and let their device draw a fresh target. Nothing is
 *           lost, so abandoning here would be gratuitous.
 *   guess   the clue is out and the table has been dialling against a target
 *           only the departed psychic held. Unrecoverable — abandon.
 */
export function skipDepartedPsychic(state, playerIds = [], departedIds = []) {
  if (!state || state.phase === 'reveal') return { patch: {} };
  if (!departedIds.includes(state.psychicId)) return { patch: {} };
  if (state.phase === 'guess') return abandonRound(state);

  const successor = playerIds.find((id) => !departedIds.includes(id));
  if (!successor) return abandonRound(state);
  // Dials cannot exist yet in the clue phase, so there is nothing to clear — and
  // the successor's device draws its own target off the new psychicId.
  return { patch: { psychicId: successor } };
}

/**
 * Points for one dial. Ties are impossible — a distance falls in exactly one
 * band — and everything past the widest band scores zero rather than going
 * negative, so a wild guess costs the round and never the running total.
 */
export function scoreDial(value, target) {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return 0;
  const distance = Math.abs(value - target);
  for (const band of BANDS) {
    if (distance <= band.within) return band.points;
  }
  return 0;
}

/**
 * Per-guesser detail for the reveal screen, in roster order.
 *
 * `placed` separates "dialled and was wrong" from "never dialled" — both score
 * zero, and a screen that drew them the same way would accuse someone whose tab
 * closed of guessing badly.
 */
export function explainRound(state, playerIds = []) {
  const target = state?.target;
  return guesserIds(state, playerIds).map((playerId) => {
    const value = state?.dials?.[playerId];
    const placed = Number.isFinite(value);
    return {
      playerId,
      value: placed ? value : null,
      placed,
      distance: placed && Number.isFinite(target) ? Math.abs(value - target) : null,
      points: placed ? scoreDial(value, target) : 0,
    };
  });
}

/**
 * The round's scores.
 *
 * A guesser scores their own dial. The psychic scores the MEAN of the dials
 * actually placed — anirank's finalScores does exactly this for an opinion
 * round's subject, and for the same reason: the clue-giver's skill is only
 * visible in how well everyone else read them.
 *
 * Non-dialers are excluded from that mean rather than counted as zero. They
 * still score zero themselves, but a player whose tab closed is not evidence the
 * psychic's clue was bad, and letting them drag it down would make the psychic's
 * score a measure of the room's connection quality.
 */
export function finalScores(state, playerIds = []) {
  if (!state || state.abandoned) return {};
  if (!Number.isFinite(state.target)) return {};

  const out = {};
  const placed = [];
  for (const id of guesserIds(state, playerIds)) {
    const value = state.dials?.[id];
    const points = scoreDial(value, state.target);
    out[id] = points;
    if (Number.isFinite(value)) placed.push(points);
  }

  if (state.psychicId && playerIds.includes(state.psychicId)) {
    out[state.psychicId] = placed.length
      ? Math.round(placed.reduce((a, b) => a + b, 0) / placed.length)
      : 0;
  }
  return out;
}

// Folds a round's scores into the running totals. Not idempotent — callers gate
// it, the same contract aniguess, anirank and anifake's all carry.
export function applyRoundScores(totalScores, roundScores) {
  const out = { ...totalScores };
  for (const [id, score] of Object.entries(roundScores || {})) {
    out[id] = (out[id] || 0) + score;
  }
  return out;
}

/**
 * Every dial that has been stored, repaired.
 *
 * Realtime Database does not store empty objects, so a round nobody has dialled
 * in yet reads back as absent rather than as {}.
 *
 * Deliberately does NOT seed entries for a roster, unlike anirank's
 * normalizeBoards. An absent dial is meaningful here — it is exactly what
 * pendingGuessers reads as "still waiting on them" — so inventing one would end
 * the guess phase early with everyone scoring whatever the placeholder was. It
 * also means CLAUDE.md's "normalize against everyone in the room, never the
 * active roster" trap cannot bite: every key found is kept and none is invented,
 * so a departed player's dial survives every subsequent write on its own.
 */
export function normalizeDials(raw) {
  const out = {};
  for (const [id, v] of Object.entries(raw ?? {})) {
    const n = toDial(v);
    if (n !== null) out[id] = clampDial(n);
  }
  return out;
}

/**
 * The psychic's dealt cards, repaired. Only `readroom` has any — see dealsHand.
 *
 * Still plural, and still an array of one, because the shape is what lets
 * PsychicView's readroom branch read `hand[0]` rather than branching on a
 * differently-named field. A mode that wants a real hand again costs nothing.
 *
 * Written as a dense array into secrets/, so it normally reads back as one —
 * but a card that failed to store would leave a hole, and RTDB serves a mostly-
 * empty array as an object keyed by index. Both shapes land here, and a plain
 * loop rather than .map because Array methods skip holes.
 *
 * Never invents a card: a hand short by one is a hand of four, which the picker
 * renders fine, while a placeholder is a card the psychic can play and nobody
 * can render.
 */
export function normalizeHand(raw) {
  const source = Array.isArray(raw) ? raw
    : (raw && typeof raw === 'object' ? Object.values(raw) : []);
  const out = [];
  for (let i = 0; i < source.length; i++) {
    const card = normalizeCard(source[i]);
    if (card) out.push(card);
  }
  return out;
}

/**
 * The cards this session has already played, repaired.
 *
 * Lives beside the totals rather than on the round, because it outlives every
 * round — its whole job is stopping the psychic's device dealing a card the
 * table saw two rounds ago, which in a small shared pool happens often enough
 * to read as the shuffle being broken.
 *
 * Handles all three shapes an array comes back from RTDB as: the dense array it
 * was written as, the index-keyed object a sparse one degrades to, and absent.
 * A plain index loop rather than .map, because Array methods skip holes.
 */
export function normalizePlayedCardIds(raw) {
  const out = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (typeof raw[i] === 'string' && raw[i]) out.push(raw[i]);
    }
    return out;
  }
  if (raw && typeof raw === 'object') {
    for (const v of Object.values(raw)) {
      if (typeof v === 'string' && v) out.push(v);
    }
  }
  return out;
}

/**
 * The whole round subtree, repaired at the single point it enters a hook.
 * Everything downstream — least of all the screens — can then read it unguarded.
 */
export function normalizeRound(raw) {
  if (!raw) return null;
  return {
    // A room created by the previous build carries neither, and both defaults
    // are what that build actually played.
    mode: CLUE_MODES.includes(raw.mode) ? raw.mode : DEFAULT_CLUE_MODE,
    // `spectrumId` is this field's older name, from before a spectrum could be
    // a whole written definition rather than an id. Still read, so a room
    // created by the previous build finishes its game — the same back-compat
    // seam as anirank's `settings?.axis ?? settings?.axisId`.
    spectrum: toSpec(raw.spectrum ?? raw.spectrumId),
    card: normalizeCard(raw.card),
    excludeSpectrumId: typeof raw.excludeSpectrumId === 'string' ? raw.excludeSpectrumId : null,
    psychicId: raw.psychicId ?? null,
    round: Number.isFinite(raw.round) ? raw.round : 0,
    phase: raw.phase === 'guess' || raw.phase === 'reveal' ? raw.phase : 'clue',
    clue: typeof raw.clue === 'string' ? raw.clue : '',
    dials: normalizeDials(raw.dials),
    target: Number.isFinite(raw.target) ? raw.target : null,
    // Listed explicitly like everything else here. This normalizer rebuilds the
    // round from named fields rather than spreading `raw`, which is what stops a
    // stray key riding in from an older build — and is exactly why a field the
    // hook writes has to be named here too, or it is silently dropped on the
    // first read and the countdown never starts.
    deadline: Number.isFinite(raw.deadline) ? raw.deadline : null,
    abandoned: raw.abandoned === true,
  };
}
