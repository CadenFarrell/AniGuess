// All AniFake logic: no React, no storage, no network. Each function takes a
// slice of round state and returns a { patch } for the caller to apply however
// its persistence layer works — useState locally, a Firebase transaction
// online. See CLAUDE.md: change game behaviour here, not in the hooks, or local
// and online drift apart.
//
// The game: one character everyone at the table knows is dealt privately to
// everyone — except the fake. Each player in turn gives a one-word clue about
// them, then the table votes.
//
// THERE IS NO PUBLIC BOARD, and that is load-bearing rather than incidental.
// An earlier build dealt sixteen candidates face-up so the fake had something
// to bluff off; the fake now gets a one-word hint instead (blind mode: one
// genre off the secret's show, see utils/pool.js's hintFor). Nothing about the
// character may sit in state/, which every member of a room reads in full — so
// a candidate list, however short, cannot go back. What replaced it is dealt
// into secrets/{playerId}, which only its owner can read.
//
// A consequence worth knowing before touching anything here: a character's
// identity is its FOLDED NAME (shared/utils/character.js's characterNameKey),
// not an index into a shared array. With no array to index, the name is the
// only reference two devices can both resolve, and deriveTruth groups the
// published cards by it.
//
// Nothing in here ever sees the secret. It lives in rooms/{code}/secrets/
// online (owner-readable only) and in a closed-over variable locally, and the
// round state it does touch — `reveal` — is written only once the vote has
// closed. See deriveTruth for how the answer comes back without anyone having
// been trusted to hold it.
import { characterNameKey } from '../../shared/utils/character';
import { shuffle } from '../../shared/utils/random';
import { hintFor, pickDecoy, pickSecret } from './utils/pool';

// Two crew have to agree on the secret for deriveTruth to find the odd one out,
// and a two-player game of "spot the liar" is a coin toss anyway.
export const MIN_PLAYERS = 3;

export const MAX_CLUE_LEN = 24;

// A typed name has to be bounded before it goes into an RTDB write. Long enough
// for the longest romanized full name anyone will actually type.
export const MAX_STEAL_LEN = 64;

// How many times round the table before the vote opens — `laps` on the round,
// "Clue rounds" on screen. These live here rather than in the settings screens
// because AniFakeSetup and OnlineLobby are copy-paste twins, and a default that
// existed twice would drift the moment one of them was tuned.
//
// Three, not one: with a single clue each the fake barely has to commit to
// anything, and the table votes on almost nothing. Note this is the *product*
// default — the `laps = 1` fallbacks in startRound and normalizeGame are repair
// values for a round that arrived without the field, and stay at 1 so old data
// keeps its old behaviour.
export const DEFAULT_CLUE_ROUNDS = 3;
export const MAX_CLUE_ROUNDS = 10;

/**
 * How many eligible characters a mode needs before it can deal.
 *
 * Blind needs exactly one — the fake is dealt a word, not a character, so
 * nothing else has to exist. Decoy needs a second one to hand the fake, and a
 * fake dealt null would sit on "Waiting for the deal…" forever.
 *
 * This is deliberately not a board size. The old sixteen-card minimum existed
 * to fill a grid nobody looks at anymore, and it locked out every table whose
 * shared lists were small — which, under "shared characters only", is most of
 * them.
 */
export function minPool(mode) {
  return mode === 'decoy' ? 2 : 1;
}

// --- dealing ---------------------------------------------------------------

/**
 * Picks the secret, the fake, and what each player is told.
 *
 * Returns the cards to write into secrets/{playerId} plus the answer — which the
 * CALLER MUST NOT PERSIST anywhere the room can read. See the note in
 * useAniFakeRoom.startGame about the one device this leaks to.
 *
 * `forRound` stamps every card. Cards are overwritten rather than cleared
 * between rounds (a clear that half-fails would leak last round's answer), so
 * the stamp is what makes a stale card unreadable rather than silently wrong —
 * the same trick AniGuess's readAssignment uses.
 */
