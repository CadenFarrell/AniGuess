import { useState } from 'react';
import ClueLog from './ClueLog';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Screen, Wordmark,
} from '../../../shared/ui';

// The vote. Everyone picks one other player; a tie means nobody is accused.
//
// Only WHO has voted is ever shown, never who they voted for — a running tally
// would let the last voter pick the winning side, which is exactly why
// rules.castVote makes a vote final once cast.
export default function VoteScreen({
  players = [],
  voter, // the player casting now: whoever holds the device locally, you online
  voted = [], // ids that have already voted — for the waiting list, no targets
  departedIds = [],
  clues = [],
  local = false,
  myVote = null,
  onVote,
  error,
}) {
  const [handedOver, setHandedOver] = useState(!local);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? id;

  // Local play passes the device around, so the ballot has to be claimed the
  // same way the card was.
  if (local && !handedOver) {
    return (
      <>
        <Backdrop />
        <Screen center>
          <Wordmark tone="teal" size="md" level={2} className="mb-8">🗳️ Pass the device</Wordmark>
          <p className="mb-2 text-center text-xl text-white/60">Hand it to</p>
          <p className="mb-10 text-center font-display text-4xl font-extrabold text-white">
            {voter?.name}
          </p>
          <Button variant="primary" size="xl" fullWidth onClick={() => setHandedOver(true)}>
            🗳️ I&apos;m {voter?.name} — let me vote
          </Button>
        </Screen>
      </>
    );
  }

  const cast = (id) => {
    onVote(id);
    if (local) setHandedOver(false); // hide the ballot again before it moves on
  };

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="teal" size="sm" level={2} className="mb-6">🗳️ Who is the fake?</Wordmark>

        {/* Empty in a talk-it-out round, where the clues were spoken and never
            recorded. Dropped rather than shown blank: the table is voting from
            memory, and an empty "what was said" card suggests the game lost it.
            This is the hides-it-entirely caller ClueLog's header refers to. */}
        {clues.length > 0 && (
          <Card title="What was said" padding="lg" className="mb-6">
            <ClueLog clues={clues} players={players} />
          </Card>
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        {myVote ? (
          <Card padding="lg" className="mb-6 text-center">
            <div className="text-4xl">🗳️</div>
            <p className="mt-2 font-display text-lg font-extrabold text-white">
              You voted for {nameOf(myVote)}
            </p>
            <p className="mt-1 text-white/50">Waiting for everyone else…</p>
          </Card>
        ) : (
          <Card title={`${voter?.name ?? 'You'} — pick one`} padding="lg" className="mb-6">
            {players
              .filter((p) => p.id !== voter?.id)
              .map((p) => {
                // Someone who left is still on the ballot — walking out is
                // exactly what a rumbled fake would do, so the table should be
                // able to accuse them. They just have to be told, or the row
                // reads as a player who is merely slow to vote.
                const gone = departedIds.includes(p.id);
                return (
                  <CardRow key={p.id} className={gone ? 'opacity-50' : ''}>
                    <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                      {p.name}
                    </span>
                    {gone ? <Badge tone="red">Left</Badge>
                      : voted.includes(p.id) && <Badge tone="lime">Voted</Badge>}
                    <Button variant="danger" size="sm" onClick={() => cast(p.id)}>
                      Accuse
                    </Button>
                  </CardRow>
                );
              })}
          </Card>
        )}

        {!local && (
          <p className="text-center text-white/50">
            {voted.length} of {players.length} in.
          </p>
        )}
      </Screen>
    </>
  );
}
