// The pool a clue card is drawn from, in the two modes that deal one.
//
// A WRAPPER OVER anirank/utils/deck.js, DELIBERATELY NOT A FORK. AniFake forked
// that module because it needed different fields and a fame ladder over them;
// the header there says a fork is right when two things are about to diverge.
// Nothing diverges here: AniWave wants the same { id, title, subtitle, imageUrl }
// card, off the same collapse rules, for the same two pools. Copying
// franchise-folding, the folded-name character key and the portrait-beats-no-
// portrait preference would be three non-obvious rules to keep in sync forever,
// and a divergence in any of them means a card that IS the same show reads as a
// different one between two games on one device.
//
// The cost, stated rather than discovered later: AniWave now depends on
// AniRank's deck module, and a change to that card shape breaks this. That is
// the trade — a loud break over a silent drift. Cross-game imports are already
// precedented (OnlineGame.jsx renders AniGuess's WaitingScreen).
//
// AniWave never draws cards in the default mode, so nothing here runs at all
// unless `clueMode` has been changed. See prefs.js.
import { eligibleItems } from '../../anirank/utils/deck';
import { shuffle } from '../../../shared/utils/random';
import { rankSuggestions } from '../../../shared/utils/guessSuggest';

// Probes, not axes anyone plays — the same trick deck.js itself uses for
// opinionPoolCounts, and the reason this wrapper is three lines rather than two
// hundred. `kind` and `items` are the only fields eligibleItems reads, and
// getAxis hands back an object that already carries them; an OPINION kind
// applies no value filter, so every show and every character is eligible, which
// is exactly what a clue card wants. A real axis id would work too and is worse:
// it would make AniWave silently break the day somebody renames 'fight'.
const POOL = {
  shows: { kind: 'opinion', items: 'shows' },
  characters: { kind: 'opinion', items: 'characters' },
};

export const CARD_POOLS = ['characters', 'shows'];

// The floor both card modes are gated on, for two different reasons that happen
// to land on the same number.
//
// `readroom` deals one card a round, so below this a session repeats itself and
// the shuffle reads as broken. `cards` searches instead of dealing, so it has no
// such arithmetic — but a search box over eight things is not a search, it is a
// list with a text box in front of it, and the psychic would do better being
// shown the eight. Twelve is small enough that a modest shared list still plays.
export const MIN_CARD_POOL = 12;

// How many cards get dealt at once. `readroom` takes one — there is nothing to
// choose between when the card is the thing being judged — and BROWSE_SIZE below
// takes five, which is what is left of the hand `cards` mode used to be dealt.
export const HAND_SIZE = 5;

// How many cards the search box shows before anything is typed.
//
// A search box is a worse cold start than a hand was: a psychic who has never
// looked at the shared list has nothing to type. So the empty state is a handful
// of eligible cards, drawn the same way the old hand was. It is NOT a hand — the
// psychic is not restricted to it, it does not reroll, and nothing about it
// reaches the room — it is the list with no query in it.
export const BROWSE_SIZE = 5;

// How many matches the typeahead offers. Eight is rankSuggestions' own default
// and what AniGuess shows; named here so the two cannot drift apart quietly.
export const SEARCH_LIMIT = 8;

export const poolNoun = (pool) => (pool === 'shows' ? 'shows' : 'characters');

/**
 * Every card the table could be dealt.
 *
 * `sharedOnly` means the same thing it does everywhere else: keep only entries
 * every seated player has. It matters more here than in most modes — a clue card
 * only the psychic has seen makes the round a guaranteed blind guess for
 * everyone else, and in `readroom` it is worse, since the guessers are being
 * asked what the psychic thinks about something they cannot picture.
 */
export function eligibleCards(players, { pool = 'characters', sharedOnly = true } = {}) {
  return eligibleItems(players, { axis: POOL[pool] ?? POOL.characters, sharedOnly });
}

