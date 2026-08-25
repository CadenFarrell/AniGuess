// Every spectrum AniWave can deal. Adding one means adding an entry here and
// nothing else: rules.js never learns what the round is about, and the screens
// read their end caps off the spectrum rather than hardcoding "FILLER → CANON".
//
// THE ONE RULE A NEW SPECTRUM MUST OBEY:
//
//   `leftLabel` names dial value DIAL_MIN. `rightLabel` names DIAL_MAX.
//
// The fields are named for the ends of the *dial* rather than the ends of some
// abstract scale, because the dial is the only thing a player ever sees. AniRank
// learned this the expensive way: its axes carried `lowLabel`/`highLabel`, which
// said nothing about which way a list runs, and the board spent a release
// rendering "← OLDEST" beside the slot holding the newest show. The equivalent
// bug here is worse than cosmetic — a flipped pair does not just mislabel the
// track, it silently inverts every score in the game, because the psychic clues
// one end and the guessers are scored against the other.
//
// Deliberately a FORK of anirank/axes.js rather than an import. Those axes carry
// `kind`, `items`, `defaultBlind`, `valueFor` and a prompt function phrased
// "Rank these shows … as {name} would" — five fields that mean nothing here,
// where a spectrum is a pair of words and no cards are dealt at all. The
// precedent is anifake/utils/pool.js forking anirank/utils/deck.js for the same
// reason: shared code between two things that are about to diverge costs more
// than the duplication it saves.
//
// PLAYER-WRITTEN SPECTRA LIVE HERE TOO, and the note this paragraph replaces
// predicted the shape they had to take. A round cannot store a custom spectrum's
// *id*: that works for a built-in only because every device ships every
// definition, and a custom one has been seen by exactly one device. So the
// round's field is a polymorphic SPEC — an id string for a built-in, the whole
// definition object for a custom — and getSpectrum below is the single place
// that knows the difference. Nothing downstream, and no screen, ever branches.
// anirank's getAxis is the same resolver against the same problem.

// The end caps are drawn in a fixed-width band either side of the dial, so a
// label longer than this wraps and shoves the track off-centre. Pinned by a test
// rather than trusted, because the failure only shows up on a narrow screen.
export const MAX_LABEL_LEN = 14;

// EVERY SPECTRUM DECLARES ITS POOL, and `pool` is a filter on what is OFFERED
// rather than on what is playable. A spectrum that reaches a round is rendered
// whatever its tag says — getSpectrum never reads this field, and
// DEFAULT_SPECTRUM_ID stays a shows entry because that fallback exists for a
// spec an older build wrote, not for a suggestion. Nothing downstream branches.
//
// The bug it fixes is one anirank/axes.js already diagnosed and wrote down: an
// `items` property discoverable only from the screen made half of every list
// irrelevant, so someone tiering their shows was offered "Would win → Would
// lose". AniWave inherited the content split without the field — a Shows round
// suggested TRAITOR → LOYAL, a Characters round suggested SHONEN → SEINEN, and
// the psychic rerolled past the half they could not clue.
//
// 'BOTH' IS A REAL ANSWER, not a cop-out, and this is where the fork diverges
// from axes.js's strict two-valued `items`. There an axis DEALS A DECK from
// `items`, so a card is a show or a character and nothing is both; here a
// spectrum only decides what words sit under the dial, and CURSED → WHOLESOME
// is clued identically about a show and about a character. Forcing those to one
// side would halve an already-small list to buy nothing.
//
// Uppercase, because the screens render these verbatim beside each other and a
// mixed-case pair reads as two different kinds of thing.
export const SPECTRA = [
  // ---- shows ----
  { id: 'filler', pool: 'shows', leftLabel: 'FILLER', rightLabel: 'CANON' },
  { id: 'demo', pool: 'shows', leftLabel: 'SHONEN', rightLabel: 'SEINEN' },
  { id: 'burn', pool: 'shows', leftLabel: 'SLOW BURN', rightLabel: 'INSTANT' },
  { id: 'binge', pool: 'shows', leftLabel: 'ONE AND DONE', rightLabel: 'ALL NIGHTER' },
  { id: 'budget', pool: 'shows', leftLabel: 'POWERPOINT', rightLabel: 'SAKUGA' },
  { id: 'gateway', pool: 'shows', leftLabel: 'DEEP CUT', rightLabel: 'GATEWAY ANIME' },
  { id: 'ending', pool: 'shows', leftLabel: 'RUINED IT', rightLabel: 'PERFECT ENDING' },
  { id: 'length', pool: 'shows', leftLabel: 'ONE MOVIE', rightLabel: '500 EPISODES' },
  { id: 'attention', pool: 'shows', leftLabel: 'BACKGROUND', rightLabel: 'FULL ATTENTION' },

  // ---- characters ----
  { id: 'loyal', pool: 'characters', leftLabel: 'TRAITOR', rightLabel: 'LOYAL' },
  { id: 'power', pool: 'characters', leftLabel: 'WOULD LOSE', rightLabel: 'WOULD WIN' },
  { id: 'trope', pool: 'characters', leftLabel: 'TROPE', rightLabel: 'ORIGINAL' },
  { id: 'villain', pool: 'characters', leftLabel: 'PURE EVIL', rightLabel: 'MISUNDERSTOOD' },
  { id: 'roommate', pool: 'characters', leftLabel: 'NIGHTMARE', rightLabel: 'DREAM ROOMMATE' },
  { id: 'screen', pool: 'characters', leftLabel: 'SIDE CHARACTER', rightLabel: 'MAIN CHARACTER' },
  { id: 'crush', pool: 'characters', leftLabel: 'HARD PASS', rightLabel: 'MARRY ME' },
  { id: 'braincell', pool: 'characters', leftLabel: 'NO BRAINCELLS', rightLabel: 'BIG BRAIN' },
  { id: 'annoying', pool: 'characters', leftLabel: 'ANNOYING', rightLabel: 'BELOVED' },

  // ---- either ----
  { id: 'cursed', pool: 'both', leftLabel: 'CURSED', rightLabel: 'WHOLESOME' },
  { id: 'hype', pool: 'both', leftLabel: 'UNDERRATED', rightLabel: 'OVERRATED' },
  { id: 'tears', pool: 'both', leftLabel: 'DRY EYES', rightLabel: 'SOBBING' },
  { id: 'niche', pool: 'both', leftLabel: 'NICHE', rightLabel: 'MAINSTREAM' },
];

