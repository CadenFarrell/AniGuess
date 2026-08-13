// Pure, framework- and backend-free AniTune round rules: the buzz race, the
// pass-and-play simultaneous entry, the guess clock, scoring, elimination, and
// question advancement.
//
// Modelled on src/games/aniguess/rules.js — no React, no storage, no network —
// so the same logic can back local (useState) play and a Firebase-backed room
// without the game loop being rewritten. Every function takes the round state
// and returns a { patch } to merge onto it; callers apply the patch however
// their persistence layer works.
//
// **Time convention.** Nothing here reads a clock. Any rule whose result depends
// on "now" takes it as an explicit trailing parameter — an absolute epoch-ms
// instant, already corrected for server skew by the caller — and the state
// stores absolute instants, never durations-since. That is what lets one room's
// devices agree: they agree on *when* something happens and disagree, by
// hundreds of milliseconds, about how long ago it was. It also means every clock
// behaviour below is testable against a fake number.
import { isCorrectTitleGuess } from './utils/titleMatch';
import { QUESTION_POINTS, speedBonus } from '../../shared/utils/deadline';

export const RACE = 'race';
export const SIMULTANEOUS = 'simultaneous';
export const LIVES = 'lives';

// Race is the odd one out: one answer per question, and a wrong one costs you
// the clip. Everything else runs the everyone-types shape, so components and
// gates should branch on this rather than listing modes.
export const isRace = (mode) => mode === RACE;
// Lives layers elimination on top of that shape. Kept separate from isRace so
// adding a fourth mode is one entry here, not a scan for `=== SIMULTANEOUS`.
export const hasLives = (mode) => mode === LIVES;

// Phases, shared by every mode:
//   listening — the clip is playing for the room
//   buzzed    — race: someone has buzzed and is typing their answer
//   handoff   — local simultaneous: waiting for the next player to take the device
//   entry     — local simultaneous: that player is typing
//   revealed  — the answer is out and this question's scores are final
//   finished  — the round is over (written by the online hook, not by a rule)

// Rotates the pass order by question index. Entering last is a mild advantage —
// you get everyone else's typing time to think — so it shouldn't always be the
// same person.
function rotate(ids, offset) {
  if (!ids.length) return [];
  const at = ((offset % ids.length) + ids.length) % ids.length;
  return [...ids.slice(at), ...ids.slice(0, at)];
}

// The per-question fields. Everything outside this (mode, index, scores, lives,
// the timing settings) survives from one question to the next.
//
// The four window fields all reset to null because a question with no window
// open yet is exactly a question with no clock: openWindow below is what starts
// it, once the clip actually begins, and until then nothing should be counting
// down or scoring anyone as fast.
function questionReset(players, index) {
  return {
    phase: 'listening',
    buzzedBy: null,
    buzzedAt: null,
    lockedOut: [],
    entryOrder: rotate(players.map((p) => p.id), index),
    entryIndex: 0,
    answers: {},
    windowStartAt: null,
    windowMs: null,
    deadlineAt: null,
    pausedRemainingMs: null,
  };
}

/**
 * A fresh round.
 *
 * `options` carries only the settings a *rule* acts on. Everything else a player
 * picked (clip length, sample point, playback rate, how the pool was drawn)
 * decides what the screens render or what was dealt, and per CLAUDE.md stays out
 * of round state.
 *
 * `timed: false` is a real supported round, not a degenerate one: every window
 * stays null, scoreAnswer falls back to a flat point, and the game plays exactly
 * as it did before the clock existed. Keeping that path honest is what makes the
 * setting safe to default on.
 */