/**
 * The psychic's hand, or in `readroom` the single card everyone will see.
 *
 * `exclude` is the ids already played this session. Without it a small shared
 * pool repeats a card within a few rounds, which at the table reads as the
 * shuffle being broken rather than as the pool being short — the same reason
 * pickSpectrum takes an exclude. Falls back to ignoring it rather than dealing
 * nothing once everything has been played: a repeat late in a long session is a
 * far better outcome than a round that cannot start.
 *
 * Returns fewer than `size` when the pool is short. Callers gate on
 * MIN_CARD_POOL before starting, so this is the already-degraded path.
 */
export function dealHand(players, {
  pool = 'characters', sharedOnly = true, exclude = [], size = 5, rng = Math.random,
} = {}) {
  const all = eligibleCards(players, { pool, sharedOnly });
  const skip = new Set(exclude ?? []);
  const fresh = all.filter((c) => !skip.has(c.id));
  const from = fresh.length ? fresh : all;
  // Only the four fields the card renders. eligibleItems also stamps `value`,
  // which is null on an opinion axis and would ride into RTDB as a key that
  // means nothing here — and normalizeRound would drop it anyway.
  return shuffle(from, rng).slice(0, size).map((c) => ({
    id: c.id,
    title: c.title,
    subtitle: c.subtitle || '',
    imageUrl: c.imageUrl || '',
  }));
}

/**
 * Every card the psychic may search up this round, minus the ones already
 * played this session.
 *
 * NAMED HERE RATHER THAN INLINED IN TWO HOOKS, for the reason `dealHand` takes
 * an `exclude` rather than leaving each caller to filter: the local hook and the
 * online one would otherwise each decide separately what "already played" means,
 * and a search that offers last round's card back reads at the table as the game
 * being broken rather than as the pool being short.
 *
 * Unlike `dealHand` there is no fallback to the unfiltered pool. A hand that
 * came back empty would be a round that cannot start; a search list that comes
 * back empty is a round the psychic can still play the moment they widen the
 * pool, and silently re-offering a played card is the worse outcome. In practice
 * MIN_CARD_POOL keeps this far from empty.
 */
export function searchableCards(players, {
  pool = 'characters', sharedOnly = true, exclude = [],
} = {}) {
  const skip = new Set(exclude ?? []);
  return eligibleCards(players, { pool, sharedOnly })
    .filter((c) => !skip.has(c.id))
    .map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle || '',
      imageUrl: c.imageUrl || '',
    }));
}

/**
 * The cards matching a query, best first.
 *
 * A THIN ADAPTER OVER shared/utils/guessSuggest.js, never a second ranker.
 * Combobox's header asks for exactly this — convert a fourth typeahead onto the
 * shared shell rather than adding a fourth copy — and the ranking is the half
 * that had drifted between AniGuess's two screens before it was extracted. What
 * that module wants is `{ name, series }`; what a clue card carries is
 * `{ title, subtitle }`, which for a character IS name-and-series and for a show
 * is a title and an empty string. So the mapping is a rename, and the whole
 * adapter is this function.
 *
 * `card` rides along on each row so the caller gets the card back rather than
 * having to look it up by a name that has just been folded.
 */
export function rankCards(cards, query, limit = SEARCH_LIMIT) {
  const rows = (cards ?? []).map((card) => ({
    name: card.title,
    series: card.subtitle || '',
    imageUrl: card.imageUrl || '',
    card,
  }));
  return rankSuggestions(rows, query, limit).map((row) => row.card);
}

/**
 * A few cards to show before anything has been typed. See BROWSE_SIZE.
 *
 * Takes the already-searchable pool rather than the roster, so it inherits the
 * played-card exclusion and the sharedOnly filter instead of re-deciding them —
 * the strip and the search results must never disagree about what is offerable.
 *
 * Reaches Math.random, so callers draw it ONCE (a lazy useState initializer, the
 * way SpectrumPicker draws its three): computing it in a render body redraws the
 * strip on every keystroke elsewhere on the screen.
 */
export function browseCards(cards, rng = Math.random) {
  return shuffle(cards ?? [], rng).slice(0, BROWSE_SIZE);
}
