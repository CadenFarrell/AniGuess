// Pure helpers for turning players' anime lists into a pool of AniTune
// questions. No network and no imports beyond title normalisation, so the
// filtering rules can be exercised directly.
import { normalizeTitle } from '../../../shared/utils/ranking';
import { shuffle } from '../../../shared/utils/random';
import { filterByPopularity, DEFAULT_POPULARITY_ID } from './popularity';

// Re-exported so this module's own callers and tests keep one import site;
// the implementation moved to shared/ when AniRank needed it too.
export { shuffle };

// The bounds of the release-year dial. Sentinels rather than nulls so the two
// setup screens can drive it with a pair of plain NumberInputs, and so "the
// range is untouched" is a comparison anyone can make (see yearRangeIsOpen).
// The floor is below the oldest thing AnimeThemes carries; the ceiling is far
// enough out that it never needs revisiting.
export const YEAR_MIN = 1960;
export const YEAR_MAX = 2100;

// Where in a song a clip starts, as a fraction of the playable range. Both clip
// players map fraction -> seconds the same way, so this is the only place the
// choice is made.
//
// 'random' avoids the first fifth deliberately: the opening seconds of a theme
// are often silence or a fade-in, which is a clip of nothing. Someone who picks
// 'start' has asked for exactly that stretch, so they get 0 and no fudging.
export const SAMPLE_POINTS = [
  { id: 'random', label: 'Random', blurb: 'Anywhere in the middle of the song.' },
  { id: 'start', label: 'From the start', blurb: 'The intro. Easiest — it is the bit everyone knows.' },
  { id: 'middle', label: 'The middle', blurb: 'Straight into the chorus, usually.' },
];
export const DEFAULT_SAMPLE_POINT = 'random';

function sampleFraction(samplePoint, rng) {
  if (samplePoint === 'start') return 0;
  if (samplePoint === 'middle') return 0.5;
  return 0.2 + rng() * 0.5;
}

// AniList stores a FuzzyDate; the 1900 floor rejects its placeholder dates, not
// genuinely old anime. Same rule anirank/axes.js's release-year axis uses — and
// the same reason: a stat that is absent has to read as "not eligible", never as
// a silent zero.
function releaseYear(anime) {
  const year = Number(anime?.startDate?.year);
  return Number.isFinite(year) && year > 1900 ? year : null;
}

// Whether the year dial is doing anything. Load-bearing rather than tidy: while
// the range is untouched, shows with no stored date must stay in the pool, and
// the moment it is narrowed they cannot be judged and have to go. Deciding that
// by "is the filter on" instead of per-show keeps a pre-stats profile playable.
export function yearRangeIsOpen(from, to) {
  return (from ?? YEAR_MIN) <= YEAR_MIN && (to ?? YEAR_MAX) >= YEAR_MAX;
}

/**
 * The anime eligible to be asked about, each with the players who own it.
 *
 * sharedSongsOnly is deliberately stricter than AniGuess's sharedShowsOnly.
 * There, one player is the guesser and the rest answer questions, so a show
 * only needs *one other* player to know it. Here everyone hears the same clip
 * and guesses at once, so a show is only fair if *every* player has it —
 * otherwise someone is guaranteed to be guessing blind.
 *
 * With the toggle off, the pool is the union of everyone's lists.
 * Either way entries are deduped by normalised title, since the same show can
 * appear in several players' lists under slightly different spellings.
 *
 * `owners` was always computed here and thrown away at the return. It is the
 * reveal's "whose list did this come from" line — AMQ calls it rig — and it is
 * the cheapest social hook in the game, so it now comes out with the anime.
 */
export function eligibleEntries(players, {
  sharedSongsOnly = true,
  popularity = DEFAULT_POPULARITY_ID,
  yearFrom = YEAR_MIN,
  yearTo = YEAR_MAX,
} = {}) {
  if (!players?.length) return [];

  const byTitle = new Map();
  for (const player of players) {
    for (const anime of player.animeList || []) {
      const key = normalizeTitle(anime.title);
      if (!key) continue;
      if (!byTitle.has(key)) byTitle.set(key, { anime, owners: new Set() });
      byTitle.get(key).owners.add(player.id);
    }
  }

  const entries = [...byTitle.values()];
  let kept = sharedSongsOnly
    ? entries.filter((e) => e.owners.size === players.length)
    : entries;

  if (!yearRangeIsOpen(yearFrom, yearTo)) {
    kept = kept.filter((e) => {
      const year = releaseYear(e.anime);
      return year != null && year >= (yearFrom ?? YEAR_MIN) && year <= (yearTo ?? YEAR_MAX);
    });
  }

  // filterByPopularity ranks the anime themselves, so hand it those and map the
  // survivors back. It returns its input untouched when the pool cannot answer
  // the popularity question at all, which is what keeps a pre-stats profile from
  // playing a round of nothing.
  const animeKept = new Set(filterByPopularity(kept.map((e) => e.anime), popularity));
  return kept
    .filter((e) => animeKept.has(e.anime))
    .map((e) => ({ anime: e.anime, owners: [...e.owners] }));
}

// The same pool without the ownership, for every caller that only wants a count
// or a list. Defined in terms of eligibleEntries so the two can never disagree
// about what "eligible" means.
export function getEligibleAnimeList(players, options = {}) {
  return eligibleEntries(players, options).map((e) => e.anime);
}

// The "N shows in play" readout both setup screens print. A settings object is a
// valid options object — the pool keys are named identically on purpose — so
// this is deliberately thin; it exists so the two screens cannot count
// differently from each other or from what prepareQuestions will deal.
export function eligibleCount(players, settings) {
  return eligibleEntries(players, settings ?? {}).length;
}