export function startRound(players, mode = RACE, {
  timed = false,
  guessSeconds = 20,
  answerSeconds = 10,
  startingLives = 3,
} = {}) {
  return {
    mode,
    index: 0,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    timed: Boolean(timed),
    guessMs: timed ? guessSeconds * 1000 : null,
    // Race only: how long the buzzer gets to type once they have the clip.
    answerMs: timed ? answerSeconds * 1000 : null,
    // Lives mode only. Written for every mode so normalizeGame has one shape to
    // repair and a mid-round mode change is not a thing that can happen.
    lives: hasLives(mode)
      ? Object.fromEntries(players.map((p) => [p.id, startingLives]))
      : {},
    // Append-only, so it doubles as the elimination *order* the results screen
    // ranks by — out on question 9 beats out on question 2.
    eliminated: [],
    ...questionReset(players, 0),
  };
}

// --- The clock -------------------------------------------------------------

/**
 * Opens this question's scoring window at `at` — the instant the clip starts.
 *
 * Deliberately a separate step from questionReset rather than being stamped when
 * the question is dealt. Online, the room deals the question and only then
 * negotiates a synchronized clip start (every device has to buffer audio and
 * unlock playback first), and those are seconds apart on a cold CDN. Scoring
 * speed from the deal would hand the whole bonus to whoever's audio loaded
 * fastest, which measures their connection rather than their ear.
 *
 * Idempotent: every device may call it, and the first write wins. An untimed
 * round leaves the window null and the guard below turns the call into a no-op.
 */
export function openWindow(state, at) {
  if (!state.timed || !state.guessMs) return { patch: {} };
  if (state.windowStartAt != null) return { patch: {} };
  return {
    patch: {
      windowStartAt: at,
      windowMs: state.guessMs,
      deadlineAt: at + state.guessMs,
    },
  };
}

/**
 * How far into the *currently open* window `now` is, or null if there isn't one.
 *
 * Every rule that records an answer stamps this onto it, rather than storing the
 * absolute instant and subtracting at scoring time. That looks like redundancy
 * and is not: pass-and-play opens a **new window per player**, so by the time
 * the last submit settles the whole question, `windowStartAt` is the last
 * player's window and everyone earlier would be measured against a clock that
 * started after they answered — scoring the first three players a full speed
 * bonus for free. An elapsed time is only meaningful beside the window it was
 * taken in, so it is computed while that window is still the current one.
 */
function elapsedIn(state, now) {
  if (state.windowStartAt == null || !state.windowMs || now == null) return null;
  // Clamped to the window at BOTH ends. An answer cannot honestly have taken
  // longer than the window it was given, because the window closing is what
  // ends the question — so anything past it is the recording being late, not
  // the player being slow. Two ways that happens: a submit racing the expiry
  // transaction and landing a few ms after it, and a backgrounded or frozen tab
  // where the expiry effect only runs when the renderer comes back. The second
  // is not theoretical; a stalled renderer during testing produced "43.0s" on a
  // six-second window, which is a number about the browser, not the game.
  //
  // It also keeps the two expiry paths agreeing: expireQuestion stamps windowMs
  // directly for players who never answered, while the pass-and-play branch
  // delegates to submitAnswer and comes through here. Both now say the same
  // thing about the same event.
  return Math.min(state.windowMs, Math.max(0, now - state.windowStartAt));
}

/**
 * What one answer is worth.
 *
 * The single scoring function — every path that awards a point goes through it,
 * and so does the reveal that explains one. That is the house rule anirank's
 * rules.js states out loud: what a player reads and what they were awarded have
 * to come out of the same comparison, or the two drift and the game looks like
 * it is lying.
 *
 * A correct answer is always worth at least QUESTION_POINTS. The bonus is on top
 * and can only ever reach 1, so a slow correct answer beats a fast wrong one by
 * construction — being quick is worth less than being right, which is the only
 * ordering that keeps a recognition game about recognition.
 *
 * No window (untimed round, or an answer recorded before one opened) means no
 * bonus, not a zero score: the flat point is what this game paid before the
 * clock existed and is what an untimed round still pays.
 */
