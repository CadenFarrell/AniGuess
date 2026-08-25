import { useEffect, useState } from 'react';
import { Badge, Banner, Button, Card, CardRow, GhostButton, Screen } from '../../../shared/ui';
import ClueCard from './ClueCard';
import Dial from './Dial';

// Where the target band and every dial finally sit on the same track.
//
// The picture IS the arithmetic, the way anirank's slopegraph is: a dial inside
// the lime band scored, one outside it did not, and the distance you can see is
// the distance that was measured. Nothing has to be encoded as a number inside a
// marker, and there is no second coordinate system for the two to disagree in.

/**
 * Short marker labels that are actually distinguishable from each other.
 *
 * A fixed two-character slice is the obvious version and it is wrong at a real
 * table: "Gavin" and "Gabe" both render "GA", so the reveal draws two identical
 * badges and nobody can tell which dial was theirs — on the one screen whose
 * whole job is showing people where their guess landed. Grows the prefix until
 * it separates them, and only falls back to a numeral when two players genuinely
 * share a name.
 */
function shortLabels(names) {
  const out = names.map((n) => (n || '?').trim().toUpperCase());
  for (let len = 1; len <= 4; len++) {
    const tries = out.map((n) => n.slice(0, len));
    if (new Set(tries).size === tries.length) return tries;
  }
  // Same name twice — nothing in the string can separate them.
  return out.map((n, i) => `${n.slice(0, 2)}${i + 1}`);
}

/**
 * A score that ticks up to its value, the way the bands and the markers land
 * one at a time. Purely presentational: it always settles on `points`.
 *
 * Written against requestAnimationFrame rather than an interval so it tracks
 * real elapsed time — a tab that was throttled mid-reveal resumes at the right
 * number instead of finishing seconds late. The reduced-motion check is the
 * same promise index.css makes for every other animation in the app, made here
 * because a keyframe cannot count.
 */
/**
 * Should this score just appear at its value?
 *
 * Two reasons, and the second is a bug fix rather than a courtesy. A count-up
 * has to be driven by requestAnimationFrame to track real elapsed time — but a
 * BACKGROUND TAB DOES NOT RUN rAF AT ALL, so a reveal that lands while the
 * player is looking at something else freezes every score at zero and stays
 * there. It self-heals when they come back, which is exactly what makes it
 * dangerous: a screenshot, a shared screen or a second monitor shows a table
 * where nobody scored anything, and it is right again by the time anyone checks.
 *
 * Correctness must not depend on an animation completing. An animation nobody
 * can see is worth nothing anyway, so a hidden document skips straight to the
 * answer — and because this is read once, at mount, a tab that becomes visible
 * later shows the finished number rather than starting a stale count.
 */
const prefersStill = () => (
  typeof window === 'undefined'
  || document.hidden
  || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
);

const startAt = (points) => (prefersStill() ? points : 0);

