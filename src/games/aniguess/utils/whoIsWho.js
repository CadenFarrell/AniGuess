// Pairs each player with the character they were assigned, for the "who is who"
// recap panel. Pure and source-agnostic: local play holds the pairs in an
// in-memory `assignments` array while online play fetches them one at a time
// from Firebase, so the caller supplies a `characterFor` lookup rather than the
// characters themselves.
//
// Not to be confused with src/shared/utils/presence.js, which is about who is
// still *connected* to an online room. This is about who is playing as whom.
export function buildWhoIsWho({
  players = [],
  characterFor = () => null,
  lockedPositions = [],
  excludePlayerId = null,
} = {}) {
  return players
    .filter((p) => p.id !== excludePlayerId)
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      character: characterFor(p.id) ?? null,
      // A player who has already guessed correctly has a publicly known
      // character, so the local look-away gate is pointless for them.
      locked: lockedPositions.some((lp) => lp.playerId === p.id),
    }))
    // Anyone not assigned yet — or whose assignment belongs to a previous round
    // and so read back as null — simply isn't in the recap.
    .filter((e) => e.character);
}
