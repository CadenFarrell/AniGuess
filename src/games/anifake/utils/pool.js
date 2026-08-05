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

/**
 * The round's secret.
 *
 * Two biases, in order, and both are about whether the round is playable at
 * all rather than about fairness:
 *
 *   1. A lead. A background character nobody at the table can say anything
 *      about makes every clue meaningless and the fake impossible to catch.
 *      `role` is on every stored character regardless of import vintage —
 *      unlike `favourites`, which only arrived with the stats — so this
 *      degrades to "random" rather than to "nothing" on an old profile.
 *   2. One with genres. Without them hintFor returns null and the blind fake
 *      is dealt a blank, so a pool holding even one hintable lead should use it.
 *
 * Preference, not a filter: a pool where nothing qualifies still returns a
 * character, because refusing to deal is worse than dealing an awkward one.
 */
export function pickSecret(pool, { rng = Math.random } = {}) {
  const entries = pool ?? [];
  if (!entries.length) return null;
  const tiers = [
    entries.filter((e) => isMain(e) && hasHint(e)),
    entries.filter((e) => isMain(e)),
    entries.filter((e) => hasHint(e)),
    entries,
  ];
  const tier = tiers.find((t) => t.length) ?? entries;
  return tier[Math.floor(rng() * tier.length)];
}

/**
 * The character handed to a decoy-mode fake instead of the secret.
 *
 * One from the same show is a far better bluff than a random one — the fake's
 * clues land in the right neighbourhood without them knowing why. Falls back to
 * any other entry when the secret's show contributed only one character.
 *
 * Returns null when the pool holds nothing else, which is why decoy mode's
 * minimum pool is two: a fake dealt null would sit on "Waiting for the deal…".
 */
export function pickDecoy(pool, secret, { rng = Math.random } = {}) {
  const others = (pool ?? []).filter((e) => e?.id !== secret?.id);
  if (!others.length) return null;
  const sameSeries = secret?.series
    ? others.filter((e) => e.series === secret.series)
    : [];
  const tier = sameSeries.length ? sameSeries : others;
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
