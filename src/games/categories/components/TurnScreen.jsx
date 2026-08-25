import { useState } from 'react';
import { Badge, Button, Card, GhostButton, Input } from '../../../shared/ui';
import { MAX_PROPOSAL_LEN, WRONG_DECLARATION_COST, verdictsOf } from '../rules';
import TrailBoard from './TrailBoard';
import SeatStrip from './SeatStrip';
import CategoryPeek from './CategoryPeek';

/**
 * One go, on whatever device is looking at it.
 *
 * ONE COMPONENT FOR LOCAL AND ONLINE AND FOR BOTH MODES, because the go
 * genuinely is the same go: somebody names one thing, somebody answers, the
 * trail is public, and a clause is hidden from somebody. What differs is only
 * which controls this particular device may use and which way the hiding runs,
 * so those arrive as props rather than as a second copy of the screen.
 *
 *   canName    this device is the hot seat
 *   rulers     the players this device answers FOR, in the order they will be
 *              asked. Online that is [me] when I owe an answer and [] otherwise;
 *              locally it is everyone who still owes one, because one device is
 *              all of them. ONE IS SHOWN AT A TIME — see the judging block.
 *   peek       a clause is on a device that its owner can see (local dealt
 *              mode), so it sits behind CategoryPeek instead of plainly
 *
 * `category` is DEALT MODE's hidden value — the hot seat's clause, null on
 * their own device. Online that is a Firebase rule rather than a prop decision;
 * the value never reaches the device at all. `myCategory` is CHOSEN MODE's, and
 * it is the exact mirror: null on everyone else's device, and shown to its
 * owner only as a reminder, since they picked it and already know it.
 *
 * THE SCREEN IS A HEADER, ONE CARD, AND THE TRAIL — down from six panels of
 * identical weight, which is what it was when a turn was an uninterrupted block
 * of ten names and every state of it had to be on screen at once. `judging` and
 * `naming` are mutually exclusive by construction, so exactly one of them is the
 * thing being asked of you and it gets the only card. Everything that was a
 * panel holding one sentence is now a sentence.
 */
