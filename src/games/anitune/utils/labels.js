// Display strings for a question, shared by the per-question reveal and the
// end-of-round recap.
//
// A module of its own rather than a helper inside one of the screens: both
// render the same facts about the same song, and a `.jsx` file that exported it
// would trip the react-refresh lint rule (components only). Being a `.js` module
// also means the vitest config picks up its tests.

/**
 * "Opening 2" / "Ending" / "Theme 3".
 *
 * The sequence is genuinely absent on a lot of entries — a show with one ED
 * stores null rather than 1 — so it is appended only when present. "Ending null"
 * shipped to screen once already.
 */
export function themeLabel(question) {
  const kind = question?.type === 'OP' ? 'Opening'
    : question?.type === 'ED' ? 'Ending'
      : 'Theme';
  return question?.sequence ? `${kind} ${question.sequence}` : kind;
}

// "Opening 2 · 2020", dropping either half when it is missing rather than
// leaving a stranded separator.
export function themeAndYear(question) {
  return [themeLabel(question), question?.year].filter(Boolean).join(' · ');
}

/**
 * "give it back — Cö shu Nie", or just the song when nobody is credited.
 *
 * A great many older AnimeThemes entries carry no artist rows at all, and songs
 * performed by the show itself are frequently uncredited, so the empty case is
 * ordinary rather than exceptional.
 */
export function songCredit(question) {
  const song = question?.songTitle;
  const artists = question?.artists ?? [];
  if (!song) return artists.length ? artists.join(', ') : '';
  return artists.length ? `${song} — ${artists.join(', ')}` : song;
}
