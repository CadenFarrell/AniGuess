import { useEffect, useState } from 'react';
import { useWavelengthRound } from '../hooks/useWavelengthRound';
import PassScreen from './PassScreen';
import PsychicView from './PsychicView';
import GuessView from './GuessView';
import RevealScreen from './RevealScreen';

// One whole local session: every round, the hand-offs between them, and the
// scores that accumulate across them.
//
// ONE `readyFor` COVERS BOTH GATES. The screen a player sees is decided by the
// round's own phase; whether they have physically taken the device is a separate
// question, and it is the same question for the psychic and for each guesser in
// turn. Holding one player id — "who has tapped ready" — answers it for both,
// and makes the reset trivial: the moment the hot seat moves to somebody else,
// `readyFor` no longer matches and the pass screen comes back on its own. Two
// booleans would need clearing at four different points, and the failure mode is
// the worst one this game has: a screen showing the target to the wrong person.
export default function LocalSession({
  players, rounds, mode, cardPool, sharedOnly, onFinish, onQuit,
}) {
  const round = useWavelengthRound(players, { rounds, mode, cardPool, sharedOnly });
  const {
    state, spectrum, card, target, hand, searchCards, psychic, hotSeatId, pending,
    everyoneGuessed, excludeSpectrumId, roundNumber, totalRounds, isFinalRound, explain,
    roundScores, totalScores, submitClue, placeDial, reveal, nextRound,
  } = round;

  const [readyFor, setReadyFor] = useState(null);
  // The hot seat's dial before they commit it. Kept out of round state
  // deliberately: writing every drag through placeDial would mark them as having
  // dialled the instant they touched the bar, which ends their own turn and
  // hands the device on mid-thought.
  const [draft, setDraft] = useState(null);

  // The reveal fires from the round's own readiness gate rather than from the
  // last guesser's button, so the two can never disagree about whether the round
  // is over. revealTarget no-ops outside the guess phase, which makes the double
  // fire this effect can produce harmless.
  useEffect(() => {
    if (state.phase === 'guess' && everyoneGuessed) reveal();
  }, [state.phase, everyoneGuessed, reveal]);

  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? id;

  if (state.phase === 'clue') {
    if (readyFor !== state.psychicId) {
      return (
        <PassScreen
          name={nameOf(state.psychicId)}
          note={state.mode === 'readroom'
            ? "You're the psychic — everyone else, look away while you answer."
            : "You're the psychic this round — everyone else, look away."}
          cta={state.mode === 'readroom' ? 'Show me the card' : 'Show me the target'}
          onReady={() => setReadyFor(state.psychicId)}
        />
      );
    }
    return (
      <PsychicView
        mode={state.mode}
        target={target}
        hand={hand}
        cards={searchCards}
        cardPool={cardPool}
        excludeId={excludeSpectrumId}
        roundNumber={roundNumber}
        totalRounds={totalRounds}
        onSubmit={(payload) => { submitClue(payload); setReadyFor(null); }}
      />
    );
  }

  if (state.phase === 'guess') {
    // everyoneGuessed is true for one render before the effect above lands.
    // Without this the screen flashes a pass card naming nobody.
    if (!hotSeatId) return null;

    // What the next person is about to be asked. Nothing secret may appear on a
    // pass screen — everyone can see it — which in card modes means the card
    // itself waits for the guess screen, and this only names the question.
    const note = state.mode === 'readroom'
      ? `Where would ${nameOf(state.psychicId)} put it? Answer without letting anyone see.`
      : state.mode === 'cards'
        ? 'Place your dial on their card without letting anyone see it.'
        : `“${state.clue}” — place your dial without letting anyone see it.`;

    if (readyFor !== hotSeatId) {
      return (
        <PassScreen
          name={nameOf(hotSeatId)}
          note={note}
          cta="I've got it"
          onReady={() => { setReadyFor(hotSeatId); setDraft(null); }}
        />
      );
    }
    return (
      <GuessView
        spectrum={spectrum}
        mode={state.mode}
        clue={state.clue}
        card={card}
        psychicName={psychic?.name}
        who={nameOf(hotSeatId)}
        value={draft}
        waitingFor={pending.length > 1 ? `${pending.length - 1} still to guess` : 'last guess'}
        onChange={setDraft}
        onLock={() => {
          placeDial(hotSeatId, draft);
          setReadyFor(null);
          setDraft(null);
        }}
      />
    );
  }

  return (
    <RevealScreen
      spectrum={spectrum}
      mode={state.mode}
      card={card}
      target={target}
      explain={explain}
      players={players}
      psychic={psychic}
      roundScores={roundScores}
      abandoned={state.abandoned}
      isFinalRound={isFinalRound}
      onNext={() => { nextRound(); setReadyFor(null); setDraft(null); }}
      // Totals are banked by the hook's own effect the moment a round reveals,
      // so by the time this button exists they already include this round.
      onResults={() => onFinish(totalScores)}
      onQuit={onQuit}
    />
  );
}
