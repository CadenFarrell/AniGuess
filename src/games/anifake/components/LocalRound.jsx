import { useMemo, useState } from 'react';
import SecretReveal from './SecretReveal';
import ClueRound from './ClueRound';
import VoteScreen from './VoteScreen';
import StealScreen from './StealScreen';
import { useAniFakeRound } from '../hooks/useAniFakeRound';
import { MAX_DEALS } from '../rules';
import { eligibleCharacters } from '../utils/pool';
import { Backdrop, Button, Card, Screen, Wordmark } from '../../../shared/ui';

// One local round, start to steal. Owns the hot-seat rotation — the two indices
// below are the only state that exists in local play and has no online twin,
// because online every player already has a device of their own.
//
// The phase is DERIVED from the round rather than stored: every transition is
// already a fact about the round state (the lap ran out, everyone voted, the
// steal landed), so storing it would mean two sources of truth kept in step by
// effects. What is genuinely device state is anything about the HAND-OFF, which
// the round knows nothing about: the two indices (how far the device has been
// passed) and `announcing` (whether the table has acknowledged a re-deal).
export default function LocalRound({ players, pool, settings, onFinish, onQuit }) {
  const round = useAniFakeRound(players, pool, settings);
  const [revealIndex, setRevealIndex] = useState(0);
  const [voterIndex, setVoterIndex] = useState(0);
  // Whether anyone on this pass through the roster asked for a fresh card. One
  // shared flag, never a name and never a count — see the note above
  // rules.respondToCheck for why this may not be recorded per player.
  const [asked, setAsked] = useState(false);
  // Whether the table still has to acknowledge a re-deal that just happened.
  //
  // A third piece of device state in a file whose header says the phase is
  // DERIVED, so it needs its defence: there is nothing in `round` to read this
  // off. `revealIndex` is 0 and `dealNumber` is 2 both before the tap and after
  // it — the only thing that changed is that the table has seen the notice. That
  // is hand-off state, the same carve-out the two indices already get.
  const [announcing, setAnnouncing] = useState(false);

  // What the caught fake's search box offers. Deliberately NOT `pool`, which
  // may have been narrowed by "shared characters only" — this is the union over
  // everyone, so whatever the secret turned out to be is findable in it.
  const searchable = useMemo(
    () => eligibleCharacters(players, { sharedOnly: false }),
    [players]
  );

  // The one order every in-round screen renders, seat numbers and all. The
  // device is passed in seat order too, so the hot seat walks the same list the
  // table is looking at.
  const seated = round.seatedPlayers;

  const dealtOut = revealIndex >= seated.length;
  const canRedeal = round.needsCheck && round.canRedeal;

  // Every answer is collected before anything happens, and that ordering is the
  // anonymity: re-dealing the moment someone asks restarts the walk right after
  // their turn, which names them to everyone still waiting for the device.
  const handleReveal = (didAsk) => {
    const wants = asked || didAsk;
    const next = revealIndex + 1;
    if (next < seated.length) {
      setAsked(wants);
      setRevealIndex(next);
      return;
    }
    if (wants && canRedeal) {
      round.redeal();
      setAsked(false);
      setRevealIndex(0);
      // Announced rather than silent. Without this the walk simply starts over,
      // which is indistinguishable from the app having lost its place — the
      // players seated after the asker were just shown a character the table had
      // already thrown away, so being handed the device again reads as a bug.
      setAnnouncing(true);
      return;
    }
    setAsked(false);
    setRevealIndex(next);
  };

  // A tie is not the end of the vote anymore — it opens one runoff, and only a
  // second tie settles it. See rules.voteOutcome.
  const tied = round.everyoneVoted && round.outcome.needsRunoff;
  const votingDone = round.everyoneVoted && !round.outcome.needsRunoff;
  const over = votingDone && (!round.needsSteal || Boolean(round.state.steal));

  // The re-deal, announced before the walk starts over. Same shape and the same
  // justification as the tie interstitial below: an explicit tap, because the
  // pass is about to restart from the first player and should not do that under
  // whoever happened to act last.
  //
  // WHAT THIS MAY NOT SAY is the whole design of the phase (see
  // rules.respondToCheck): no name, no count, no "someone on this pass" that
  // could be narrowed. Two properties make it safe:
  //
  // - It fires at a FIXED point — after the last player hides — however early
  //   the ask happened. Its timing therefore carries nothing. An interstitial
  //   shown the moment somebody asked would name them outright, which is the bug
  //   the whole collect-every-answer-first ordering exists to avoid.
  // - It tells the last player nothing they were not about to learn: the walk
  //   restarting IS the announcement already. This only puts it in words.
  if (announcing) {
    const dealsLeft = Math.max(0, MAX_DEALS - round.dealNumber);
    return (
      <>
        <Backdrop />
        <Screen center>
          <Wordmark tone="teal" size="md" level={2} className="mb-8">🔁 New characters</Wordmark>
          <Card padding="lg" className="mb-8 text-center">
            <div className="text-5xl">🔁</div>
            <p className="mt-3 font-display text-2xl font-extrabold text-white">
              Someone drew a blank
            </p>
            <p className="mt-2 text-lg text-white/60">
              Everyone gets a fresh card, and nobody is told who asked. The old character is
              out of play — it is on your new card, and it is not the answer.
            </p>
            {dealsLeft > 0 && (
              <p className="mt-3 text-white/40">
                {dealsLeft === 1
                  ? 'This can happen once more.'
                  : `This can happen up to ${dealsLeft} more times.`}
              </p>
            )}
          </Card>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => setAnnouncing(false)}
          >
            🕵️ Pass to {seated[0].name}
          </Button>
        </Screen>
      </>
    );
  }

  if (!dealtOut) {
    // `seated`, not `players`: the comment above says the device is passed in
    // seat order, and every other screen renders that order. Walking the raw
    // roster here made that quietly false, and a walk that can now restart puts
    // the mismatch on screen twice a round.
    const player = seated[revealIndex];
    return (
      <SecretReveal
        // NOT redundant, however much it looks it. Without a key this is one
        // instance reused for the whole walk, so its `showing` flag survives
        // every hand-off and stays false only because both of its buttons happen
        // to reset it. Worse, both branches of that flag put a primary Button at
        // the same child index, so React reuses the identical FOCUSED <button>
        // DOM node across the flip — a bounced tap, a held Enter, or a touch
        // begun before the commit then fires "show me" for the NEXT player and
        // puts their card on screen with no pass gate. Keying per person and per
        // deal remounts instead, which makes that unrepresentable rather than
        // merely unlikely. Deleting this key re-opens a card leak.
        key={`${round.dealNumber}:${player.id}`}
        player={player}
        card={round.secrets[player.id]}
        isLast={revealIndex === seated.length - 1}
        canRedeal={canRedeal}
        dealNumber={round.dealNumber}
        maxDeals={MAX_DEALS}
        onNext={handleReveal}
      />
    );
  }

  // The tie, announced before it is resolved. An explicit tap for the same
  // reason the reveal has one: the ballot is about to start over from the first
  // player, and it should not do that under whoever happened to vote last.
  if (tied) {
    const names = round.outcome.candidates
      .map((id) => seated.find((p) => p.id === id)?.name ?? id)
      .join(' and ');
    return (
      <>
        <Backdrop />
        <Screen center>
          <Wordmark tone="teal" size="md" level={2} className="mb-8">⚖️ It&apos;s a tie</Wordmark>
          <Card padding="lg" className="mb-8 text-center">
            <div className="text-5xl">⚖️</div>
            <p className="mt-3 font-display text-2xl font-extrabold text-white">{names}</p>
            <p className="mt-2 text-lg text-white/60">
              Sudden death. Everyone votes again on just those names — and if it
              ties again, nobody is accused and the fake walks.
            </p>
          </Card>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => { round.openRunoff(); setVoterIndex(0); }}
          >
            ⚖️ Start the runoff
          </Button>
        </Screen>
      </>
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
        options={searchable}
        onSteal={round.submitSteal}
      />
    );
  }

  if (round.cluesDone) {
    const voter = seated[voterIndex];
    return (
      <VoteScreen
        players={seated}
        voter={voter}
        // Whichever ballot is open — in a runoff this is the runoff's votes, so
        // the ticks beside the seat numbers track the ballot in front of you.
        voted={Object.keys(round.ballot.votes)}
        voterIds={round.voterIds}
        isRunoff={round.ballot.isRunoff}
        runoffCandidates={round.ballot.isRunoff ? round.ballot.candidates : []}
        clues={round.state.clues}
        local
        onVote={(targetId) => {
          round.castVote(voter.id, targetId);
          if (voterIndex < seated.length - 1) setVoterIndex(voterIndex + 1);
        }}
      />
    );
  }

  return (
    <ClueRound
      clues={round.state.clues}
      players={seated}
      speaker={round.speaker}
      isMyTurn={Boolean(round.speaker)}
      wordLimit={settings.wordLimit ?? 1}
      lap={round.lap}
      laps={settings.laps ?? 1}
      local
      talkMode={Boolean(settings.talkMode)}
      turn={round.state.turn}
      total={round.totalTurns}
      onSubmit={round.submitClue}
      onPass={round.passTurn}
      onQuit={onQuit}
    />
  );
}