export default function TurnScreen({
  seatName, roundNumber, totalRounds, noun,
  phase, pending, trails = {}, order = [], cap, left, lastPlayed = null,
  chosen = false, category = null, myCategory = null, peek = false,
  canName = false, rulers = [], declarable = [], pendingJudges = [],
  myPlayerId = null, nameFor, usedFor, remindFor,
  onPropose, onDeclare, onRule, onPass, onAbandon = null,
}) {
  const [draft, setDraft] = useState('');
  const [declaring, setDeclaring] = useState(false);
  const [target, setTarget] = useState(null);

  // Both resets happen DURING RENDER rather than in an effect — React's
  // documented way to adjust state when a prop changes, and the pattern
  // wavelength's OnlineGame uses to clear a stale dial draft. An effect would
  // repaint once with the old text still in the box.
  //
  // Cleared when the ANSWER LANDS rather than in the submit handler, which is
  // the important half: a name the rules rejected (a double tap, a write that
  // lost a race) never reaches 'judging', so the text stays where the player
  // typed it instead of being silently eaten by a submit that did nothing.
  const [lastPhase, setLastPhase] = useState(phase);
  if (lastPhase !== phase) {
    setLastPhase(phase);
    if (phase === 'judging') setDraft('');
  }

  // A new go opens on the naming box, never on a declaration box the previous
  // player left open — and never carrying their half-typed guess, or the person
  // they had aimed it at, into it. Keyed on the seat, which now changes after
  // every single name rather than once a turn, so this fires far more often and
  // matters far more: on a shared device the box is handed straight over.
  const turnKey = `${roundNumber} ${seatName}`;
  const [lastTurn, setLastTurn] = useState(turnKey);
  if (lastTurn !== turnKey) {
    setLastTurn(turnKey);
    setDeclaring(false);
    setDraft('');
    setTarget(null);
  }

  // Only ever one candidate at two players, so making them tap it would be a
  // step that never carries information. Derived rather than stored, so a
  // player who gets claimed mid-round cannot leave a stale id selected.
  const aimedAt = chosen
    ? (declarable.find((p) => p.id === target) ?? (declarable.length === 1 ? declarable[0] : null))
    : null;
  const canSubmitDeclaration = !!draft.trim() && (!chosen || !!aimedAt);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    if (!declaring) { onPropose(text); return; }
    if (chosen && !aimedAt) return;
    onDeclare(text, aimedAt?.id ?? null);
  };

  // "Your go" only where there is a "you". Online this device is one player, so
  // `canName` means the seat is me; locally it is always true because the device
  // is whoever is holding it — and with the seat moving after every name, a
  // heading that says "Your go" to a table of four names nobody. `myPlayerId` is
  // null exactly in that case, which makes it the test.
  const iAmSeat = canName && !!myPlayerId;
  const waitingOnJudge = phase === 'judging';
  // Whoever is next to answer on this device. ONE AT A TIME rather than a pair
  // of buttons per player: locally `rulers` is the whole table, and at six that
  // was twelve full-size blocks and six nested panels in one card. They answer
  // in turn anyway — the device is passed or leaned over — so the screen asks
  // one person and says who is behind them.
  const ruler = rulers[0] ?? null;
  const iRule = rulers.length > 0;
  const laterNames = pendingJudges
    .filter((p) => p.id !== ruler?.id)
    .map((p) => p.name)
    .join(', ');

  const instruction = () => {
    if (canName && chosen) {
      return `Name one ${noun}. Everyone answers against their own category — you are working out theirs.`;
    }
    if (canName) return `Name one ${noun}. The judge will tell you yes or no.`;
    if (iRule && chosen) return 'Answer against your own category, honestly.';
    if (iRule) return `Answer ${seatName} honestly.`;
    if (laterNames || ruler) return 'Watch, and say nothing.';
    return `${seatName} is naming. Watch, and say nothing.`;
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-extrabold uppercase tracking-widest text-white/50">
            Round {roundNumber} of {totalRounds}
          </p>
          <h2 className="truncate font-display text-2xl font-extrabold text-white">
            {iAmSeat ? 'Your go' : `${seatName}'s go`}
          </h2>
        </div>
        <Badge tone={left > 0 ? 'lime' : 'red'} className="flex-shrink-0 text-base">
          {left} left
        </Badge>
      </div>

      {/* What this device is FOR, said once and as a sentence rather than as a
          panel. Without it a judge's screen and a spectator's are identical
          apart from two buttons, and the person who has to answer does not know
          it is them. */}
      <p className="mb-5 text-base text-white/60">{instruction()}</p>

      <SeatStrip order={order} myPlayerId={myPlayerId} className="mb-5" />

      {/* WHAT JUST HAPPENED. It earns its place because a missed declaration no
          longer stops the round to announce itself — the seat simply moves on —
          so without this the only trace of somebody guessing and being told no
          is a row inside a collapsed trail. Suppressed during judging, where the
          card below is the news. */}
      {!waitingOnJudge && lastPlayed && (
        <LastPlayed entry={lastPlayed} nameFor={nameFor} myPlayerId={myPlayerId} />
      )}

      {/* DEALT: the seat's clause, absent entirely on their own device. A strip
          rather than a panel — it is a thing to consult, not the thing being
          asked. */}
      {category && (peek
        ? <CategoryPeek label={category.label} seatName={seatName} bare className="mb-5" />
        : (
          <div className="mb-5 rounded-pop-sm bg-white/5 px-3 py-2">
            <p className="font-display text-xs font-extrabold uppercase tracking-widest text-white/50">
              {seatName}&apos;s category
            </p>
            <p className="mt-0.5 font-display text-xl font-extrabold text-white">
              {category.label}
            </p>
          </div>
        ))}

      {/* CHOSEN: my own clause, and only mine. Behind the same toggle even
          though I picked it — the device may be on a table, and a reminder I
          asked for is different from one printed above the trail all round. */}
      {myCategory && (
        <CategoryPeek
          label={myCategory.label}
          openLabel="Your category"
          closedLabel="Your category — everyone else looks away"
          bare
          className="mb-5"
        />
      )}

      {/* THE ONE CARD. Judging and naming cannot both be true, so whichever one
          is asking gets the whole surface. */}
      {waitingOnJudge && pending && (
        <Card padding="md" className="mb-5 text-center">
          <p className="font-display text-sm font-extrabold uppercase tracking-widest text-white/50">
            {pending.kind === 'declaration' ? 'Their guess at the category' : `Is this ${noun} in it?`}
          </p>
          <p className="my-3 font-display text-2xl font-extrabold text-white">{pending.text}</p>

          {ruler && (
            <>
              {/* Named only when this device answers for more than one person —
                  which is local chosen mode, and nothing else. */}
              {rulers.length > 1 && (
                <p className="mb-2 font-display text-base font-extrabold text-pop-purple">
                  {ruler.name}, your answer
                </p>
              )}
              {/* LOCAL CHOSEN MODE ONLY: a reminder of this ruler's own clause,
                  behind the same toggle everything hidden goes behind. Online
                  there is nothing to offer — one device holds one clause, which
                  `myCategory` already covers — so remindFor is simply absent. */}
              {remindFor?.(ruler.id) && (
                <CategoryPeek
                  label={remindFor(ruler.id).label}
                  openLabel={`${ruler.name}'s category`}
                  closedLabel={`${ruler.name} only — everyone else looks away`}
                  bare
                  className="mb-3 text-left"
                />
              )}
              <div className="flex gap-3">
                <Button variant="success" size="lg" fullWidth onClick={() => onRule(ruler.id, true)}>
                  ✓ Yes
                </Button>
                <Button variant="danger" size="lg" fullWidth onClick={() => onRule(ruler.id, false)}>
                  ✕ No
                </Button>
              </div>
            </>
          )}

          {/* Everyone can see how far off a full answer is, which is what stops
              a slow table looking like a broken one. */}
          {laterNames && (
            <p className="mt-3 text-sm text-white/40">
              {ruler ? 'Then' : 'Waiting on'} {laterNames}.
            </p>
          )}
          {!ruler && !laterNames && <p className="text-base text-white/40">Waiting…</p>}
        </Card>
      )}

      {canName && !waitingOnJudge && (
        <Card padding="md" className="mb-5">
          {/* WHOSE rule you are claiming, and it comes before the box: typing a
              clause and only then being asked who it belongs to gets the answer
              wrong, because the guess and the person are one thought. Hidden at
              two players, where there is only ever one candidate. */}
          {declaring && chosen && declarable.length > 1 && (
            <div className="mb-4">
              <p className="mb-2 font-display text-sm font-extrabold uppercase tracking-widest text-white/50">
                Whose category?
              </p>
              <div className="flex flex-wrap gap-2">
                {declarable.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={aimedAt?.id === p.id}
                    onClick={() => setTarget(p.id)}
                    className={`focus-pop rounded-pop-sm border-2 px-3 py-2 font-display text-base
                      font-bold transition-colors ${aimedAt?.id === p.id
                        ? 'border-pop-purple bg-pop-purple/25 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:text-white'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {declaring && chosen && !declarable.length ? (
            <p className="text-base text-pop-amber">
              Nobody left to claim — everyone else has either been solved or is somebody
              you have already missed at. Keep naming, or sit out the round.
            </p>
          ) : (
            <>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                maxLength={MAX_PROPOSAL_LEN}
                autoFocus
                aria-label={declaring ? 'Your guess at the category' : `A ${noun} to try`}
                placeholder={declaring ? 'e.g. wears glasses' : `Name a ${noun}…`}
                className="mb-3"
              />
              <Button
                variant={declaring ? 'success' : 'primary'}
                size="lg"
                fullWidth
                disabled={declaring ? !canSubmitDeclaration : (!draft.trim() || left <= 0)}
                onClick={submit}
              >
                {/* Names the person, because "that is my category" is the DEALT
                    claim and would be a lie here. With nobody picked the label
                    says what is missing rather than restating the goal — the
                    button is disabled at that point, and a disabled button that
                    does not explain itself reads as broken. */}
                {!declaring && 'Ask — then pass'}
                {declaring && !chosen && '🎯 That is my category'}
                {declaring && chosen && (aimedAt
                  ? `🎯 That is ${aimedAt.name}'s category`
                  : '🎯 Pick whose category first')}
              </Button>
            </>
          )}

          {/* DECLARING IS A REAL BUTTON, NOT A GHOST LINK. It is the win
              condition of the game and it used to sit at the same dim weight as
              "give up", on the same row, which said the two were alternatives of
              equal standing. Always reachable, including with no names spent —
              scoreTurn caps what a blind guess pays rather than forbidding it —
              and it is the ONLY thing still reachable once the names run out. */}
          <Button
            variant={declaring ? 'neutral' : 'secondary'}
            size="md"
            fullWidth
            className="mt-3"
            onClick={() => { setDeclaring((v) => !v); setDraft(''); }}
          >
            {declaring
              ? `← Back to naming ${noun}s`
              : (chosen ? '💡 I know someone’s category' : '💡 I know the category')}
          </Button>

          {!declaring && (
            <p className="mt-3 text-sm text-white/40">
              {left <= 0
                ? 'Out of names — say what you think it is, or sit out the round.'
                : `A wrong guess costs ${WRONG_DECLARATION_COST} names, not your round.`}
            </p>
          )}
        </Card>
      )}

      <TrailBoard
        order={order}
        trails={trails}
        // Locally there is no "me" — the device is whoever is up — so the open
        // block follows the seat. Online it follows this device's player, whose
        // own evidence is the thing they came back to read.
        open={myPlayerId ?? order.find((r) => r.isSeat)?.playerId ?? null}
        myPlayerId={myPlayerId}
        cap={cap}
        nameFor={nameFor}
        usedFor={usedFor}
        className="mb-5"
      />

      {/* The quiet row. Everything here ends something, and none of it is the
          thing the screen is asking for. */}
      {(canName || onAbandon) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canName
            ? <GhostButton onClick={onPass}>Give up — sit out the round</GhostButton>
            : <span />}
          {/* The wedge presence cannot see: a hot seat who is connected and
              simply not naming anything. It lives here rather than under the
              screen so it inherits the width instead of re-declaring it, and so
              it reads as what it is — an escape hatch, beside the other one. */}
          {onAbandon && (
            <GhostButton className="text-pop-red/70 hover:text-pop-red" onClick={onAbandon}>
              End {seatName}&apos;s round
            </GhostButton>
          )}
        </div>
      )}
    </>
  );
}

