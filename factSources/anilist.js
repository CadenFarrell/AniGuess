#!/usr/bin/env node
/* eslint-env node */
// The one fact source implemented today.
//
// The Wikidata-vs-Jikan choice is deliberately still deferred — it is a
// licence-versus-coverage trade that cannot be settled without real clues to aim
// it at. A second source is a second file in this directory exporting the same
// `collect`, and nothing in generateFacts.js changes.
//
// Why AniList is the first source rather than an odd one out: the import
// deliberately shipped only a "cheap tier" of per-show fields, because every
// byte in a profile is a byte in the one localStorage origin every game shares —
// which is why storage.setItem grew a read-back guard and a banner. Staff, voice
// actors, tags and producers are the SAME fact for every player who owns the
// show, so storing them once per profile is the worst available place for them.
// A shared pack is the right one, and this adapter is that move.
import { anilistRequest } from '../src/shared/services/anilistClient.js';
import { subjectKeyForShow, subjectKeyForCharacter } from '../src/shared/utils/facts.js';

// One media per request. The staff and characters connections are both nested,
// and AniList's complexity cap is per query — this is why there is no analogue
// of anilist.js's BATCH_SIZE = 15 aliasing here.
const MEDIA_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english }
    format
    source
    season
    seasonYear
    episodes
    duration
    genres
    tags { name rank isGeneralSpoiler isMediaSpoiler isAdult }
    studios { edges { isMain node { name } } }
    staff(sort: RELEVANCE, perPage: 20) { edges { role node { name { full } } } }
    characters(sort: [ROLE, FAVOURITES_DESC], perPage: 25) {
      edges {
        role
        node { id name { full } gender favourites }
        voiceActors(language: JAPANESE, sort: RELEVANCE) { name { full } }
      }
    }
  }
}`;

const POPULAR_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { id }
  }
}`;

// Staff `role` is free text, so match rather than compare. First match wins:
// the connection is sorted by RELEVANCE, so the first Director listed is the
// one the show is actually credited to rather than a per-episode director.
const STAFF_ROLES = [
  ['director', /^director$/i],
  ['seriesComposition', /series\s*composition/i],
  ['originalCreator', /original\s*(creator|story)/i],
  ['composer', /^music$/i],
];

// Tags below this are minority opinions on a public wiki, and a clue built on
// one is a clue whose answer the table can reasonably dispute.
const TAG_RANK_FLOOR = 60;
const MAX_TAGS = 6;

const filled = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function showRows(key, media) {
  const rows = [];
  const add = (field, value) => { if (value != null) rows.push({ kind: 'show', key, field, value }); };

  const studioEdges = media.studios?.edges ?? [];
  add('studio', filled(studioEdges.find((e) => e.isMain)?.node?.name));
  const producers = studioEdges.filter((e) => !e.isMain).map((e) => filled(e.node?.name)).filter(Boolean);
  if (producers.length) add('producers', producers);

  const staffEdges = media.staff?.edges ?? [];
  for (const [field, pattern] of STAFF_ROLES) {
    const hit = staffEdges.find((e) => pattern.test(e.role || ''));
    add(field, filled(hit?.node?.name?.full));
  }

  add('format', filled(media.format));
  add('source', filled(media.source));
  add('season', filled(media.season));
  add('seasonYear', media.seasonYear ?? null);
  add('episodes', media.episodes ?? null);
  add('duration', media.duration ?? null);

  const genres = (media.genres ?? []).map(filled).filter(Boolean);
  if (genres.length) add('genres', genres);

  // Spoiler tags are excluded rather than merely deprioritised: a clue is read
  // aloud to a table that includes people who have not seen the show.
  const tags = (media.tags ?? [])
    .filter((t) => (t?.rank ?? 0) >= TAG_RANK_FLOOR && !t.isGeneralSpoiler && !t.isMediaSpoiler && !t.isAdult)
    .slice(0, MAX_TAGS)
    .map((t) => filled(t.name))
    .filter(Boolean);
  if (tags.length) add('tags', tags);

  return rows;
}

