import LastOutcomeBanner from './LastOutcomeBanner';
import QuestionLog from './QuestionLog';
import WhoIsWhoPanel from './WhoIsWhoPanel';
import { Avatar, Button, Card, Screen } from '../../../shared/ui';

// Shown on every device during 'game' phase except the current guesser's.
// Resolves pending questions via a button click (guesses are auto-resolved
// by OnlineGame, since there's nothing for a human to decide).
//
// Carries the context a remote answerer can't get by looking across the table:
// the guesser's assigned character (safe here — database.rules.json denies only
// the guesser's own device that read) and everything already asked this round.
export default function OnlineAnswererView({
  guesser, guesserCharacter, whoIsWho = [], questionLog = [], turnCount = 0,
  pendingAction, lastOutcome, onAnswer, resolving,
}) {
  const live = pendingAction && !pendingAction.resolved;

  return (
    <Screen width="md">
      <LastOutcomeBanner outcome={lastOutcome} />

      <div className="mb-6 text-center">
        <h2 className="font-display text-3xl font-extrabold text-white">
          {guesser?.name}&apos;s Turn
        </h2>
        <p className="mt-1 text-base text-white/50">
          Turn {turnCount + 1} · You answer, they guess
        </p>
      </div>

      {/* The character they're trying to work out — their own device never
          receives this. */}
      <Card padding="sm" className="mb-6 flex items-center gap-4">
        {guesserCharacter ? (
          <>
            <Avatar src={guesserCharacter.imageUrl} size="md" />
            <div className="min-w-0">
              <p className="font-display text-xs uppercase tracking-widest text-white/40">
                {guesser?.name} is
              </p>
              <p className="truncate font-display text-xl font-extrabold text-white">
                {guesserCharacter.name}
              </p>
              <p className="truncate text-sm text-white/50">{guesserCharacter.series}</p>
            </div>
          </>
        ) : (
          <p className="text-base text-white/40">Loading their character…</p>
        )}
      </Card>

      {/* The pinned card above covers the player being answered right now; this
          is for the ones whose turn will come back around. */}
      <WhoIsWhoPanel entries={whoIsWho} className="mb-6" />

      {!live && (
        <div className="py-8 text-center">
          <div className="mb-3 text-6xl">⏳</div>
          <p className="text-lg text-white/50">Waiting for a question or guess…</p>
        </div>
      )}

      {live && pendingAction.kind === 'question' && (
        <div className="mb-8 text-center">
          <p className="mb-6 font-display text-xl font-extrabold text-white">
            ❓ {pendingAction.text}
          </p>
          <div className="flex gap-4">
            <Button
              variant="success"
              size="xl"
              className="flex-1"
              onClick={() => onAnswer('Yes')}
              disabled={resolving}
            >
              ✅ Yes
            </Button>
            <Button
              variant="danger"
              size="xl"
              className="flex-1"
              onClick={() => onAnswer('No')}
              disabled={resolving}
            >
              ❌ No
            </Button>
          </div>
          <p className="mt-3 text-sm text-white/30">
            Any player can answer — first one through wins.
          </p>
        </div>
      )}

      {live && pendingAction.kind === 'guess' && (
        <p className="mb-8 text-center text-lg text-white/60">
          🎯 Checking guess: &quot;{pendingAction.text}&quot;…
        </p>
      )}

      <QuestionLog title={`${guesser?.name}'s Question Log`} entries={questionLog} />
    </Screen>
  );
}
