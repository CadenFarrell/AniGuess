// Pure, framework- and backend-free AniTune round rules: the buzz race, the
// pass-and-play simultaneous entry, scoring, and question advancement.
//
// Modelled on src/games/aniguess/rules.js — no React, no storage, no network —
// so the same logic can back local (useState) play now and a Firebase-backed
// room later without the game loop being rewritten. Every function takes the
// round state and returns a { patch } to merge onto it; callers apply the patch
// however their persistence layer works.
import { isCorrectTitleGuess } from './utils/titleMatch';

export const RACE = 'race';
export const SIMULTANEOUS = 'simultaneous';

// Phases, shared by both modes:
//   listening — the clip is playing for the room
//   buzzed    — race: someone has buzzed and is typing their answer
//   handoff   — simultaneous: waiting for the next player to take the device
//   entry     — simultaneous: that player is typing
//   revealed  — the answer is out and this question's scores are final

// Rotates the pass order by question index. Entering last is a mild advantage —
// you get everyone else's typing time to think — so it shouldn't always be the
// same person.
function rotate(ids, offset) {
  if (!ids.length) return [];
  const at = ((offset % ids.length) + ids.length) % ids.length;
  return [...ids.slice(at), ...ids.slice(0, at)];
}

// The per-question fields. Everything outside this (mode, index, scores)
// survives from one question to the next.
function questionReset(players, index) {
  return {
    phase: 'listening',
    buzzedBy: null,
    lockedOut: [],
    entryOrder: rotate(players.map((p) => p.id), index),
    entryIndex: 0,
    answers: {},
  };
}

export function startRound(players, mode = RACE) {
  return {
    mode,
    index: 0,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    ...questionReset(players, 0),
  };
}

// --- Race ------------------------------------------------------------------

export function buzz(state, playerId) {
  if (state.phase !== 'listening' || state.lockedOut.includes(playerId)) return { patch: {} };
  return { patch: { phase: 'buzzed', buzzedBy: playerId } };
}

// A wrong buzz costs the question, not a point: the player is out until the
// next clip and everyone else keeps racing. Once nobody is left the answer is
// revealed rather than leaving the room stuck on a clip no one can answer.
export function resolveBuzz(state, question, guess, players) {
  if (state.phase !== 'buzzed' || !state.buzzedBy) return { patch: {} };
  const playerId = state.buzzedBy;
  const correct = isCorrectTitleGuess(question, guess);
  const answers = { ...state.answers, [playerId]: { text: guess, correct } };

  if (correct) {
    return {
      patch: {
        phase: 'revealed',
        answers,
        scores: { ...state.scores, [playerId]: (state.scores[playerId] || 0) + 1 },
      },
    };
  }

  const lockedOut = [...state.lockedOut, playerId];
  return {
    patch: {
      phase: lockedOut.length >= players.length ? 'revealed' : 'listening',
      buzzedBy: null,
      lockedOut,
      answers,
    },
  };
}

// "Nobody got it" — the room concedes the question without anyone buzzing.
export function giveUp(state) {
  if (state.phase === 'revealed') return { patch: {} };
  return { patch: { phase: 'revealed', buzzedBy: null } };
}

// --- Simultaneous ----------------------------------------------------------

// The room has heard the clip; start passing the device around.
export function startGuessing(state) {
  if (state.phase !== 'listening') return { patch: {} };
  return { patch: { phase: 'handoff' } };
}

// The named player has confirmed they're holding the device.
export function beginEntry(state) {
  if (state.phase !== 'handoff') return { patch: {} };
  return { patch: { phase: 'entry' } };
}

// Grades on submit but keeps the verdict hidden until everyone is in, so the
// scoreboard can't tell player three what players one and two managed.
export function submitAnswer(state, question, text) {
  if (state.phase !== 'entry') return { patch: {} };
  const playerId = state.entryOrder[state.entryIndex];
  const answers = {
    ...state.answers,
    [playerId]: { text, correct: isCorrectTitleGuess(question, text) },
  };
  const entryIndex = state.entryIndex + 1;

  if (entryIndex < state.entryOrder.length) {
    return { patch: { answers, entryIndex, phase: 'handoff' } };
  }

  const scores = { ...state.scores };
  for (const [id, answer] of Object.entries(answers)) {
    if (answer.correct) scores[id] = (scores[id] || 0) + 1;
  }
  return { patch: { answers, entryIndex, phase: 'revealed', scores } };
}

// --- Advancement -----------------------------------------------------------

export function nextQuestion(state, players, roundLength) {
  const index = state.index + 1;
  if (index >= roundLength) return { finished: true, patch: {} };
  return { finished: false, patch: { index, ...questionReset(players, index) } };
}

// Whoever the UI should be highlighting right now, if anyone.
export function activePlayerId(state) {
  if (state.phase === 'buzzed') return state.buzzedBy;
  if (state.phase === 'handoff' || state.phase === 'entry') return state.entryOrder[state.entryIndex];
  return null;
}
