import { useState } from 'react';
import ClueLog from './ClueLog';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Screen, Wordmark,
} from '../../../shared/ui';

// The vote. Everyone picks one other player; a tie opens one sudden-death
// runoff between the tied names, and a second tie lets the fake walk.
//
// Only WHO has voted is ever shown, never who they voted for — a running tally
// would let the last voter pick the winning side, which is exactly why
// rules.castVote makes a vote final once cast. That holds for the runoff too.
//
// That marker sits in the SEAT column, as a grey tick, and the right-hand edge
// of a row is action-only. It used to be a lime "Voted" pill immediately left of
// the red Accuse button, and being in the accusation column is what made it read
// as "someone has voted FOR Ada" — the one thing this screen must never show.
// Lime beside red compounded it: the pair read as [yes] [no] on a single
// question. A status pill next to a decision button is a verdict; put anything
// about a player's own progress on the other side of the name.
//
// EVERY player is listed, including you. Filtering the voter out of their own
// ballot shifted every row beneath them, so in pass-the-device play the same
// name sat at a different position on each hand-off — most of why this screen
// was hard to follow. Your row stays put and simply has no button. `players` is
// the seated roster (rules.seating), so the seat numbers match the clue log's.
export default function VoteScreen({
  players = [],
  voter, // the player casting now: whoever holds the device locally, you online
  voted = [], // ids that have already voted — for the waiting list, no targets
  voterIds = [], // who the ballot is waiting on: the ACTIVE players, not the roster
  departedIds = [],
  clues = [],
  local = false,
  myVote = null,
  isRunoff = false,
  runoffCandidates = [],
  onVote,
  error,
}) {
  const [handedOver, setHandedOver] = useState(!local);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? id;

  // Who may be accused on the ballot that is open: everyone on the opening
  // vote, only the tied names in a runoff — where everyone still votes.
  const accusable = (id) => !isRunoff || runoffCandidates.includes(id);

  // Local play passes the device around, so the ballot has to be claimed the
  // same way the card was.
  if (local && !handedOver) {
    return (
      <>
        <Backdrop />
        <Screen center>
          <Wordmark tone="teal" size="md" level={2} className="mb-8">
            {isRunoff ? '⚖️ Pass the device' : '🗳️ Pass the device'}
          </Wordmark>
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
        <Wordmark tone="teal" size="sm" level={2} className="mb-6">
          {isRunoff ? '⚖️ Runoff' : '🗳️ Who is the fake?'}
        </Wordmark>

        {/* The terminator has to be said out loud, or a runoff that ends with
            nobody accused reads as a bug rather than as the rule. */}
        {isRunoff && (
          <Banner tone="warning" className="mb-6">
            ⚖️ It tied between{' '}
            <span className="font-extrabold">{runoffCandidates.map(nameOf).join(' and ')}</span>.
            Everyone votes again on just those names — and if it ties a second time,
            nobody is accused and the fake walks.
          </Banner>
        )}

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
            {players.map((p) => {
              const isMe = p.id === voter?.id;
              // Someone who left is still on the ballot — walking out is
              // exactly what a rumbled fake would do, so the table should be
              // able to accuse them. They just have to be told, or the row
              // reads as a player who is merely slow to vote.
              const gone = departedIds.includes(p.id);
              const dimmed = gone || !accusable(p.id);
              return (
                <CardRow key={p.id} className={dimmed ? 'opacity-40' : ''}>
                  {/* Fixed width, so the rows read as a table and a seat sits in
                      the same place on every screen of the round. */}
                  <span className="w-6 flex-shrink-0 text-center font-display text-sm
                    font-extrabold text-white/30">
                    {p.seat ?? '–'}
                  </span>
                  {/* Their own ballot, not a vote against them. The slot is
                      always rendered and only sometimes filled — dropping the
                      element when they haven't voted would shift every name
                      sideways as votes come in, which is the reflow the seat
                      column and the full-roster ballot both exist to stop.
                      Weighted like the seat number rather than tinted: a colour
                      here would be read as a verdict, which is how this started. */}
                  <span className="w-4 flex-shrink-0 text-center text-sm text-white/30">
                    {voted.includes(p.id) && (
                      <>
                        <span aria-hidden="true">✓</span>
                        <span className="sr-only">has voted</span>
                      </>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                    {p.name}
                  </span>
                  {/* Amber, not red: this flags a state, and red next to the red
                      Accuse button made the two blur into one control. They stay
                      accusable — walking out is what a rumbled fake would do. */}
                  {gone && <Badge tone="amber">Left</Badge>}
                  {/* Every row keeps its slot whether or not it has a button —
                      that is what stops the list reflowing between voters. */}
                  {isMe ? (
                    <Badge tone="purple">You</Badge>
                  ) : accusable(p.id) ? (
                    <Button variant="danger" size="sm" onClick={() => cast(p.id)}>
                      Accuse
                    </Button>
                  ) : (
                    <span className="font-display text-xs uppercase tracking-wider text-white/30">
                      Safe
                    </span>
                  )}
                </CardRow>
              );
            })}
            {/* A tick with no key is just a new small mystery, and the wording
                has to name whose ballot it is — "voted" alone is the ambiguity
                that moving the marker was meant to end. Only once one exists. */}
            {voted.length > 0 && (
              <p className="mt-3 text-sm text-white/40">
                <span aria-hidden="true">✓</span> their own ballot is already in — not a vote against them
              </p>
            )}
          </Card>
        )}

        {/* Counted against the players the ballot is genuinely waiting on. The
            full roster kept reading "3 of 4 in" after a departure had already
            let the room move on. */}
        {voterIds.length > 0 && (
          <p className="text-center text-white/50">
            {voted.filter((id) => voterIds.includes(id)).length} of {voterIds.length} in.
          </p>
        )}
      </Screen>
    </>
  );
}