function useCountUp(points, delayMs) {
  // Seeded to the finished value when nothing should move, so a reduced-motion
  // reader never sees a zero at all — not even for the frame before an effect
  // could correct it.
  const [shown, setShown] = useState(() => startAt(points));

  // Reset DURING RENDER rather than in an effect, the pattern shared/ui/Avatar.jsx
  // uses to clear its failed flag when `src` changes. It matters twice over here:
  // a synchronous setState inside an effect is the cascading-render the
  // react-hooks rule exists to catch, and these rows are keyed by player id, so
  // they survive into the next round — without a reset, round two would count up
  // from round one's score.
  const [prevPoints, setPrevPoints] = useState(points);
  if (prevPoints !== points) {
    setPrevPoints(points);
    setShown(startAt(points));
  }

  useEffect(() => {
    if (prefersStill() || points <= 0) return undefined;

    let frame = 0;
    let start = 0;
    const DURATION = 420;
    const tick = (now) => {
      if (!start) start = now;
      const elapsed = now - start - delayMs;
      // Nothing is set until the delay is up, so the number stays at zero
      // rather than running ahead of the marker that explains it.
      if (elapsed < 0) { frame = requestAnimationFrame(tick); return; }
      const t = Math.min(1, elapsed / DURATION);
      setShown(Math.round(points * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [points, delayMs]);

  return shown;
}

function ScoreBadge({ points, delayMs }) {
  const shown = useCountUp(points, delayMs);
  return <Badge tone={points > 0 ? 'lime' : 'neutral'}>+{shown}</Badge>;
}

// `waitingFor` is the online guest's version of the advance buttons: only the
// host moves the room on, so everyone else gets a line naming who they are
// waiting for. Passing it in — rather than teaching this screen about hosts —
// is what keeps it the same dumb component local play renders.
//
// `onQuit` is local play's way out of a session that has stopped being fun
// before its last round, and this is the only screen it can live on — every
// other one is somebody's turn, and a way out beside a hidden target is a way
// to lose the round by mis-tap. Online passes nothing: leaving a ROOM is the
// Leave button in the shell, which has to clean up a seat this cannot.
export default function RevealScreen({
  spectrum, target, explain, players, psychic, roundScores, abandoned, card = null,
  mode = 'text', isFinalRound, onNext, onResults, waitingFor = null, onQuit = null,
}) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? id;

  // Labels are computed across the WHOLE set rather than per name, because
  // uniqueness is a property of the set — a name cannot know it collides.
  const placed = explain.filter((r) => r.placed);
  const shorts = shortLabels(placed.map((r) => nameOf(r.playerId)));
  const markers = placed.map((r, i) => ({
    playerId: r.playerId,
    value: r.value,
    name: nameOf(r.playerId),
    short: shorts[i],
  }));

  return (
    <Screen>
      <h2 className="mb-6 font-display text-2xl font-extrabold text-white">
        {abandoned ? 'Round abandoned' : 'Reveal'}
      </h2>

      {abandoned && (
        <Banner tone="warning" className="mb-6">
          The psychic left before the target could be revealed, so this round
          scores nothing. Everyone keeps the points they already had.
        </Banner>
      )}

      <Card padding="lg" className="mb-6">
        {card && <ClueCard card={card} size="lg" className="mb-6" />}
        {/* A round abandoned before the psychic ever published has no spectrum
            to draw — the guess phase cannot open without one, but this screen
            is also where an abandoned round lands. Guarded rather than
            defaulted: a dial labelled with a spectrum nobody played is worse
            than no dial. */}
        {spectrum ? (
          // animate only here: the bands settle, then each dial lands. The
          // other two screens draw the same dial with no motion at all.
          <Dial spectrum={spectrum} target={target} markers={markers} animate={!abandoned} />
        ) : (
          <p className="text-center text-base text-white/40">
            The round ended before a spectrum was chosen.
          </p>
        )}
        {!abandoned && (
          <p className="mt-4 text-center text-base text-white/50">
            {mode === 'readroom' ? (
              <>
                {psychic ? psychic.name : 'The psychic'} put it at{' '}
                <span className="font-display font-extrabold text-white">{target}</span>.
              </>
            ) : (
              <>
                {psychic ? `${psychic.name}'s` : 'The'} target was{' '}
                <span className="font-display font-extrabold text-white">{target}</span>.
              </>
            )}
          </p>
        )}
      </Card>

      {!abandoned && (
        <Card title="This round" padding="sm" className="mb-6">
          {explain.map((r, i) => (
            <CardRow key={r.playerId}>
              <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                {nameOf(r.playerId)}
              </span>
              {/* A player who never dialled scored zero for a completely
                  different reason than one who dialled badly. Drawing them the
                  same way accuses somebody whose tab closed of guessing wrong. */}
              {r.placed ? (
                <span className="text-sm text-white/50">off by {r.distance}</span>
              ) : (
                <span className="text-sm text-white/40">no dial</span>
              )}
              {/* The same stagger the markers use, so a score arrives just
                  after the dial it is for — the two are one explanation. */}
              <ScoreBadge points={r.points} delayMs={260 + i * 110} />
            </CardRow>
          ))}
          {psychic && (
            <CardRow>
              <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                {psychic.name}
              </span>
              <span className="text-sm text-white/50">psychic — average of the dials</span>
              <ScoreBadge
                points={roundScores[psychic.id] ?? 0}
                delayMs={260 + explain.length * 110}
              />
            </CardRow>
          )}
        </Card>
      )}

      {waitingFor && (
        <p className="text-center text-base text-white/50">{waitingFor}</p>
      )}

      {!waitingFor && (isFinalRound ? (
        <Button variant="success" size="xl" fullWidth onClick={onResults}>
          Final scores
        </Button>
      ) : (
        <Button variant="primary" size="xl" fullWidth onClick={onNext}>
          Next round
        </Button>
      ))}

      {onQuit && (
        <div className="mt-6 text-center">
          <GhostButton onClick={onQuit}>← Leave the round</GhostButton>
        </div>
      )}
    </Screen>
  );
}
