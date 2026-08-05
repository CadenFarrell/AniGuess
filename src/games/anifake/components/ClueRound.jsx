import { useState } from 'react';
import SecretCard from './SecretCard';
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
  onSubmit,
  onQuit,
  error,
}) {
  const [text, setText] = useState('');
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? id;

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

        <Card title={`Clues (${clues.length})`} padding="lg" className="mb-6">
          {clues.length === 0 && (
            <p className="text-white/40">Nothing said yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {clues.map((clue, i) => (
              <span
                key={`${clue.by}-${i}`}
                className="rounded-pop-sm border-2 border-white/15 bg-surface-2 px-3 py-2"
              >
                <span className="font-display text-xs uppercase tracking-wider text-white/40">
                  {nameOf(clue.by)}
                </span>
                <span className="ml-2 font-display text-lg font-extrabold text-white">
                  {clue.text}
                </span>
              </span>
            ))}
          </div>
        </Card>

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        {isMyTurn ? (
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