export const DEFAULT_SPECTRUM_ID = SPECTRA[0].id;

const BY_ID = new Map(SPECTRA.map((s) => [s.id, s]));

/**
 * Resolves a spec into a full spectrum.
 *
 * Four accepted shapes, mirroring anirank's getAxis: a built-in's id, a stored
 * custom spectrum, an already-resolved spectrum, and a bare `{ id }` wrapper.
 * Carrying all four in one function is what lets every caller hold "the
 * spectrum" without tracking which kind it has — and the custom branch has to
 * come FIRST, because a stored custom carries an id that resolves to nothing.
 *
 * Never returns undefined, for the reason getAxis doesn't: a spec can arrive
 * from a saved room written by an older build, and a round that cannot name its
 * spectrum renders a dial with blank ends — which looks like a bug in the dial
 * rather than in the data.
 */
export function getSpectrum(spec) {
  if (spec && typeof spec === 'object') {
    if (spec.custom) return customSpectrum(spec);
    if (spec.leftLabel && spec.rightLabel) return spec;
    if (spec.id) return getSpectrum(spec.id);
  }
  return BY_ID.get(spec) ?? BY_ID.get(DEFAULT_SPECTRUM_ID);
}

export const isCustom = (spectrum) => spectrum?.custom === true;

/**
 * The id a spec is remembered by. Only ever persisted for a built-in — see
 * anirank's axisIdOf, and the comment on `exclude` below.
 */
export const spectrumIdOf = (spec) => (
  typeof spec === 'string' ? spec : spec?.id ?? DEFAULT_SPECTRUM_ID
);

/**
 * The menu/heading name for a spectrum.
 *
 * DERIVED from the two labels, never stored alongside them. AniRank has to pin
 * "every opinion label contains the arrow it is trusted to have" with a test,
 * because there a label and its end caps are separate fields free to disagree.
 * Building it here means they cannot.
 */
export function spectrumLabel(spectrum) {
  const s = getSpectrum(spectrum);
  return `${s.leftLabel} → ${s.rightLabel}`;
}

/**
 * Whether a spectrum may be OFFERED for a round drawn from `pool`.
 *
 * A null pool means NO FILTER, and both halves of that are load-bearing. `text`
 * mode draws no cards at all, so it has no pool and its setup screen shows no
 * pool control — filtering there would hide half the registry on a setting the
 * player was never shown. And a spectrum carrying no `pool` of its own is a
 * player-written one, which is never filtered: you wrote it, so you know which
 * pool it is for, and tagging customs would cost a field in a stored shape that
 * is deliberately two strings and one boolean.
 */
export const spectrumInPool = (s, pool) => (
  !pool || !s?.pool || s.pool === 'both' || s.pool === pool
);

