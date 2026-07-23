import { getPositionEmoji } from '../../../shared/utils/ranking';
import { Button, Screen, Wordmark } from '../../../shared/ui';

const ORDINALS = { 1: '1st', 2: '2nd', 3: '3rd' };

export default function CorrectGuessScreen({ lastLocked, lockedPositions, onContinue }) {
  const tied = lockedPositions.filter(
    (lp) => lp.turnsUsed === lastLocked.turnsUsed && lp.playerId !== lastLocked.playerId
  ).length > 0;

  const place = ORDINALS[lastLocked.position] ?? `#${lastLocked.position}`;

  return (
    <Screen center width="md" className="text-center">
      <div className="mb-6 text-8xl">🎉</div>
      <h2 className="mb-6 font-display text-5xl font-extrabold text-white">
        {lastLocked.name} got it!
      </h2>

      <Wordmark tone="amber" size="md" level={2} tilt={2} className="mb-6">
        {lastLocked.position <= 3 && `${getPositionEmoji(lastLocked.position)} `}{place}
      </Wordmark>

      <p className="mb-2 text-2xl text-white/60">in {lastLocked.turnsUsed} turns</p>
      {tied && <p className="mb-2 font-display text-xl font-extrabold text-pop-amber">🤝 Tied!</p>}
      <p className="mb-10 font-display text-3xl font-extrabold text-pop-lime">
        +{lastLocked.points} points
      </p>

      <Button variant="primary" size="xl" fullWidth onClick={onContinue}>
        Continue Game →
      </Button>
    </Screen>
  );
}