/**
 * The last thing the table watched, in one line.
 *
 * Reads the same `verdictsOf` the trail does, so the three stored verdict shapes
 * are flattened in exactly one place. A miss says what it COST, because that is
 * the half a player cannot see anywhere else: the name count simply jumps.
 */
function LastPlayed({ entry, nameFor, myPlayerId }) {
  const who = entry.playerId === myPlayerId ? 'You' : (nameFor?.(entry.playerId) ?? 'Someone');
  const verdicts = verdictsOf(entry);
  const missed = entry.kind === 'declaration';

  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-pop-sm px-3 py-2
        ${missed ? 'bg-pop-red/10' : 'bg-white/5'}`}
    >
      <span className="text-base text-white/60">
        {who} {missed ? 'guessed' : 'named'}
      </span>
      <span className="min-w-0 font-display text-base font-extrabold text-white">
        {entry.text}
      </span>
      {missed && entry.targetId && (
        <span className="text-base text-white/60">at {nameFor?.(entry.targetId) ?? 'someone'}</span>
      )}
      <span className="flex flex-wrap gap-1.5">
        {verdicts.map(({ judgeId, verdict }) => (
          <Badge key={judgeId ?? 'only'} tone={verdict ? 'lime' : 'red'}>
            {verdicts.length > 1 ? `${nameFor?.(judgeId) ?? '?'} ` : ''}
            {verdict ? 'YES' : 'NO'}
          </Badge>
        ))}
      </span>
      {missed && (
        <span className="text-sm text-pop-red/80">
          −{WRONG_DECLARATION_COST} names
        </span>
      )}
    </div>
  );
}
