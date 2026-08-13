import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';
import { formatPoints } from '../../../shared/utils/deadline';
import { themeAndYear, songCredit } from '../utils/labels';
import { hasLives } from '../rules';
import { Avatar, Backdrop, Badge, Button, Card, CardRow, Screen, Wordmark } from '../../../shared/ui';

// `departedIds` is online-only: anyone who left mid-match keeps the score they
// had, ranked alongside everyone else, but is dimmed and tagged so the standings
// don't read as though they played the whole round.
export default function AniTuneResults({
  // onBack is local-only: online "again" returns to the lobby, and there is no
  // local setup to go back to. Screen omits the row when it is undefined.
  players, scores, roundSize, mode, lives = null, eliminated = [],
  // The songs actually heard, for the recap below. `playedCount` matters because
  // Lives can end a round early: the questions after that were dealt but never
  // played, and listing them would both claim the table heard things it didn't
  // and hand out the answers to a re-deal from the same pool.
  round = [], playedCount = null,
  departedIds = [], onPlayAgain, onBack,
}) {
  const played = round.slice(0, playedCount ?? round.length);
  const lastManStanding = hasLives(mode);

  // Lives ranks by survival first and points only as a tiebreak, because that is
  // what the mode asks of you: a player who outlasted everyone on lucky guesses
  // beat the one who scored more and went out in round three. `eliminated` is
  // append-only, so its order IS the elimination order — later out is better.
  const ranked = lastManStanding
    ? [...players]
      .map((p) => ({ ...p, total: scores[p.id] || 0, outAt: eliminated.indexOf(p.id) }))
      .sort((a, b) => {
        if ((a.outAt < 0) !== (b.outAt < 0)) return a.outAt < 0 ? -1 : 1;
        if (a.outAt !== b.outAt) return b.outAt - a.outAt;
        return b.total - a.total;
      })
      .map((p, i) => ({ ...p, position: i + 1 }))
    : computeRankedPlayers(players, scores);

  // The old "12 / 20" denominator only made sense when a question was worth
  // exactly one point. A speed bonus takes the ceiling to 2.0 per question, and
  // "12.4 / 20" would read as though 40 were unreachable rather than 20 being
  // the wrong number entirely — so the total stands alone.
  const suffix = roundSize ? `over ${roundSize} song${roundSize === 1 ? '' : 's'}` : '';

  return (
    <>
      <Backdrop />
      <Screen center width="md" onBack={onBack} backLabel="← Back to setup">
        <Wordmark tone="blue" size="md" level={2} className="mb-2">
          🏆 Final Scores
        </Wordmark>
        {suffix && <p className="mb-8 text-center text-base text-white/40">{suffix}</p>}

        <Card padding="sm" className="mb-8">
          {ranked.map((p) => {
            const left = departedIds.includes(p.id);
            const out = lastManStanding && eliminated.includes(p.id);
            return (
              <CardRow key={p.id} className={left ? 'opacity-50' : ''}>
                <span className="w-10 text-2xl">{getPositionEmoji(p.position)}</span>
                <span className="min-w-0 flex-1 truncate text-left font-display text-lg font-extrabold text-white">
                  {p.name}
                  {left && <span className="ml-2 text-sm font-bold text-white/50">left</span>}
                </span>
                {lastManStanding && (
                  <Badge tone={out ? 'red' : 'lime'}>
                    {out ? '💀 out' : `♥ ${lives?.[p.id] ?? 0}`}
                  </Badge>
                )}
                <span className="font-display text-xl font-extrabold text-pop-amber">
                  {formatPoints(p.total)}
                </span>
              </CardRow>
            );
          })}
        </Card>

        {/* The round's setlist. Not a spoiler measure — the reveal already names
            the song and its performers as each one is played — just the
            "what was that second one again?" list a music quiz wants at the end,
            in one place instead of scattered across screens nobody can go back
            to. */}
        {played.length > 0 && (
          <Card title={`🎵 The ${played.length} song${played.length === 1 ? '' : 's'}`} padding="sm" className="mb-8">
            {played.map((q, i) => (
              <CardRow key={`${q.id}:${i}`} className="text-left">
                <span className="w-6 flex-shrink-0 text-sm tabular-nums text-white/30">{i + 1}</span>
                {q.coverImageUrl
                  ? <Avatar src={q.coverImageUrl} alt="" size="sm" className="flex-shrink-0" />
                  : <span className="w-10 flex-shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-extrabold text-white">
                    {songCredit(q) || '—'}
                  </span>
                  <span className="block truncate text-sm text-white/40">
                    {q.animeTitle} · {themeAndYear(q)}
                  </span>
                </span>
              </CardRow>
            ))}
          </Card>
        )}

        <Button variant="success" size="xl" fullWidth onClick={onPlayAgain}>
          🔁 Play again
        </Button>
      </Screen>
    </>
  );
}