export function dealRoles(playerIds, pool, { mode = 'blind', round = 1, rng = Math.random } = {}) {
  const ids = playerIds ?? [];
  const entries = pool ?? [];
  if (!ids.length || !entries.length) return { secrets: {}, fakeId: null, secret: null };

  const fakeId = ids[Math.floor(rng() * ids.length)];
  const secret = pickSecret(entries, { rng });
  const decoy = mode === 'decoy' ? pickDecoy(entries, secret, { rng }) : null;
  // Blind mode only. In decoy mode the fake holds a character of their own and
  // is never told anything is wrong, so a hint would be both redundant and a
  // tell. Keeping the hint to one mode is what makes the two modes feel
  // different rather than being a setting.
  const hint = mode === 'blind' ? hintFor(secret, { rng }) : null;

  const secrets = {};
  for (const id of ids) {
    const isFake = id === fakeId;
    secrets[id] = {
      forRound: round,
      // Blind mode hands the fake no character at all — just the word below.
      // Decoy mode hands them a different one and does NOT tell them, which is
      // the whole point of that mode: nobody knows who they are, including them.
      character: isFake ? (mode === 'decoy' ? decoy : null) : secret,
      // Null when the character carries no genres. RTDB drops nulls, so the key
      // is simply absent on read-back — which reads identically, and both mean
      // "nothing on file" to the screen.
      hint: isFake && mode === 'blind' ? hint : null,
      isFake: mode === 'blind' ? isFake : false,
    };
  }
  return { secrets, fakeId, secret };
}

export function startRound(playerIds, { mode = 'blind', laps = 1, wordLimit = 1, round = 1, rng = Math.random } = {}) {
  return {
    round,
    mode,
    // Clamped here rather than at the call sites: laps of 0 makes totalTurns 0,
    // which makes cluesDone true on turn zero and opens the vote with nothing
    // said. Both settings screens clamp too, but this is the layer that has to
    // hold — a host types the number, and it reaches here through RTDB.
    laps: Math.min(MAX_CLUE_ROUNDS, Math.max(1, Math.floor(laps) || 1)),
    wordLimit,
    // Fixed at deal time and stored, not derived: going last is an advantage,
    // so the order must not shuffle under the round when the roster changes.
    order: shuffle(playerIds ?? [], rng),
    turn: 0,
    clues: [],
    votes: {},
    steal: null,
    reveal: {},
  };
}

// --- the clue lap ----------------------------------------------------------
//
// One flat counter rather than a (lap, index) pair: the speaker is
// order[turn % N] and the lap is floor(turn / N), so skipping a departed player
// is turn + 1 and nothing else has to stay in step.

export function lapOf(state) {
  return Math.floor(state.turn / (state.order?.length || 1));
}

export function totalTurns(state) {
  return (state.order?.length ?? 0) * (state.laps ?? 1);
}

export function cluesDone(state) {
  return state.turn >= totalTurns(state);
}

export function currentSpeakerId(state) {
  const order = state.order ?? [];
  if (!order.length || cluesDone(state)) return null;
  return order[state.turn % order.length];
}

export function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// One clue per turn. Rejects rather than throws on every way this arrives
// twice — a double tap, a replayed write, or a device still showing a turn the
// room has moved past.
export function submitClue(state, playerId, text) {
  const clue = (text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_CLUE_LEN);
  if (!clue) return { patch: {} };
  if (currentSpeakerId(state) !== playerId) return { patch: {} };
  if (countWords(clue) > (state.wordLimit ?? 1)) return { patch: {} };
  return {
    patch: {
      // An append-only array, so it renders as the log everyone reads back and
      // RTDB stores it dense — no holes, none of a sparse array's problems.
      clues: [...(state.clues ?? []), { by: playerId, text: clue, lap: lapOf(state) }],
      turn: state.turn + 1,
    },
  };
}

// The lap cannot wait on someone who has closed their tab. Walks forward past
// everyone who has gone, bounded by the last turn — so an entire roster leaving
// ends the lap rather than spinning.
export function skipDepartedTurn(state, departedIds = []) {
  const order = state.order ?? [];
  if (!order.length) return { patch: {} };
  const total = totalTurns(state);
  let turn = state.turn;
  while (turn < total && departedIds.includes(order[turn % order.length])) turn++;
  if (turn === state.turn) return { patch: {} };
  return { patch: { turn } };
}

// --- the vote --------------------------------------------------------------

// Final once cast. Letting a vote change would mean the last voter closes the
// round, which hands them the power to watch the tally settle first.
export function castVote(state, voterId, targetId) {
  if (!voterId || !targetId || voterId === targetId) return { patch: {} };
  if (!(state.order ?? []).includes(targetId)) return { patch: {} };
  if (state.votes?.[voterId]) return { patch: {} };
  return { patch: { votes: { ...(state.votes ?? {}), [voterId]: targetId } } };
}