export function scoreAnswer(answer, windowMs) {
  if (!answer?.correct) return 0;
  if (!windowMs || answer.ms == null) return QUESTION_POINTS;
  return QUESTION_POINTS + speedBonus(answer.ms, windowMs);
}

// How fast an answer was, in ms, or null when there was nothing to measure
// against. The reveal renders this and derives the delta-to-fastest from it.
export function answerElapsedMs(answer) {
  return answer?.ms ?? null;
}

// --- Lives -----------------------------------------------------------------

/**
 * Who the room is still waiting on: present, and not knocked out.
 *
 * Every readiness gate must route through this once Lives exists. An eliminated
 * player will never submit an answer, so counting them holds the reveal open
 * forever — the identical failure to a closed browser tab, arriving from a new
 * direction. The presence roster cannot see it, because they are still very much
 * there, watching.
 */
export function livePlayerIds(state, activeIds) {
  const out = state?.eliminated ?? [];
  return (activeIds ?? []).filter((id) => !out.includes(id));
}

export function isEliminated(state, playerId) {
  return (state?.eliminated ?? []).includes(playerId);
}

/**
 * Turns a settled set of answers into scores, and in Lives mode into lives lost.
 *
 * Called by every path that reaches 'revealed' — a last submit, a forced reveal,
 * an expiry — so all three award identically and none of them can double-score
 * (each is separately guarded against running on an already-revealed state).
 *
 * `graded` is who this settlement judges. In Lives that is who was *required* to
 * answer, which is why a miss can be recorded for a player with no answer at all:
 * saying nothing has to cost a life, or waiting out the clock would be free.
 */
function settle(state, answers, graded) {
  const scores = { ...state.scores };
  for (const [id, answer] of Object.entries(answers)) {
    const points = scoreAnswer(answer, state.windowMs);
    if (points) scores[id] = (scores[id] || 0) + points;
  }
  if (!hasLives(state.mode)) return { scores };

  const lives = { ...state.lives };
  const eliminated = [...(state.eliminated ?? [])];
  for (const id of graded) {
    if (eliminated.includes(id)) continue;
    if (answers[id]?.correct) continue;
    const left = Math.max(0, (lives[id] ?? 0) - 1);
    lives[id] = left;
    if (left === 0) eliminated.push(id);
  }
  return { scores, lives, eliminated };
}

// --- Race ------------------------------------------------------------------

/**
 * Claim the clip.
 *
 * Pauses the buzz window rather than letting it run: the others must not lose
 * the seconds this player spends typing, or a buzz would double as a way to burn
 * everyone else's clock. `pausedRemainingMs` is what a wrong answer hands back.
 */
export function buzz(state, playerId, now) {
  if (state.phase !== 'listening' || state.lockedOut.includes(playerId)) return { patch: {} };
  const remaining = state.deadlineAt != null ? Math.max(0, state.deadlineAt - now) : null;
  return {
    patch: {
      phase: 'buzzed',
      buzzedBy: playerId,
      // The instant the race was won. Scoring reads this, not the submit time —
      // see resolveBuzz.
      buzzedAt: now,
      pausedRemainingMs: remaining,
      deadlineAt: state.answerMs != null ? now + state.answerMs : null,
    },
  };
}