/**
 * Draws a spectrum for a round.
 *
 * `exclude` is the last round's id, so the same pair cannot come up twice in a
 * row — which at this registry size is otherwise common enough to notice, and
 * reads as the shuffle being broken. Falls back to the full list rather than
 * returning null when excluding would leave nothing, so a one-spectrum build
 * still deals — and the pool filter gets the same treatment for the same reason.
 */
export function pickSpectrum(rng = Math.random, { exclude = null, pool = null } = {}) {
  const inPool = SPECTRA.filter((s) => spectrumInPool(s, pool));
  const eligible = inPool.length ? inPool : SPECTRA;
  const kept = eligible.filter((s) => s.id !== exclude);
  const from = kept.length ? kept : eligible;
  return from[Math.floor(rng() * from.length)] ?? from[0];
}

/**
 * Several DISTINCT candidates, for the psychic to choose between.
 *
 * Distinct is the whole requirement: an offer of three where two are the same
 * spectrum is not an offer of three, and drawing independently would produce
 * that roughly a quarter of the time at this registry size. Draws by removing
 * from a copy rather than by retrying, so it terminates even when `count`
 * exceeds what is left — it returns fewer, and the picker renders fewer.
 *
 * `pool` is applied BEFORE `exclude`, not after, so the last round's spectrum is
 * removed from what this pool can offer rather than from the whole registry —
 * otherwise excluding a shows entry would quietly do nothing to a characters
 * draw, and the two fallbacks would fire on the wrong list.
 *
 * `extra` is where the player's own spectra join the pool. They are appended
 * rather than blended because the picker lists them in their own section
 * anyway; what this call is for is the *suggested* built-ins beside them. They
 * carry no `pool`, so spectrumInPool keeps every one of them — see there.
 */
export function pickSpectra(
  rng = Math.random,
  { count = 3, exclude = null, extra = [], pool = null } = {},
) {
  const all = [...SPECTRA, ...extra].filter(Boolean);
  const inPool = all.filter((s) => spectrumInPool(s, pool));
  const eligible = inPool.length ? inPool : all;
  const kept = eligible.filter((s) => s.id !== exclude);
  const from = kept.length ? kept : eligible;
  const out = [];
  const rest = [...from];
  while (out.length < count && rest.length) {
    const i = Math.min(rest.length - 1, Math.floor(rng() * rest.length));
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

// --- player-written spectra --------------------------------------------------
//
// A stored custom is TWO STRINGS AND ONE BOOLEAN. No arrays, no nesting, and
// nothing that can legitimately be empty — which is deliberate, because this
// object travels through RTDB inside the round, and every one of CLAUDE.md's
// storage traps is about a shape Realtime Database declines to store. Keep it
// this flat and none of them apply.

// The AniFake submitClue idiom — trim, collapse runs of whitespace, truncate —
// plus the uppercase the built-ins are written in, so a written spectrum reads
// identically to a shipped one beside it on the picker.
const clean = (text, max) => (text || '')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, max)
  .toUpperCase();

/**
 * Repairs a draft into the stored shape, or returns null if there is nothing
 * worth storing.
 *
 * BOTH labels are required. A spectrum naming one end is not a spectrum — the
 * dial would render a blank cap, and the psychic would be clueing a direction
 * the guessers cannot see. Returning null rather than defaulting the missing
 * half is what lets the editor disable its own save button on the same call it
 * uses to preview the result.
 *
 * Runs on every READ as well as every write (see useCustomSpectra), so an entry
 * saved by an older build is repaired with no migration flag.
 */
export function normalizeCustomSpectrum(draft) {
  const leftLabel = clean(draft?.leftLabel, MAX_LABEL_LEN);
  const rightLabel = clean(draft?.rightLabel, MAX_LABEL_LEN);
  if (!leftLabel || !rightLabel) return null;
  return {
    // Keeping an existing id is what makes the editor's save an UPDATE rather
    // than a duplicate — the same reason normalizeCustomPrompt keeps one.
    id: draft?.id || `custom_${Date.now().toString(36)}`,
    leftLabel,
    rightLabel,
    custom: true,
  };
}

/**
 * Hydrates a stored custom into something the dial can render.
 *
 * Barely does anything today — a spectrum is already only two labels, so unlike
 * anirank's customAxis there is no prompt sentence to build. It exists so that
 * getSpectrum has one branch per shape and a future field (a colour, a hint)
 * lands here rather than in six screens. Falls back to a built-in rather than
 * returning null, because getSpectrum's contract is that it never does.
 */
export function customSpectrum(saved) {
  return normalizeCustomSpectrum(saved) ?? BY_ID.get(DEFAULT_SPECTRUM_ID);
}
