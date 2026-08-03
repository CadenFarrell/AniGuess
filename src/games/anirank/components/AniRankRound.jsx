import { useEffect } from 'react';
import { useAniRankRound } from '../hooks/useAniRankRound';
import RankBoard, { CurrentItem, PlacerBanner } from './RankBoard';
import { isOpinion, promptFor } from '../axes';
import { Backdrop, GhostButton, HubButton, Screen } from '../../../shared/ui';

// Local round orchestration: hands the pure round hook to the board, and calls
// onFinish once the last card is placed.
export default function AniRankRound({
  players, deck, axisId, subjectId, scoring, onFinish, onQuit,
}) {
  const round = useAniRankRound(players, deck, { axisId, subjectId, scoring });
  const { finished, state, scores, axis } = round;
  const subject = players.find((p) => p.id === subjectId) ?? null;

  // Reporting the result during render would set state on the parent mid-render;
  // an effect is the seam between "the round is over" and "show the results".
  useEffect(() => {
    if (finished) onFinish({ boards: state.boards, scores });
    // onFinish is a fresh closure each render — depending on it would re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (finished) return null;

  return (
    <>
      <HubButton onClick={onQuit} confirm="Quit this round? The board will be lost." />
      <Backdrop />
      <Screen width="md">
        <PlacerBanner
          name={round.currentPlacer?.name ?? ''}
          placed={round.placedThisItem}
          total={players.length}
        />

        <CurrentItem item={round.item} index={round.cursor} total={deck.length} />

        <p className="mb-2 text-center text-base font-bold text-white/70">
          {/* The subject ranks for real — they are the answer key, so telling
              them to guess at themselves would be nonsense. */}
          {isOpinion(axis) && round.currentPlacer?.id === subjectId
            ? `Your turn, ${subject?.name ?? ''} — rank these honestly. Everyone else is guessing at you.`
            : promptFor(axis, subject?.name ?? 'they')}
        </p>

        <p className="mb-4 text-center text-base text-white/50">
          {players.length > 1
            ? 'Pass the device round — everyone places this card before the next is revealed.'
            : 'Pick a slot. Once it is placed it cannot be moved.'}
        </p>

        <RankBoard
          board={round.board}
          item={round.item}
          lowLabel={axis.lowLabel}
          highLabel={axis.highLabel}
          onPlace={round.place}
        />

        <div className="text-center">
          <GhostButton onClick={onQuit}>← Quit round</GhostButton>
        </div>
      </Screen>
    </>
  );
}
