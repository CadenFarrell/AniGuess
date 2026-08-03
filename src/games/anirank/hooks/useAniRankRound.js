import { useCallback, useMemo, useState } from 'react';
import * as rules from '../rules';
import { getAxis, isOpinion } from '../axes';

// Local (single-device) persistence for one AniRank round. Mirrors
// src/games/anitune/hooks/useAniTuneRound.js: all the actual game logic lives in
// the pure module, this only decides where the state is kept.
//
// The hot-seat rotation is the one thing that exists only here — online, every
// device places at once. Both flows sit on the same shared cursor, so nobody
// ever sees a card the rest of the table has not reached.
export function useAniRankRound(players, deck, { axisId, subjectId, scoring = true } = {}) {
  const axis = getAxis(axisId);
  const opinion = isOpinion(axis);
  const [state, setState] = useState(() => rules.startRound(players, deck, opinion ? subjectId : null));

  const playerIds = useMemo(() => players.map((p) => p.id), [players]);
  const pending = rules.pendingPlacers(state, playerIds);
  const currentPlacer = players.find((p) => p.id === pending[0]) ?? null;

  const place = useCallback((slotIndex) => {
    setState((s) => {
      const who = rules.pendingPlacers(s, playerIds)[0];
      if (!who) return s;
      const placed = { ...s, ...rules.placeItem(s, who, slotIndex).patch };
      // The device passes on until everyone has committed this show; only then
      // is the next one revealed.
      if (!rules.everyonePlaced(placed, playerIds)) return placed;
      return { ...placed, ...rules.advanceCursor(placed).patch };
    });
  }, [playerIds]);

  return {
    state,
    deck: state.deck,
    cursor: state.cursor,
    item: rules.currentItem(state),
    board: currentPlacer ? rules.normalizeBoard(state.boards[currentPlacer.id], deck.length) : [],
    currentPlacer,
    axis,
    // How many of the table are still to place this card — the "3 of 4" line.
    placedThisItem: playerIds.length - pending.length,
    finished: state.cursor >= deck.length,
    scores: useMemo(
      () => rules.finalScores(state, playerIds, { opinion, scoring }),
      [state, playerIds, opinion, scoring]
    ),
    place,
  };
}
