// Converts between the local game-flow state shape (assignments as an array)
// and the Firebase Realtime Database room shape (assignments as a map keyed
// by playerId — required so security rules can scope reads/writes to
// `assignments/{playerId}` as a path segment; see database.rules.json).

export function toRoomSession(localState) {
  const assignments = {};
  for (const a of localState.assignments) {
    assignments[a.playerId] = { character: a.character };
  }
  return { ...localState, assignments };
}

export function fromRoomSession(roomShape) {
  const assignments = Object.entries(roomShape.assignments || {}).map(([playerId, v]) => ({
    playerId,
    character: v.character,
  }));
  return { ...roomShape, assignments };
}