// A wrong buzz costs the question, not a point: the player is out until the
// next clip and everyone else keeps racing, with the buzz window resumed at
// exactly the time it had left. Once nobody is left the answer is revealed
// rather than leaving the room stuck on a clip no one can answer.
//
// Online, `players` is the *active* roster — anyone who left is already out of
// it, and lockedOut can still name them, so exhaustion is "everyone still here
// is locked out" rather than a count comparison.
//
// Speed is measured to the *buzz*, not to this submit. You won the race the
// moment you hit the button; making you race your own typing afterwards would
// punish long titles and reward abbreviations, which is a spelling contest.
export function resolveBuzz(state, question, guess, players, now) {
  if (state.phase !== 'buzzed' || !state.buzzedBy) return { patch: {} };
  const playerId = state.buzzedBy;
  const correct = isCorrectTitleGuess(question, guess);
  const answer = { text: guess, correct, ms: elapsedIn(state, state.buzzedAt ?? now) };
  const answers = { ...state.answers, [playerId]: answer };

  if (correct) {
    return {
      patch: {
        phase: 'revealed',
        answers,
        deadlineAt: null,
        pausedRemainingMs: null,
        ...settle(state, answers, [playerId]),
      },
    };
  }

  const lockedOut = [...state.lockedOut, playerId];
  const done = everyoneLockedOut(players, lockedOut);
  return {
    patch: {
      phase: done ? 'revealed' : 'listening',
      buzzedBy: null,
      buzzedAt: null,
      lockedOut,
      answers,
      // Hand the remaining buzz time back to the rest of the room.
      deadlineAt: done || state.pausedRemainingMs == null ? null : now + state.pausedRemainingMs,
      pausedRemainingMs: null,
      ...(done ? settle(state, answers, lockedOut) : {}),
    },
  };
}

// Nobody left who is allowed to buzz.
export function everyoneLockedOut(players, lockedOut) {
  return players.length > 0 && players.every((p) => lockedOut.includes(p.id));
}

// The buzzer walked away mid-answer. Only they can resolve their own buzz, so
// the room would otherwise sit on a paused clip forever — hand the question
// back and lock them out, both so the clip resumes for everyone else and so a
// reconnect can't let them buzz the same question twice.
export function releaseBuzz(state, playerId, now) {
  if (state.phase !== 'buzzed' || state.buzzedBy !== playerId) return { patch: {} };
  const lockedOut = state.lockedOut.includes(playerId)
    ? state.lockedOut
    : [...state.lockedOut, playerId];
  return {
    patch: {
      phase: 'listening',
      buzzedBy: null,
      buzzedAt: null,
      lockedOut,
      // Same resume as a wrong answer: their walking off should not cost the
      // room the seconds they were holding.
      deadlineAt: state.pausedRemainingMs == null ? null : now + state.pausedRemainingMs,
      pausedRemainingMs: null,
    },
  };
}

// "Nobody got it" — the room concedes the question without anyone buzzing.
// Settles so Lives still charges everyone who never answered.
export function giveUp(state, activeIds = []) {
  if (state.phase === 'revealed') return { patch: {} };
  return {
    patch: {
      phase: 'revealed',
      buzzedBy: null,
      deadlineAt: null,
      pausedRemainingMs: null,
      ...settle(state, state.answers ?? {}, livePlayerIds(state, activeIds)),
    },
  };
}

// --- Simultaneous ----------------------------------------------------------

// The room has heard the clip; start passing the device around.
export function startGuessing(state) {
  if (state.phase !== 'listening') return { patch: {} };
  return { patch: { phase: 'handoff', deadlineAt: null } };
}

/**
 * The named player has confirmed they're holding the device.
 *
 * Pass-and-play re-opens the window *per player*, which is the one place the
 * clock is not shared. A single window across the whole table would be
 * meaningless here: the fourth player has sat through three turns of thinking
 * time, so their "speed" would measure the queue, not them. Everyone gets the
 * same seconds from the moment the device is in their hands.
 */
export function beginEntry(state, now) {
  if (state.phase !== 'handoff') return { patch: {} };
  if (!state.timed || !state.guessMs) return { patch: { phase: 'entry' } };
  return {
    patch: {
      phase: 'entry',
      windowStartAt: now,
      windowMs: state.guessMs,
      deadlineAt: now + state.guessMs,
    },
  };
}