// True when a shared-songs game is actually playable — the UI needs this to
// explain why Start is disabled, the same way PlayerSetup does for AniGuess.
// Deliberately asks only the shared-lists question: a Start button greyed out by
// the popularity dial should say so in the dial's own words, not here.
export function hasSharedAnime(players) {
  return getEligibleAnimeList(players, { sharedSongsOnly: true }).length > 0;
}

/**
 * Picks the audio to use for one theme.
 *
 * A theme can have several entries (alternate versions, tied to different
 * episode ranges) and each entry several videos. Prefer the lowest version
 * number — the original.
 *
 * **It deliberately ignores each entry's `spoiler` and `nsfw` flags.** Those
 * describe the entry's *video*, and AnimeThemes is a video archive where the
 * .ogg is a derived asset — so the flags say nothing about the sound. The proof
 * is in the data: Bakemonogatari ED1 has three entries with different `spoiler`
 * values all pointing at the identical `Bakemonogatari-ED1.ogg`. A flag that
 * separates byte-identical audio is not describing audio.
 *
 * This used to filter on them, on the reasoning that "a quiz shows these
 * unprompted" — which was true of a video quiz and was never true of this one.
 * Measured over 71 themes, the filter dropped 8 of them (11%) to no playable
 * song at all, Kill la Kill's "Sirius" among them, and changed which audio file
 * was chosen in exactly **zero** cases. It could only ever subtract.
 *
 * If AniTune ever renders video, the flags become meaningful again and belong on
 * whatever picks the video — not here.
 */
export function pickAudioForTheme(theme) {
  const entries = [...(theme?.animethemeentries || [])]
    .sort((a, b) => (a.version ?? 1) - (b.version ?? 1));

  for (const entry of entries) {
    for (const video of entry.videos || []) {
      if (video?.audio?.link) return { link: video.audio.link, entry, video };
    }
  }
  return null;
}

// A song's performers, as plain names. AnimeThemes returns an artists array on
// the song when asked for it in the include; a theme with none (a lot of older
// entries, and anything credited to the show itself) yields an empty array
// rather than null, so the reveal has one shape to render.
function artistNames(song) {
  return (song?.artists || []).map((a) => a?.name).filter(Boolean);
}

/**
 * Flattens resolved anime + their fetched themes into playable questions.
 *
 * `resolvedAnime` is [{ entry, resolved, themes, owners }] where `entry` is the
 * profile anime entry, `resolved` is the AnimeThemes match, `themes` is that
 * anime's animethemes array, and `owners` names the players whose lists it came
 * from.
 */
export function buildQuestionPool(resolvedAnime, {
  includeOpenings = true,
  includeEndings = true,
} = {}) {
  const questions = [];

  for (const { entry, resolved, themes, owners } of resolvedAnime) {
    if (!resolved || !themes?.length) continue;

    for (const theme of themes) {
      if (theme.type === 'OP' && !includeOpenings) continue;
      if (theme.type === 'ED' && !includeEndings) continue;

      const audio = pickAudioForTheme(theme);
      if (!audio) continue;

      questions.push({
        id: `${resolved.slug}:${theme.slug}`,
        // The answer is judged against the player's own title, so the guess
        // input can autocomplete from their list rather than romaji they may
        // never have seen.
        animeTitle: entry.title,
        displayTitle: resolved.name,
        slug: resolved.slug,
        themeSlug: theme.slug,
        type: theme.type,
        sequence: theme.sequence,
        songTitle: theme.song?.title || null,
        artists: artistNames(theme.song),
        audioUrl: audio.link,
        // Prefer the stored profile art over anything else: it costs no extra
        // request, and it is the image the player already associates with the
        // show from every other screen in the arcade.
        coverImageUrl: entry.coverImageUrl || null,
        // The year AnimeThemes has, falling back to the profile's own stat —
        // an older profile may carry a date for a show AnimeThemes dates as
        // null, and vice versa.
        year: resolved.year ?? releaseYear(entry),
        owners: owners ?? [],
      });
    }
  }

  return questions;
}

/**
 * Builds the round list. Caps how many questions come from any one anime so a
 * 25-theme show like Naruto cannot swallow the round.
 *
 * Every question is stamped with its own `clipFraction`. That used to be done by
 * the online host alone, while local play let ClipPlayer roll its own offset on
 * every mount — so a local replay could land somewhere else, and the sample-point
 * setting had nowhere to take effect. Dealing it here gives both paths one
 * answer: the clip is a property of the question, not of the player rendering it.
 */
export function pickRound(questions, {
  count = 10,
  maxPerAnime = 2,
  samplePoint = DEFAULT_SAMPLE_POINT,
  rng = Math.random,
} = {}) {
  const perAnime = new Map();
  const picked = [];

  for (const question of shuffle(questions, rng)) {
    const used = perAnime.get(question.slug) || 0;
    if (used >= maxPerAnime) continue;
    perAnime.set(question.slug, used + 1);
    picked.push(question);
    if (picked.length >= count) break;
  }

  // If the cap left us short (few shows, many themes), top up ignoring it
  // rather than returning a stunted round.
  if (picked.length < count) {
    const chosen = new Set(picked.map((q) => q.id));
    for (const question of shuffle(questions, rng)) {
      if (chosen.has(question.id)) continue;
      picked.push(question);
      chosen.add(question.id);
      if (picked.length >= count) break;
    }
  }

  return picked.map((q) => ({ ...q, clipFraction: sampleFraction(samplePoint, rng) }));
}
