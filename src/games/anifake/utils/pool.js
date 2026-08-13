// The characters a round can draw from, and every "which one" question asked at
// deal time. Pure and offline: every field it reads is already on a saved
// profile, so local play touches no network — the property CLAUDE.md asks
// callers to preserve.
//
// Entry shape, which rules.js and SecretCard both take as given:
//
//   { id, name, series, imageUrl, role, favourites, genres }
//
// `genres` is here for one reason: it is the fake's entire hand. In blind mode
// the fake is dealt one genre and nothing else, so a pool entry that dropped
// genres — as this module's board-shaped ancestor did — makes the hint
// underivable and the mode unplayable.
//
// Deliberately NOT anirank/utils/deck.js. That module computes the same
// "entries every player has" set, but it is welded to the axis system — it
// stamps a `value` from axis.valueFor, drops anything without one, and breaks
// ties by that value. Nothing here ranks anything, so serving both would mean
// parameterizing three things to gain one caller.
import { characterNameKey, normalizeCharacter } from '../../../shared/utils/character';
import { DEFAULT_FAME_ID, getFame } from '../fame';

// Which of two copies of the same character to keep. The highest favourites
// count is the one mergeCharacterEdges already settled on across seasons, and a
// copy with a portrait beats one without, since the card is mostly the
// portrait. Applied BOTH within one profile and across profiles — two players
// can hold the same character at different import vintages, and picking by
// favourites alone there would let a portrait-less copy win.
//
// Genres rank above favourites for the same reason they are on the entry at
// all: the two shapes stored data comes in (an AniList `genres` array, a
// ListManager singular `genre`) mean one player's copy of a character can carry
// genres while another's carries none, and the copy with none deals the fake a
// blank.
function preferred(existing, candidate) {
  if (!existing) return candidate;
  if (!existing.imageUrl && candidate.imageUrl) return candidate;
  if (existing.imageUrl && !candidate.imageUrl) return existing;
  if (!existing.genres.length && candidate.genres.length) return candidate;
  if (existing.genres.length && !candidate.genres.length) return existing;
  return (candidate.favourites ?? 0) > (existing.favourites ?? 0) ? candidate : existing;
}

// One entry per character, keyed by folded name so the same person listed under
// three season titles is one card — the same identity rule AniGuess and AniRank
// use, and the reason ids are not used (AniList ids and the Date.now() ids
// ListManager creates share no id space).
//
// That folded name is also what `id` holds, which is what makes it the key
// rules.deriveTruth groups published cards by. There is no board to index into
// anymore, so the name IS the identity end to end.
function collapseCharacters(animeList) {
  const byName = new Map();
  for (const anime of animeList || []) {
    for (const raw of anime.characters || []) {
      // normalizeCharacter first, so the ListManager singular `genre` string is
      // already an array by the time anything here reads it.
      const char = normalizeCharacter(raw);
      const key = characterNameKey(char?.name);
      if (!key) continue;
      byName.set(key, preferred(byName.get(key), {
        id: key,
        name: char.name,
        series: anime.title || '',
        imageUrl: char.imageUrl || '',
        role: char.role || '',
        favourites: char.favourites ?? 0,
        genres: char.genres ?? [],
      }));
    }
  }
  return byName;
}

/**
 * The characters eligible for a round.
 *
 * sharedOnly keeps only characters every player has. That is not a nicety here
 * the way it is in AniRank: the whole table gives clues about one character, so
 * a card only one player has seen makes the round unplayable for everyone else
 * AND unfalsifiable for the fake.
 */
export function eligibleCharacters(players, { sharedOnly = true } = {}) {
  if (!players?.length) return [];

  const counts = new Map(); // key -> { entry, owners }
  for (const player of players) {
    for (const [key, entry] of collapseCharacters(player.animeList)) {
      if (!counts.has(key)) counts.set(key, { entry, owners: new Set() });
      const slot = counts.get(key);
      slot.owners.add(player.id);
      slot.entry = preferred(slot.entry, entry);
    }
  }

  return [...counts.values()]
    .filter((c) => !sharedOnly || c.owners.size === players.length)
    .map((c) => c.entry);
}

// --- picking ---------------------------------------------------------------

const isMain = (entry) => /main/i.test(entry?.role || '');
const hasHint = (entry) => Boolean(entry?.genres?.length);