// Main cast only, and that gate is load-bearing rather than a nicety: voice
// actors are per character per show, so they are the one field that can turn a
// few hundred KB of pack into a few MB. A supporting cast of thirty adds thirty
// rows nobody will ever be asked about.
function characterRows(media, showKey, meta) {
  const rows = [];
  for (const edge of media.characters?.edges ?? []) {
    if (edge.role !== 'MAIN') continue;
    const name = filled(edge.node?.name?.full);
    const key = name && subjectKeyForCharacter(name);
    if (!key) continue;

    // A character in several shows keeps the first name casing seen and unions
    // their appearances, the same collapse a profile does.
    const existing = meta.characters[key];
    if (existing) {
      if (!existing.appearsIn.includes(showKey)) existing.appearsIn.push(showKey);
      continue;
    }
    meta.characters[key] = { anilistId: edge.node?.id ?? null, name, appearsIn: [showKey] };

    rows.push({ kind: 'character', key, field: 'voiceActorJp', value: filled(edge.voiceActors?.[0]?.name?.full) });
    rows.push({ kind: 'character', key, field: 'gender', value: filled(edge.node?.gender) });
    rows.push({ kind: 'character', key, field: 'favourites', value: edge.node?.favourites ?? null });
  }
  return rows;
}

/** The top `limit` anime by popularity, as AniList ids. */
export async function popularIds(limit, { cache, log }) {
  const PER_PAGE = 50;
  const ids = [];
  for (let page = 1; ids.length < limit; page++) {
    const cached = cache.read(`anilist-popular-p${page}.json`);
    const data = cached ?? await anilistRequest(POPULAR_QUERY, { page, perPage: PER_PAGE });
    if (!cached) cache.write(`anilist-popular-p${page}.json`, data);
    const media = data?.Page?.media ?? [];
    ids.push(...media.map((m) => m.id));
    log(`  popularity page ${page} → ${ids.length} ids`);
    if (!data?.Page?.pageInfo?.hasNextPage || media.length === 0) break;
  }
  return ids.slice(0, limit);
}

/**
 * Fetches every subject and returns the rows and the identifying fields.
 *
 * Returns { rows, meta } where meta carries the display casing and the AniList
 * id — provenance only, never identity: the pack is keyed on the same fold a
 * saved profile keys on, so a hand-entered entry with no AniList id still finds
 * its row.
 */
export async function collect(anilistIds, { cache, log }) {
  const rows = [];
  const meta = { shows: {}, characters: {} };
  let done = 0;

  for (const id of anilistIds) {
    done++;
    const file = `anilist-media-${id}.json`;
    const cached = cache.read(file);
    let media = cached?.Media ?? null;

    if (!cached) {
      let data = null;
      try {
        data = await anilistRequest(MEDIA_QUERY, { id });
      } catch (err) {
        log(`  [${done}/${anilistIds.length}] ${id} — SKIPPED: ${err.message}`);
        continue;
      }
      cache.write(file, data);
      media = data?.Media ?? null;
    }

    const title = filled(media?.title?.english) || filled(media?.title?.romaji);
    const key = title && subjectKeyForShow(title);
    if (!key) { log(`  [${done}/${anilistIds.length}] ${id} — no usable title`); continue; }

    // A franchise folds to one key, so a sequel merges into the season already
    // collected rather than overwriting it — the canonical entry is whichever
    // arrived first, and popularity order puts the best-known season there.
    if (!meta.shows[key]) meta.shows[key] = { anilistId: media.id, title };

    const before = rows.length;
    rows.push(...showRows(key, media));
    rows.push(...characterRows(media, key, meta));
    log(`  [${done}/${anilistIds.length}] ${title} → ${rows.length - before} rows`);
  }

  // appearsIn is assembled across shows, so it can only be emitted once every
  // subject has been seen.
  for (const [key, entry] of Object.entries(meta.characters)) {
    rows.push({ kind: 'character', key, field: 'appearsIn', value: entry.appearsIn });
    delete entry.appearsIn;
  }

  return { rows, meta };
}