export function everyoneVoted(state, activeIds) {
  if (!activeIds?.length) return false;
  return activeIds.every((id) => state.votes?.[id]);
}

export function pendingVoters(state, activeIds) {
  return (activeIds ?? []).filter((id) => !state.votes?.[id]);
}

// A tie means the table could not agree, so nobody is accused and the fake
// walks — the same call the physical game makes, and it keeps the scoring free
// of a tie-break rule nobody would remember.
export function tallyVotes(votes) {
  const counts = {};
  for (const target of Object.values(votes ?? {})) {
    counts[target] = (counts[target] || 0) + 1;
  }
  let max = 0;
  for (const n of Object.values(counts)) if (n > max) max = n;
  const topIds = Object.keys(counts).filter((id) => counts[id] === max).sort();
  return { counts, topIds, caught: max > 0 && topIds.length === 1 ? topIds[0] : null };
}

// --- the reveal ------------------------------------------------------------

/**
 * What a device publishes about ITSELF once the vote closes — nothing more.
 *
 * The display fields ride along with the key because there is no shared board
 * to look a name up in anymore: the published set is the only place the answer
 * exists, so it has to carry enough to render.
 *
 * Returns null for a card that cannot be published (a decoy-mode fake whose
 * pool held nobody else). Callers skip rather than write a malformed card,
 * which deriveTruth would then have to defend against.
 */
export function revealCardFor(card) {
  if (!card) return null;
  // The hint rides along so the reveal can quote what the fake was bluffing off.
  // Safe only because this runs after the vote has closed: the hint is a genre
  // off the secret's show, and the same write publishes the secret itself.
  // Spread rather than `hint: card.hint ?? null` — RTDB drops nulls, so an
  // absent key is what a hintless fake's card reads as anyway, and writing one
  // shape locally and another online is how the two halves drift.
  if (card.isFake) return { isFake: true, ...(card.hint ? { hint: card.hint } : {}) };
  const c = card.character;
  if (!c?.name) return null;
  return {
    key: characterNameKey(c.name),
    name: c.name,
    series: c.series ?? '',
    imageUrl: c.imageUrl ?? '',
  };
}

// Each device publishes its OWN card once the vote has closed, and nothing
// else. The alternative — nominating the host to publish the answer key —
// breaks when the host is the fake and breaks worse when the host leaves
// mid-round, and it would mean the answer sat in state/ where every member
// reads it. This way nothing about the secret exists in state/ until the vote
// is over, and no device is ever trusted with more than what it was dealt.
export function publishCard(state, playerId, card) {
  if (!playerId || !card) return { patch: {} };
  if (state.reveal?.[playerId]) return { patch: {} }; // already in — don't let it be rewritten
  return { patch: { reveal: { ...(state.reveal ?? {}), [playerId]: card } } };
}

export function everyoneRevealed(state, activeIds) {
  if (!activeIds?.length) return false;
  return activeIds.every((id) => state.reveal?.[id]);
}

/**
 * Reconstructs the answer from the published cards alone.
 *
 * Three ways it lands, in order of confidence:
 *
 *   1. Blind mode — the fake's card says so. Nothing to infer.
 *   2. Decoy mode — every crew member was dealt the same character and the fake
 *      was not, so the odd card out is theirs.
 *   3. The fake left (or refused to publish) — they are then the only player
 *      with no card at all, and everyone else agrees.
 *
 * Cards are grouped by `key`, the folded character name, because that is the
 * only reference two devices can both resolve with no shared board between them.
 *
 * Returns fakeId: null when the room genuinely cannot tell, which the results
 * screen shows as an unscored round rather than inventing a culprit.
 *
 * `fakeCard` is whatever the fake was holding — the decoy character in decoy
 * mode, the confession-and-hint in blind. Kept for the same reason `secret` keeps
 * a representative card: the published set is the only record of who a character
 * was, so dropping the odd card out loses the decoy for good. It is null in case
 * 3 above, where the fake is named by elimination and never published anything.
 */