// How much of a pool has to carry a favourites count before the fame question
// is worth asking at all.
//
// Below this the quantile is a quantile of a handful: measure 20 of 199 entries
// and "Iconic" cuts the top 15% OF THE 20, so the round deals from three
// characters forever. That is not what the label on the control says, and the
// reason it happens is that `favourites ?? 0` makes *missing* and *genuinely
// unpopular* the same value — so an unmeasured character reads as "nobody has
// heard of them" rather than "we don't know".
//
// A half is the point where the answer describes most of the pool rather than a
// sample of it. Anything stricter would switch the feature off for tables that
// can genuinely use it.
export const MIN_FAME_COVERAGE = 0.5;

// Below this many qualifying characters the setting technically works and plays
// badly: the same face every round. Not a floor the code enforces — see
// famousCount, which exists so the setup screen can say so and let the table
// decide.
export const MIN_FAME_POOL = 8;

/**
 * The favourites count an entry has to reach to count as famous, or null when
 * the question cannot be answered.
 *
 * Two things make an answer impossible, and both return null so that everything
 * downstream has exactly one degraded path to handle rather than three:
 *
 *   1. Nothing carries a count — every entry predates the stats.
 *   2. Too few do. See MIN_FAME_COVERAGE.
 *
 * The quantile itself is taken over ONLY the entries carrying a count, which is
 * the other half of the same problem: collapseCharacters writes
 * `favourites: char.favourites ?? 0`, so ranking the whole pool would put the
 * median at 0 on any half-old list and `fav >= 0` would qualify everybody.
 *
 * Null then means pickSecret skips the fame term and the role ladder runs
 * untouched. That is the AniRank release-year bug — a feature keying on a stat
 * absent from older profiles shipped dealing zero cards — avoided by
 * construction rather than by a guard someone can forget.
 */
export function fameFloor(pool, quantile) {
  if (quantile == null) return null;
  const entries = pool ?? [];
  const counts = [];
  for (const entry of entries) {
    const n = entry?.favourites ?? 0;
    if (n > 0) counts.push(n);
  }
  if (!counts.length) return null;
  if (counts.length < entries.length * MIN_FAME_COVERAGE) return null;
  counts.sort((a, b) => a - b);
  // Nearest-rank, clamped by construction: index 0 is the smallest count, so
  // quantile 0 is "anything with a count" and 1 is "only the very top".
  return counts[Math.floor((counts.length - 1) * quantile)];
}

// Whether a pool can answer the fame question at all. Defined in terms of
// fameFloor rather than beside it, so the setup screen's warning and the pick
// itself can never disagree about what "no data" means — including the coverage
// rule, which this inherits for free rather than restating.
export const hasFameSignal = (pool) => fameFloor(pool, 0) != null;

// Whether ANY entry carries a count, ignoring the coverage rule. The only
// caller is the warning copy, which has to tell the two dead ends apart:
// importing more lists fixes a pool that is partly measured and does nothing
// for one where the trait was never fetched. Not a substitute for
// hasFameSignal — this one says nothing about whether the pick will use fame.
export const hasAnyFameData = (pool) => (pool ?? []).some((e) => (e?.favourites ?? 0) > 0);

/**
 * How many characters a fame level actually leaves to draw from.
 *
 * Zero when the term is inactive (level `any`, or a pool that cannot answer),
 * which reads correctly as "this is not narrowing anything".
 *
 * The setup screens render this because the count is the only way to see that a
 * level is too aggressive for the lists in the room: "Iconic" over a dozen
 * shared characters is a famous set of two, which is a perfectly valid answer to
 * the question and a bad round to sit through. Deliberately NOT enforced — the
 * screen says so and the table chooses, because silently overriding a setting
 * someone just picked is what makes one feel broken.
 */
export function famousCount(pool, fame = DEFAULT_FAME_ID) {
  const entries = pool ?? [];
  const floor = fameFloor(entries, getFame(fame).quantile);
  if (floor == null) return 0;
  return entries.filter((e) => (e?.favourites ?? 0) >= floor).length;
}

// How playable an entry is, as one number. The three terms replace what used to
// be a four-tier ladder ([main&&hint, main, hint, all], first non-empty wins),
// and reproduce it exactly: with s = 2*isMain + hasHint, the old tier 1 is
// {s===3}; tier 2 is only ever reached when tier 1 is empty, so it is {s===2};
// tier 3 only when no main exists at all, so {s===1}; tier 4 only when nothing
// is main and nothing is hintable, so {s===0}. "First non-empty tier" and
// "highest score" are therefore the same set, for every input.
//
// The fame term is weighted 4 — strictly more than the other two combined — on
// purpose. At 3 a famous nobody would TIE an unknown hintable lead and the tie
// would be settled by chance rather than by rule. At 4 fame dominates, which
// makes "filter to the famous, then run the old ladder inside that" and this one
// score the same function, and makes the degradation automatic with no branch:
// a null floor zeroes every fame term, the max lands in 0..3, and the original
// ladder runs untouched.
//
// Fame outranking role is the deliberate part. A famous supporting character is
// easier to say something about than an obscure lead, which is the entire
// complaint this setting answers; `role` was only ever a proxy for it, chosen
// because it is present regardless of import vintage.
const scoreOf = (entry, floor) => (
  (floor != null && (entry?.favourites ?? 0) >= floor ? 4 : 0)
  + (isMain(entry) ? 2 : 0)
  + (hasHint(entry) ? 1 : 0)
);

