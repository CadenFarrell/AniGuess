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
//
// `skipIds` is online-only: players who have left the room. Nobody can take a
// turn on their behalf, so the rotation has to step over them or the game stops
// dead on a player who will never act. Local play passes nothing.
export function getNextPlayerIndex(players, fromIndex, locked, skipIds = []) {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const idx = (fromIndex + i) % total;
    const player = players[idx];
    if (locked.find((lp) => lp.playerId === player.id)) continue;
    if (skipIds.includes(player.id)) continue;
    return idx;
  }
  return -1;
}

// First player who can still act, for the phase boundaries that would otherwise
// hand the opening turn to whoever happens to sit at index 0.
export function firstActiveIndex(players, skipIds = []) {
  const idx = players.findIndex((p) => !skipIds.includes(p.id));
  return idx === -1 ? 0 : idx;
}

// Every player still in the room has been placed, so the round is over. Counts
// the active roster rather than lockedPositions.length, since a player who left
// mid-round will never be locked and would hold the round open forever.
export function roundComplete(lockedPositions, activePlayers) {
  return activePlayers.length > 0
    && activePlayers.every((p) => lockedPositions.some((lp) => lp.playerId === p.id));
}

// Called when a character is assigned to the current player in assignment phase.
export function characterAssigned(state, character) {
  const player = state.gameSession.players[state.assignmentIndex];
  return { assignments: [...state.assignments, { playerId: player.id, character }] };
}

// Called after reveal — move to next player assignment or start the game.
// Steps over anyone who has left: there's no point choosing a character for a
// player who isn't there to guess it.
export function revealDone(state, skipIds = []) {
  const players = state.gameSession.players;
  let nextIndex = state.assignmentIndex + 1;
  while (nextIndex < players.length && skipIds.includes(players[nextIndex].id)) nextIndex++;
  if (nextIndex >= players.length) {
    return { patch: { currentPlayerIndex: firstActiveIndex(players, skipIds) }, next: 'game' };
  }
  return { patch: { assignmentIndex: nextIndex }, next: 'assignment' };
}

// The player being assigned a character has left mid-assignment. Jump to the
// next one who is still here — or straight into the game if there is none.
export function skipDepartedAssignment(state, departedIds) {
  const players = state.gameSession.players;
  const current = players[state.assignmentIndex];
  if (!current || !departedIds.includes(current.id)) return { patch: {}, next: null };

  let idx = state.assignmentIndex;
  while (idx < players.length && departedIds.includes(players[idx].id)) idx++;
  if (idx >= players.length) {
    return { patch: { currentPlayerIndex: firstActiveIndex(players, departedIds) }, next: 'game' };
  }
  return { patch: { assignmentIndex: idx }, next: 'assignment' };
}

// The player whose turn it is has left. Only their own device can ask or guess,
// so the turn has to move on without them; their log and turn count are left
// exactly as they were in case they come back.
export function skipDepartedTurn(state, departedIds) {
  const players = state.gameSession.players;
  const current = players[state.currentPlayerIndex];
  if (!current || !departedIds.includes(current.id)) return { patch: {} };

  const next = getNextPlayerIndex(players, state.currentPlayerIndex, state.lockedPositions, departedIds);
  if (next === -1 || next === state.currentPlayerIndex) return { patch: {} };
  // Anything they left hanging can never be answered to them now.
  return { patch: { currentPlayerIndex: next, turnState: { pendingAction: null } } };
}

// Called when the current player asks a question / a timer expires (turn
// passes without a guess).
export function turnComplete(state, logEntry, skipIds = []) {
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
  const currentPlayerIndex = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, state.lockedPositions, skipIds);
  const patch = { questionLogs, turnCounts };
  // -1 means everyone else has left; keep the turn where it is rather than
  // writing a nonsense index.
  if (currentPlayerIndex !== -1) patch.currentPlayerIndex = currentPlayerIndex;
  return { patch };
}

// Called when the current player guesses correctly.
export function correctGuess(state, logEntry, skipIds = []) {
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
  const next = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, lockedPositions, skipIds);
  const patch = { questionLogs, turnCounts, lockedPositions };
  if (next !== -1) patch.currentPlayerIndex = next;

  return { patch, lastLocked, next: 'correctGuess' };
}

// Called when the current player guesses wrong — just advance the turn.
export function wrongGuess(state, logEntry, skipIds = []) {
  const player = state.gameSession.players[state.currentPlayerIndex];
  const questionLogs = {
    ...state.questionLogs,
    [player.id]: [logEntry, ...(state.questionLogs[player.id] || [])],
  };
  const turnCounts = {
    ...state.turnCounts,
    [player.id]: (state.turnCounts[player.id] || 0) + 1,
  };
  const next = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, state.lockedPositions, skipIds);
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
export function newRound(state, skipIds = []) {
  const start = firstActiveIndex(state.gameSession.players, skipIds);
  return {
    patch: {
      assignmentIndex: start,
      assignments: [],
      currentPlayerIndex: start,
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