// Grades on submit but keeps the verdict hidden until everyone is in, so the
// scoreboard can't tell player three what players one and two managed.
//
// Scoring is deferred to the final submit for the same reason it always was: a
// running total updated mid-pass would leak each answer as it landed.
export function submitAnswer(state, question, text, now) {
  if (state.phase !== 'entry') return { patch: {} };
  const playerId = state.entryOrder[state.entryIndex];
  const answers = {
    ...state.answers,
    [playerId]: { text, correct: isCorrectTitleGuess(question, text), ms: elapsedIn(state, now) },
  };
  const entryIndex = state.entryIndex + 1;

  if (entryIndex < state.entryOrder.length) {
    return { patch: { answers, entryIndex, phase: 'handoff', deadlineAt: null } };
  }

  return {
    patch: {
      answers,
      entryIndex,
      phase: 'revealed',
      deadlineAt: null,
      ...settle(state, answers, state.entryOrder),
    },
  };
}

// --- Simultaneous, online --------------------------------------------------

// Online everyone-guesses has no device to pass, so the local handoff/entry
// rotation (entryOrder/entryIndex) doesn't apply — every player types on their
// own device at the same time, against one shared window. This records one
// player's answer and, once every player is in, reveals and scores in one step.
// The verdict is graded here but each device hides the others' answers until
// phase is 'revealed'.
//
// `allPlayerIds` is the roster the room is actually waiting on — active, and in
// Lives mode not eliminated (see livePlayerIds). Anyone who cannot submit must
// not be counted, or the reveal never comes.
export function submitOnlineAnswer(state, question, playerId, text, allPlayerIds, now) {
  if (state.phase === 'revealed' || state.answers[playerId]) return { patch: {} };
  const answers = {
    ...state.answers,
    [playerId]: { text, correct: isCorrectTitleGuess(question, text), ms: elapsedIn(state, now) },
  };

  if (!allPlayerIds.every((id) => answers[id])) {
    return { patch: { answers } };
  }

  return {
    patch: {
      answers,
      phase: 'revealed',
      deadlineAt: null,
      ...settle(state, answers, allPlayerIds),
    },
  };
}

// Force the reveal with only the answers submitted so far — the escape hatch
// when someone has wandered off, so the room isn't stuck waiting forever. Scores
// whatever is in, exactly as the final submit would have.
//
// `graded` names who a Lives round should still charge. It defaults to empty
// because the caller that reaches for this one is usually reconciling a
// departure, and a player who has left the room should not lose a life for it.
export function revealNow(state, graded = []) {
  if (state.phase === 'revealed') return { patch: {} };
  return {
    patch: {
      phase: 'revealed',
      deadlineAt: null,
      pausedRemainingMs: null,
      ...settle(state, state.answers ?? {}, graded),
    },
  };
}

/**
 * The clock ran out.
 *
 * The first gate in this codebase that closes on *time* rather than on consensus
 * or on someone leaving. Every other readiness check in the app waits for a
 * unanimous roster, which is correct right up until a player is present and
 * simply not answering — a case presence cannot see and nothing else can end.
 *
 * Idempotent by the same guards the other reveal paths use, so it does not
 * matter that several devices notice the expiry at slightly different moments
 * and all fire: the transaction the second one lands aborts on an
 * already-revealed state.
 *
 * Each mode expires into whatever it already had a name for:
 *   race, unbuzzed  — nobody got it
 *   race, buzzed    — the buzzer's answer time ran out; a blank wrong answer,
 *                     which hands the clip back to the rest exactly as a wrong
 *                     guess does rather than ending a question they can still win
 *   pass-and-play   — this player's turn is a blank, pass the device on
 *   everyone-types  — everyone still owing an answer is marked as passing
 */