// The highest-scoring entries, as a set to draw uniformly from. A plain loop
// rather than Math.max(...scores): a shared-list pool runs to thousands of
// entries, and spreading one of those into an argument list blows the stack.
function bestOf(entries, floor) {
  let best = -1;
  for (const entry of entries) {
    const s = scoreOf(entry, floor);
    if (s > best) best = s;
  }
  return entries.filter((e) => scoreOf(e, floor) === best);
}

/**
 * The round's secret.
 *
 * Three biases, in order, and all three are about whether the round is playable
 * at all rather than about fairness:
 *
 *   1. Someone the table has actually heard of, per `fame` — see scoreOf.
 *   2. A lead. A background character nobody can say anything about makes every
 *      clue meaningless and the fake impossible to catch.
 *   3. One with genres. Without them hintFor returns null and the blind fake is
 *      dealt a blank, so a pool holding even one hintable lead should use it.
 *
 * Preference, not a filter, at every level: a pool where nothing qualifies still
 * returns a character, because refusing to deal is worse than dealing an
 * awkward one.
 *
 * `exclude` is for the redeal — a re-roll must not hand back a card somebody at
 * the table is already holding. Same shape as aniguess's pickRandomCharacter:
 * a preference with a fallback, so excluding the only entry deals it anyway
 * rather than returning null and stranding the round on "Waiting for the deal…".
 */
export function pickSecret(pool, { fame = DEFAULT_FAME_ID, exclude = [], rng = Math.random } = {}) {
  const entries = pool ?? [];
  if (!entries.length) return null;
  const kept = exclude?.length ? entries.filter((e) => !exclude.includes(e?.id)) : entries;
  const candidates = kept.length ? kept : entries;
  // Over the candidates, not the raw pool: excluding the one famous entry should
  // re-derive a floor from what is actually drawable, not leave the famous set
  // empty and silently drop back to the role ladder.
  const floor = fameFloor(candidates, getFame(fame).quantile);
  const tier = bestOf(candidates, floor);
  return tier[Math.floor(rng() * tier.length)];
}

/**
 * The character handed to a decoy-mode fake instead of the secret.
 *
 * One from the same show is a far better bluff than a random one — the fake's
 * clues land in the right neighbourhood without them knowing why. Falls back to
 * any other entry when the secret's show contributed only one character.
 *
 * Fame applies here too: an obscure decoy makes the fake's clues useless and
 * gets them caught for a reason that has nothing to do with how they played.
 * Applied inside the same-show set rather than before it, because the show is
 * the stronger of the two effects.
 *
 * Returns null when the pool holds nothing else, which is why decoy mode's
 * minimum pool is two: a fake dealt null would sit on "Waiting for the deal…".
 */
export function pickDecoy(pool, secret, { fame = DEFAULT_FAME_ID, exclude = [], rng = Math.random } = {}) {
  const others = (pool ?? []).filter((e) => e?.id !== secret?.id);
  if (!others.length) return null;
  const kept = exclude?.length ? others.filter((e) => !exclude.includes(e?.id)) : others;
  const candidates = kept.length ? kept : others;
  const sameSeries = secret?.series
    ? candidates.filter((e) => e.series === secret.series)
    : [];
  const pickFrom = sameSeries.length ? sameSeries : candidates;
  const tier = bestOf(pickFrom, fameFloor(pickFrom, getFame(fame).quantile));
  return tier[Math.floor(rng() * tier.length)];
}

/**
 * The blind fake's whole hand: one genre off the secret's show.
 *
 * Returns null — not a filler word — when the character carries no genres, so
 * the screen can say "nothing on file" out loud. Same call anirank/axes.js's
 * valueFor makes for a show missing the stat it ranks by: a missing value is
 * "not eligible", never a silent zero, because a fabricated hint sends the fake
 * somewhere the clues will never go and looks like the game lying to them.
 */
export function hintFor(entry, { rng = Math.random } = {}) {
  const genres = entry?.genres ?? [];
  if (!genres.length) return null;
  return genres[Math.floor(rng() * genres.length)];
}
