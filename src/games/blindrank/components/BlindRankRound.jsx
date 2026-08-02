import { useEffect } from 'react';
import { useBlindRankRound } from '../hooks/useBlindRankRound';
import RankBoard, { CurrentShow, PlacerBanner } from './RankBoard';
import { Backdrop, GhostButton, HubButton, Screen } from '../../../shared/ui';

// Local round orchestration: hands the pure round hook to the board, and calls
// onFinish once the last show is placed.
export default function BlindRankRound({ players, deck, onFinish, onQuit }) {
  const round = useBlindRankRound(players, deck);
  const { finished, state, scores } = round;

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

        <CurrentShow item={round.item} index={round.cursor} total={deck.length} />

        <p className="mb-4 text-center text-base text-white/50">
          {players.length > 1
            ? 'Pass the device round — everyone places this show before the next is revealed.'
            : 'Pick a slot. Once it is placed it cannot be moved.'}
        </p>

        <RankBoard board={round.board} item={round.item} onPlace={round.place} />

        <div className="text-center">
          <GhostButton onClick={onQuit}>← Quit round</GhostButton>
        </div>
      </Screen>
    </>
  );
}
