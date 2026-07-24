// Pure helpers for turning players' anime lists into a pool of AniTune
// questions. No network and no imports beyond title normalisation, so the
// filtering rules can be exercised directly.
import { normalizeTitle } from '../../../shared/utils/ranking';

/**
 * The anime eligible to be asked about.
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
 */
export function getEligibleAnimeList(players, { sharedSongsOnly = true } = {}) {
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
  const kept = sharedSongsOnly
    ? entries.filter((e) => e.owners.size === players.length)
    : entries;

  return kept.map((e) => e.anime);
}

// True when a shared-songs game is actually playable — the UI needs this to
// explain why Start is disabled, the same way PlayerSetup does for AniGuess.
export function hasSharedAnime(players) {
  return getEligibleAnimeList(players, { sharedSongsOnly: true }).length > 0;
}

// Picks the audio to use for one theme. A theme can have several entries
// (TV size, creditless, alternate versions) and each entry several videos.
// Prefer the lowest version number — the original — and skip anything flagged
// spoiler or NSFW, since a quiz shows these unprompted.
export function pickAudioForTheme(theme, { allowSpoilers = false, allowNsfw = false } = {}) {
  const entries = [...(theme?.animethemeentries || [])]
    .filter((e) => (allowSpoilers || !e.spoiler) && (allowNsfw || !e.nsfw))
    .sort((a, b) => (a.version ?? 1) - (b.version ?? 1));

  for (const entry of entries) {
    for (const video of entry.videos || []) {
      if (video?.audio?.link) return { link: video.audio.link, entry, video };
    }
  }
  return null;
}

/**
 * Flattens resolved anime + their fetched themes into playable questions.
 *
 * `resolvedAnime` is [{ entry, resolved, themes }] where `entry` is the
 * profile anime entry, `resolved` is the AnimeThemes match, and `themes` is
 * that anime's animethemes array.
 *
 * Returns [{ id, animeTitle, displayTitle, slug, themeSlug, type, sequence,
 *            songTitle, audioUrl, year }]
 */
export function buildQuestionPool(resolvedAnime, {
  includeOpenings = true,
  includeEndings = true,
  allowSpoilers = false,
  allowNsfw = false,
} = {}) {
  const questions = [];

  for (const { entry, resolved, themes } of resolvedAnime) {
    if (!resolved || !themes?.length) continue;

    for (const theme of themes) {
      if (theme.type === 'OP' && !includeOpenings) continue;
      if (theme.type === 'ED' && !includeEndings) continue;

      const audio = pickAudioForTheme(theme, { allowSpoilers, allowNsfw });
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
        audioUrl: audio.link,
        year: resolved.year,
      });
    }
  }

  return questions;
}

// Fisher-Yates. Takes a seedable rng so a room can deal the same order to
// every player from a shared seed later.
export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Builds the round list. Caps how many questions come from any one anime so a
 * 25-theme show like Naruto cannot swallow the round.
 */
export function pickRound(questions, { count = 10, maxPerAnime = 2, rng = Math.random } = {}) {
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

  return picked;
}
