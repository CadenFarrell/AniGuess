import { useState } from 'react';
import SecretReveal from './SecretReveal';
import ClueRound from './ClueRound';
import VoteScreen from './VoteScreen';
import StealScreen from './StealScreen';
import { useAniFakeRound } from '../hooks/useAniFakeRound';
import { Backdrop, Button, Card, Screen, Wordmark } from '../../../shared/ui';

// One local round, start to steal. Owns the hot-seat rotation — the two indices
// below are the only state that exists in local play and has no online twin,
// because online every player already has a device of their own.
//
// The phase is DERIVED from the round rather than stored: every transition is
// already a fact about the round state (the lap ran out, everyone voted, the
// steal landed), so storing it would mean two sources of truth kept in step by
// effects. The one thing that genuinely is device state — how far the device
// has been passed — is the two indices.
export default function LocalRound({ players, pool, settings, onFinish, onQuit }) {
  const round = useAniFakeRound(players, pool, settings);
  const [revealIndex, setRevealIndex] = useState(0);
  const [voterIndex, setVoterIndex] = useState(0);

  const dealtOut = revealIndex >= players.length;
  const votingDone = round.everyoneVoted;
  const over = votingDone && (!round.needsSteal || Boolean(round.state.steal));

  if (!dealtOut) {
    const player = players[revealIndex];
    return (
      <SecretReveal
        player={player}
        card={round.secrets[player.id]}
        isLast={revealIndex === players.length - 1}
        onNext={() => setRevealIndex(revealIndex + 1)}
      />
    );
  }

  // An explicit tap rather than an automatic jump: the table wants a beat
  // before the reveal, and one device showing everyone's fate should not do it
  // while somebody is still handing the phone back.
  if (over) {
    return (
      <>
        <Backdrop />
        <Screen center>
          <Wordmark tone="teal" size="md" level={2} className="mb-8">🃏 Votes are in</Wordmark>
          <Card padding="lg" className="mb-8 text-center">
            <div className="text-5xl">🕵️</div>
            <p className="mt-3 text-lg text-white/60">
              Everyone has voted. Gather round before you turn the cards over.
            </p>
          </Card>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => onFinish({
              state: round.state,
              fakeId: round.fakeId,
              secret: round.secret,
              fakeCard: round.fakeCard,
              scores: round.scores,
            })}
          >
            🎭 Reveal
          </Button>
        </Screen>
      </>
    );
  }

  if (votingDone && round.needsSteal) {
    return (
      <StealScreen
        isMine
        fakeName={players.find((p) => p.id === round.fakeId)?.name ?? ''}
        onSteal={round.submitSteal}
      />
    );
  }

  if (round.cluesDone) {
    const voter = players[voterIndex];
    return (
      <VoteScreen
        players={players}
        voter={voter}
        voted={Object.keys(round.state.votes ?? {})}
        clues={round.state.clues}
        local
        onVote={(targetId) => {
          round.castVote(voter.id, targetId);
          if (voterIndex < players.length - 1) setVoterIndex(voterIndex + 1);
        }}
      />
    );
  }

  return (
    <ClueRound
      clues={round.state.clues}
      players={players}
      speaker={round.speaker}
      isMyTurn={Boolean(round.speaker)}
      wordLimit={settings.wordLimit ?? 1}
      lap={round.lap}
      laps={settings.laps ?? 1}
      local
      onSubmit={round.submitClue}
      onQuit={onQuit}
    />
  );
}
