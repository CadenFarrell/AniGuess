import { useMemo } from 'react';
import { Backdrop, Banner, Screen } from '../../../shared/ui';
import { useCategoriesRound } from '../hooks/useCategoriesRound';
import { getCategory, suggestionsFor } from '../categories';
import { POOL_LABELS } from '../prefs';
import PickPhase from './PickPhase';
import TurnScreen from './TurnScreen';
import TurnEnd from './TurnEnd';
import RoundEnd from './RoundEnd';

/**
 * A whole local session on one device.
 *
 * HOW MUCH OF THE DEVICE HAS TO BE PASSED AROUND IS THE ONE REAL DIFFERENCE
 * BETWEEN THE MODES HERE, and chosen mode is the cheaper of the two.
 *
 * DEALT: no pass screens at all. The only hidden value is the hot seat's
 * clause, and everything else — the trail, the pending name, the count — is
 * meant to be on the table. So the device sits in the middle all turn and
 * CategoryPeek hides the one thing that has to be hidden behind a control the
 * hot seat is asked not to press. That is the same trust AniGuess's PeekPanel
 * and AniFake's blind mode already ask a table for, and it buys the game
 * roughly twenty fewer handovers per turn than the alternative.
 *
 * CHOSEN: one pass screen per player, once per round, and then none. A clause
 * has to be on screen exactly once — while its owner picks it — because from
 * then on every judge answers from memory. The device goes round the table at
 * the start of a round and then sits in the middle with nothing hidden on it,
 * which is why the picking phase is a handover sequence and the go is not.
 *
 * THE SEAT MOVING EVERY NAME COSTS THIS SCREEN NOTHING, which is worth saying
 * because it is not obvious. Nothing hidden is on the device between picks — the
 * trail, the pending name and the counts are all meant to be on the table — so
 * a go changing hands is somebody leaning over, not a handover. Dealt mode is
 * the same bargain it always was: CategoryPeek hides the one value that must be
 * hidden, and it now re-closes on every name rather than once a turn.
 *
 * ONE DEVICE ANSWERS FOR EVERYBODY, which is what `rulers` says: online that
 * prop is at most one player (me, when I owe an answer), and here it is
 * everyone who still owes one, so the screen grows a yes/no pair per person.
 * TurnScreen needs no other knowledge of where it is running.
 */
export default function LocalSession({
  players, rounds, proposalCap, categoryPool, categoryMode, customCategories, onFinish, onQuit,
}) {
  const round = useCategoriesRound(players, {
    rounds, proposalCap, categoryPool, categoryMode, customCategories,
  });
  const pool = POOL_LABELS[categoryPool] ?? POOL_LABELS.characters;
  const noun = pool.noun;
  const nameFor = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';

  const suggestions = useMemo(
    () => suggestionsFor(categoryPool, customCategories),
    [categoryPool, customCategories],
  );

  const body = () => {
    // CHOSEN MODE only ever reaches this phase; startRound opens a dealt round
    // straight onto a turn. Roster order rather than a stored index, for the
    // reason nextSeatId uses it: derived state cannot fall out of step with the
    // picks it is describing.
    if (round.phase === 'picking') {
      const picker = players.find((p) => !round.hasPicked(p.id)) ?? null;
      if (!picker) return null;
      return (
        <PickPhase
          playerName={picker.name}
          suggestions={suggestions}
          noun={noun}
          handover
          picked={players.filter((p) => round.hasPicked(p.id)).length}
          total={players.length}
          onPick={(spec) => round.pick(picker.id, spec)}
        />
      );
    }

    if (round.phase === 'roundEnd') {
      return (
        <RoundEnd
          explain={round.explain}
          players={players}
          roundNumber={round.roundNumber}
          totalRounds={round.totalRounds}
          isFinalRound={round.isFinalRound}
          chosen={round.chosen}
          canAdvance
          onNext={round.nextRound}
          onFinish={() => onFinish(round.totalScores)}
        />
      );
    }

    if (round.phase === 'turnEnd') {
      const seatId = round.state.seatId;
      const result = round.state.results?.[seatId] ?? null;
      const row = round.explain.find((r) => r.playerId === seatId);
      // CHOSEN: the clause on show is the TARGET's, not the seat's, and only
      // when the seat claimed them — rules.revealAllowed decides, and this just
      // reads whatever it let through.
      const targetRow = round.chosen && row?.targetId
        ? round.explain.find((r) => r.playerId === row.targetId)
        : null;
      const shown = round.chosen ? targetRow?.category : row?.category;
      return (
        <TurnEnd
          seatName={round.seat?.name ?? 'They'}
          chosen={round.chosen}
          targetName={row?.targetId ? nameFor(row.targetId) : null}
          order={round.order}
          trails={round.trails}
          seatId={seatId}
          usedFor={round.usedFor}
          // Resolved from the published spec, exactly as online does it, rather
          // than from the hook's own map — one source, one code path, and the
          // reveal gate applies identically in both.
          category={shown ? getCategory(shown) : null}
          result={result}
          points={row?.points ?? 0}
          cap={round.cap}
          nameFor={nameFor}
          canAdvance
          // Everyone still to come is anyone with no result yet.
          isLastSeat={players.every((p) => p.id === seatId || round.state.results?.[p.id])}
          onNext={round.nextTurn}
        />
      );
    }

    return (
      <TurnScreen
        seatName={round.seat?.name ?? 'They'}
        roundNumber={round.roundNumber}
        totalRounds={round.totalRounds}
        noun={noun}
        phase={round.phase}
        pending={round.pending}
        // Every trail and the whole rotation: the seat moves after each name, so
        // a screen holding only the current one would hide what each player has
        // spent the round collecting the moment they hand the go on.
        trails={round.trails}
        order={round.order}
        lastPlayed={round.lastPlayed}
        cap={round.cap}
        left={round.left}
        usedFor={round.usedFor}
        chosen={round.chosen}
        // DEALT: one device holds every slot, so it can both name and rule —
        // and the seat's clause goes behind a peek rather than being rendered
        // plainly. Null in chosen mode, where the seat holds nothing hidden.
        category={round.seatCategory}
        peek
        canName
        // Everyone who still owes an answer, because this device is all of them.
        rulers={round.pendingJudges}
        pendingJudges={round.pendingJudges}
        declarable={round.declarable}
        nameFor={nameFor}
        remindFor={round.categoryFor}
        onPropose={round.propose}
        onDeclare={round.declare}
        onRule={round.rule}
        onPass={round.pass}
      />
    );
  };

  return (
    <>
      <Backdrop />
      <Screen onBack={onQuit} backLabel="← Quit session">
        {!round.seat && (
          <Banner tone="warning" className="mb-6">
            ⚠️ Nobody left to take a turn.
          </Banner>
        )}
        {body()}
      </Screen>
    </>
  );
}
