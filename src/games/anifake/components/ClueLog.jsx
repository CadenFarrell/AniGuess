import { cluesByLap } from '../rules';

// The clue log, grouped by round. Used by both ClueRound and VoteScreen so the
// two can't drift — they rendered byte-identical chip markup from separate
// copies before this, and the vote screen's copy is the one people actually
// read when deciding who to accuse.
//
// The caller owns the Card around it: the two screens title it differently
// ("Clues (7)" vs "What was said") and one of them hides it entirely when empty.
export default function ClueLog({ clues = [], players = [] }) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? id;
  const rounds = cluesByLap(clues);

  // A round header only earns its place once there are two rounds to tell
  // apart. At one round — which is every round of a one-round game, and the
  // whole of round one in any game — it is a label on the only thing in the box.
  const labelled = rounds.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {rounds.map(({ lap, clues: said }) => (
        <div key={lap}>
          {labelled && (
            <p className="mb-2 font-display text-xs uppercase tracking-wider text-white/30">
              Round {lap + 1}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {said.map((clue, i) => (
              <span
                key={`${lap}-${clue.by}-${i}`}
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
        </div>
      ))}
    </div>
  );
}