export function expireQuestion(state, question, activeIds, now) {
  if (state.phase === 'revealed' || state.deadlineAt == null) return { patch: {} };
  const live = livePlayerIds(state, activeIds);

  if (isRace(state.mode)) {
    if (state.phase === 'buzzed') {
      return resolveBuzz(state, question, '', activeIds.map((id) => ({ id })), now);
    }
    return giveUp(state, activeIds);
  }

  if (state.phase === 'entry') return submitAnswer(state, question, '', now);
  if (state.phase === 'handoff') return { patch: {} };

  const answers = { ...state.answers };
  for (const id of live) {
    // They used the whole window. The value is cosmetic — a blank answer is
    // wrong, so it scores zero however fast it notionally was — but the reveal
    // renders a time for every row and "0.0s" beside "passed" reads as a lie.
    if (!answers[id]) answers[id] = { text: '', correct: false, ms: state.windowMs ?? null };
  }
  return {
    patch: {
      answers,
      phase: 'revealed',
      deadlineAt: null,
      ...settle(state, answers, live),
    },
  };
}

// --- Advancement -----------------------------------------------------------

export function nextQuestion(state, players, roundLength) {
  const index = state.index + 1;
  if (index >= roundLength) return { finished: true, patch: {} };

  if (!hasLives(state.mode)) {
    return { finished: false, patch: { index, ...questionReset(players, index) } };
  }

  // Lives ends early when there is no contest left. With one player it takes
  // their last life to finish; with more, the moment a single survivor remains —
  // playing on would be a solo round nobody can lose.
  const survivors = players.filter((p) => !isEliminated(state, p.id));
  const over = players.length > 1 ? survivors.length <= 1 : survivors.length === 0;
  if (over) return { finished: true, patch: {} };

  // The pass order is rebuilt from the survivors, so pass-and-play stops handing
  // the device to someone who is out — they would have nothing to do with it but
  // pass it on, and submitAnswer would charge them a life for a question they
  // were never in. Online has no pass order and reads livePlayerIds instead;
  // this is the local half of the same rule.
  return { finished: false, patch: { index, ...questionReset(survivors, index) } };
}

/**
 * A saved round, rewound to the START of the question it was on → state or null.
 *
 * RESUMING MID-QUESTION IS NOT AN OPTION, and that is a property of the clock
 * rather than a simplification. Every window here is stored as an absolute
 * instant (see the convention at the top of this file), so a deadline written
 * to storage last night is not "20 seconds of guessing time" — it is a moment
 * that has already passed. Restoring one would hand the table a question that
 * expires the instant it is rendered, grading everybody as out of time, and
 * `answers` half-collected from a window nobody can still be inside is not a
 * state any rule below knows how to finish. So the question is re-asked: the
 * clip replays, the clock starts fresh, and nothing cumulative is lost —
 * scores, lives and the elimination order all carry over untouched.
 *
 * Returns null for a round there is nothing to resume into — a finished or
 * out-of-range index, a shape that isn't a round, or a Lives round with no
 * contest left. Null means "offer a fresh game", never a thrown error: this
 * runs against a blob from localStorage that an older build may have written.
 *
 * The pass order is rebuilt from the SURVIVORS, the same rule nextQuestion
 * applies and for the same reason — resuming must not hand the device to
 * someone who is out, where submitAnswer would charge them a life for a
 * question they were never in.
 */
export function resumeRound(saved, players, roundLength) {
  if (!saved || typeof saved !== 'object' || !Array.isArray(players) || !players.length) return null;
  const index = Number.isInteger(saved.index) ? saved.index : -1;
  if (index < 0 || index >= roundLength) return null;

  if (!hasLives(saved.mode)) {
    return { ...saved, ...questionReset(players, index) };
  }

  const survivors = players.filter((p) => !isEliminated(saved, p.id));
  const over = players.length > 1 ? survivors.length <= 1 : survivors.length === 0;
  if (over) return null;
  return { ...saved, ...questionReset(survivors, index) };
}

// Whoever the UI should be highlighting right now, if anyone.
export function activePlayerId(state) {
  if (state.phase === 'buzzed') return state.buzzedBy;
  if (state.phase === 'handoff' || state.phase === 'entry') return state.entryOrder[state.entryIndex];
  return null;
}
