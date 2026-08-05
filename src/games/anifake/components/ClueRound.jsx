import { useState } from 'react';
import SecretCard from './SecretCard';
import ClueLog from './ClueLog';
import { countWords } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, GhostButton, Input, Screen, Wordmark,
} from '../../../shared/ui';

// The clue lap, both locally and online. One screen for both because the only
// difference is who is allowed to type: locally the device passes and whoever
// is holding it types, online the input appears on one player's device and
// everyone else watches the log fill in.
//
// Turn order is the game. Going later means more clues to work from — and a
// blind fake who spoke first would have nothing at all to go on — so this is
// deliberately NOT AniRank's everyone-commits-at-once cursor.
export default function ClueRound({
  clues = [],
  players = [],
  speaker,
  isMyTurn,
  card = null, // online only: your own card, inline, since the device is private
  wordLimit = 1,
  lap = 0,
  laps = 1,
  local = false,
  // Local "talk it out": the clue is said out loud and never recorded. Defaults
  // off, so the online path through this same component is untouched.
  talkMode = false,
  turn = 0,
  total = 0,
  onSubmit,
  onPass,
  onQuit,
  error,
}) {
  const [text, setText] = useState('');

  const words = countWords(text);
  const overLimit = words > wordLimit;
  const canSend = words > 0 && !overLimit;

  const send = () => {
    if (!canSend) return;
    onSubmit(text);
    setText('');
  };

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Wordmark tone="teal" size="sm" level={2}>🕵️ Clues</Wordmark>
          {/* Hidden at one round, where "Clue round 1 of 1" is noise. */}
          {laps > 1 && <Badge tone="neutral">Clue round {lap + 1} of {laps}</Badge>}
        </div>

        {card && (
          <div className="mb-5">
            <SecretCard card={card} compact />
          </div>
        )}

        <p className="mb-6 text-center text-white/50">
          One {wordLimit === 1 ? 'word' : `to ${wordLimit} words`} about the secret character.
          Say too little and nobody believes you; say too much and the fake learns it too.
        </p>

        {/* Nothing is recorded in talk mode, so the log is dropped rather than
            left standing empty — a permanently blank card reads as a bug. What
            replaces it is the only progress signal left: how far round the
            table the turn has got. */}
        {talkMode ? (
          <p className="mb-6 text-center font-display text-lg font-extrabold text-white/40">
            Clue {Math.min(turn + 1, total)} of {total}
          </p>
        ) : (
          <Card title={`Clues (${clues.length})`} padding="lg" className="mb-6">
            {clues.length === 0 && (
              <p className="text-white/40">Nothing said yet.</p>
            )}
            <ClueLog clues={clues} players={players} />
          </Card>
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        {isMyTurn && talkMode ? (
          <Card padding="lg" className="border-pop-teal text-center">
            <div className="text-5xl">🗣️</div>
            <p className="mt-3 font-display text-2xl font-extrabold text-white">
              {speaker?.name ?? ''}, say your {wordLimit === 1 ? 'word' : 'clue'} out loud
            </p>
            <p className="mt-2 text-white/50">
              Everyone heard it — tap when you&apos;re done and the turn moves on.
            </p>
            <Button
              variant="success"
              size="xl"
              fullWidth
              className="mt-6"
              onClick={onPass}
            >
              ✅ Said it
            </Button>
          </Card>
        ) : isMyTurn ? (
          <Card padding="lg" className="border-pop-teal">
            <p className="mb-3 font-display text-lg font-extrabold text-white">
              {local ? `${speaker?.name ?? ''}, your clue` : 'Your clue'}
            </p>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder={wordLimit === 1 ? 'One word…' : `Up to ${wordLimit} words…`}
              maxLength={24}
              autoFocus
              aria-label="Your clue"
            />
            {overLimit && (
              <p className="mt-2 text-base text-pop-red">
                {wordLimit === 1 ? 'One word only.' : `${wordLimit} words at most.`} That&apos;s {words}.
              </p>
            )}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-4"
              onClick={send}
              disabled={!canSend}
            >
              📣 Say it
            </Button>
          </Card>
        ) : (
          <Card padding="lg" className="text-center">
            <p className="font-display text-lg font-extrabold text-white">
              Waiting for {speaker?.name ?? 'the next player'}…
            </p>
            <p className="mt-1 text-white/50">Their device has the input.</p>
          </Card>
        )}

        <div className="mt-6 text-center">
          <GhostButton onClick={onQuit}>← Leave the round</GhostButton>
        </div>
      </Screen>
    </>
  );
}
