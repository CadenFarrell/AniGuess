export function getPositionEmoji(pos) {
  return ['🥇', '🥈', '🥉'][pos - 1] || `#${pos}`;
}

export function normalizeTitle(s) {
  return (s || '').trim().toLowerCase();
}

// Ranks players by total score (ties broken by name), then assigns positions
// that let tied players share the same position (e.g. two players tied for
// 2nd both get position 2, and the next player gets position 3, not 4).
export function computeRankedPlayers(players, totalScores) {
  const ranked = [...players]
    .map((p) => ({ ...p, total: totalScores[p.id] || 0 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const withPositions = [];
  for (let i = 0; i < ranked.length; i++) {
    const player = ranked[i];
    if (i === 0) {
      withPositions.push({ ...player, position: 1 });
    } else {
      const prev = ranked[i - 1];
      const prevPosition = withPositions[i - 1].position;
      withPositions.push({
        ...player,
        position: player.total === prev.total ? prevPosition : i + 1,
      });
    }
  }
  return withPositions;
}