export function deriveTruth(reveal, playerIds) {
  const ids = playerIds ?? [];
  const cards = ids.map((id) => [id, reveal?.[id]]).filter(([, c]) => c);

  const counts = new Map();
  // One representative card per key, kept so the winner can be rendered — the
  // published set is now the only record of who the character was.
  const byKey = new Map();
  for (const [, c] of cards) {
    if (c.isFake || !c.key) continue;
    counts.set(c.key, (counts.get(c.key) || 0) + 1);
    if (!byKey.has(c.key)) byKey.set(c.key, c);
  }
  let key = null;
  let best = 0;
  let tied = false;
  for (const [k, n] of counts) {
    if (n > best) { best = n; key = k; tied = false; } else if (n === best) { tied = true; }
  }
  // Two characters with equal support means there is no crew majority to
  // believe — only reachable below MIN_PLAYERS or once most of the table has
  // left.
  if (tied) key = null;

  const secret = key ? byKey.get(key) : null;

  // Every branch names the fake by id, so the card is one lookup away — and a
  // fake found by elimination has none, which is exactly the null the results
  // screen renders as "they never turned their card over".
  const found = (fakeId) => ({ fakeId, secret, fakeCard: reveal?.[fakeId] ?? null });

  const confessed = cards.find(([, c]) => c.isFake);
  if (confessed) return found(confessed[0]);

  if (key) {
    const odd = cards.filter(([, c]) => !c.isFake && c.key !== key).map(([id]) => id);
    if (odd.length === 1) return found(odd[0]);

    const missing = ids.filter((id) => !reveal?.[id]);
    if (odd.length === 0 && missing.length === 1) return found(missing[0]);
  }

  return { fakeId: null, secret, fakeCard: null };
}

// The caught fake's one shot: name the secret. Blind mode only — in decoy mode
// they were handed a character of their own and have nothing to steal.
//
// Typed rather than picked, because there is no board to pick from. Stored as
// what they typed, not as a key: the results screen quotes it back, and a fold
// is cheap enough to redo at scoring time.
export function submitSteal(state, name) {
  if (state.steal) return { patch: {} };
  const guess = (name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_STEAL_LEN);
  if (!guess) return { patch: {} };
  return { patch: { steal: { name: guess } } };
}

// Whether a typed guess names the secret. Folded on both sides, so "levi
// ackerman" matches "Levi Ackerman" and a name typed without its macrons
// matches one stored with them — the same allowance AniGuess's isCorrectGuess
// makes, and for the same reason: nobody types ō.
export function stealIsCorrect(steal, secret) {
  if (!steal?.name || !secret?.key) return false;
  return characterNameKey(steal.name) === secret.key;
}

export function needsSteal(state, fakeId) {
  if (state.mode !== 'blind' || !fakeId) return false;
  if (state.steal) return false;
  return tallyVotes(state.votes).caught === fakeId;
}

// --- scoring ---------------------------------------------------------------

/**
 * Round scores keyed by player id — the shape totalScores and
 * shared/utils/ranking.js's computeRankedPlayers both expect.
 *
 *   crew member who voted the fake   +1
 *   fake, if the vote did not land on them   +2
 *   fake, caught but named the secret correctly   +1
 *
 * Individual credit rather than a team result: it matches the per-player
 * totalScores every other game banks into, and it needs no rule for what a
 * tied team outcome means.
 *
 * Returns {} when the truth could not be reconstructed, which callers gate
 * applyRoundScores on.
 */
export function scoreRound(state, { fakeId, secret } = {}) {
  const out = {};
  if (!fakeId) return out;

  for (const [voter, target] of Object.entries(state.votes ?? {})) {
    if (voter !== fakeId && target === fakeId) out[voter] = (out[voter] || 0) + 1;
  }

  const { caught } = tallyVotes(state.votes);
  if (caught !== fakeId) {
    out[fakeId] = (out[fakeId] || 0) + 2;
  } else if (state.mode === 'blind' && stealIsCorrect(state.steal, secret)) {
    out[fakeId] = (out[fakeId] || 0) + 1;
  }
  return out;
}

// Folds a round's scores into the running totals. Not idempotent — callers gate
// it, the same way AniRank's is gated by a banking claim.
export function applyRoundScores(totalScores, roundScores) {
  const out = { ...totalScores };
  for (const [id, score] of Object.entries(roundScores ?? {})) {
    out[id] = (out[id] || 0) + score;
  }
  return out;
}
