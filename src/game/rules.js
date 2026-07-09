// Pure, framework- and backend-free game rules: assignment rotation, turn
// advancement, scoring/positions, round resets. Extracted from useGameFlow.js
// so the same logic can back both local (useState) and online (Firebase)
// persistence without duplicating the turn/scoring math.
//
// These functions never touch React state or storage directly — callers pass
// in whatever slice of the state bundle they need and apply the returned
// patch/values however their persistence layer works.

export function startGame(session) {
  return {
    gameSession: session,
    assignmentIndex: 0,
    assignments: [],
    currentPlayerIndex: 0,
    lockedPositions: [],
    peekedPlayers: [],
    questionLogs: {},
    turnCounts: Object.fromEntries(session.players.map((p) => [p.id, 0])),
    roundNumber: 1,
    totalScores: {},
  };
}

// Get next non-locked player index after fromIndex (round-robin wraparound).
// Returns -1 only when every player is locked.
export function getNextPlayerIndex(players, fromIndex, locked) {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const idx = (fromIndex + i) % total;
    const player = players[idx];
    if (!locked.find((lp) => lp.playerId === player.id)) return idx;
  }
  return -1;
}

// Called when a character is assigned to the current player in assignment phase.
export function characterAssigned(state, character) {
  const player = state.gameSession.players[state.assignmentIndex];
  return { assignments: [...state.assignments, { playerId: player.id, character }] };
}

// Called after reveal — move to next player assignment or start the game.
export function revealDone(state) {
  const nextIndex = state.assignmentIndex + 1;
  if (nextIndex >= state.gameSession.players.length) {
    return { patch: { currentPlayerIndex: 0 }, next: 'game' };
  }
  return { patch: { assignmentIndex: nextIndex }, next: 'assignment' };
}

// Called when the current player asks a question / a timer expires (turn
// passes without a guess).
export function turnComplete(state, logEntry) {
  const player = state.gameSession.players[state.currentPlayerIndex];
  const questionLogs = {
    ...state.questionLogs,
    [player.id]: [logEntry, ...(state.questionLogs[player.id] || [])],
  };
  const turnCounts = {
    ...state.turnCounts,
    [player.id]: (state.turnCounts[player.id] || 0) + 1,
  };
  // A player who just took a normal turn is never in lockedPositions yet, so
  // getNextPlayerIndex always finds at least themself via wraparound — it
  // can't return -1 from this call site.
  const currentPlayerIndex = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, state.lockedPositions);
  return { patch: { questionLogs, turnCounts, currentPlayerIndex } };
}

// Called when the current player guesses correctly.
export function correctGuess(state, logEntry) {
  const player = state.gameSession.players[state.currentPlayerIndex];
  const turnsUsed = (state.turnCounts[player.id] || 0) + 1;

  const playersWithFewerTurns = state.lockedPositions.filter(
    (lp) => lp.turnsUsed < turnsUsed
  ).length;
  const position = playersWithFewerTurns + 1;
  const { pointsPerPosition } = state.gameSession.settings;
  const points = pointsPerPosition[Math.min(position - 1, pointsPerPosition.length - 1)] || 0;

  const lastLocked = { playerId: player.id, name: player.name, position, points, turnsUsed };
  const lockedPositions = [...state.lockedPositions, lastLocked];

  const questionLogs = {
    ...state.questionLogs,
    [player.id]: [logEntry, ...(state.questionLogs[player.id] || [])],
  };
  const turnCounts = { ...state.turnCounts, [player.id]: turnsUsed };

  // Always show the celebration screen — the Continue button decides
  // whether to go back to the game or finish the round.
  const next = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, lockedPositions);
  const patch = { questionLogs, turnCounts, lockedPositions };
  if (next !== -1) patch.currentPlayerIndex = next;

  return { patch, lastLocked, next: 'correctGuess' };
}

// Called when the current player guesses wrong — just advance the turn.
export function wrongGuess(state, logEntry) {
  const player = state.gameSession.players[state.currentPlayerIndex];
  const questionLogs = {
    ...state.questionLogs,
    [player.id]: [logEntry, ...(state.questionLogs[player.id] || [])],
  };
  const turnCounts = {
    ...state.turnCounts,
    [player.id]: (state.turnCounts[player.id] || 0) + 1,
  };
  const next = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, state.lockedPositions);
  const patch = { questionLogs, turnCounts };
  if (next !== -1) patch.currentPlayerIndex = next;
  return { patch };
}

// Applies a completed round's points onto the running totals.
export function applyRoundScores(totalScores, locked) {
  const updated = { ...totalScores };
  locked.forEach((lp) => {
    updated[lp.playerId] = (updated[lp.playerId] || 0) + lp.points;
  });
  return updated;
}

// Resets assignment/turn state for a new round (keeps totalScores/roundNumber
// building on what came before).
export function newRound(state) {
  return {
    patch: {
      assignmentIndex: 0,
      assignments: [],
      currentPlayerIndex: 0,
      lockedPositions: [],
      peekedPlayers: [],
      questionLogs: {},
      turnCounts: Object.fromEntries(state.gameSession.players.map((p) => [p.id, 0])),
      roundNumber: state.roundNumber + 1,
    },
    next: 'assignment',
  };
}

// Determines who (if anyone) should be credited a win at session end.
export function computeSessionEnd(totalScores, players) {
  const scores = Object.values(totalScores);
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const winners = maxScore > 0
    ? players.filter((p) => (totalScores[p.id] || 0) === maxScore).map((p) => p.name)
    : [];
  return { maxScore, winners };
}
