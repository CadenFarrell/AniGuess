#!/usr/bin/env node
/* eslint-env node */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '.anilist-cache');
const OUTPUT    = path.join(__dirname, 'seedProfiles.js');
const DELAY_MS  = 600;
const MIN_SUPPORTING_FAVOURITES = 100;

const QUERY = `
query ($id: Int, $page: Int) {
  Media(id: $id, type: ANIME) {
    genres
    characters(sort: ROLE, perPage: 25, page: $page) {
      pageInfo { hasNextPage }
      edges {
        role
        node {
          id
          name { full }
          gender
          image { large }
          description(asHtml: false)
          favourites
        }
      }
    }
  }
}`;

// ── Cache ─────────────────────────────────────────────────────────────────────
const cacheRead  = f => { try { const p = path.join(CACHE_DIR, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; } catch { return null; } };
const cacheWrite = (f, d) => { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(path.join(CACHE_DIR, f), JSON.stringify(d)); };

// ── Rate-limited GraphQL fetch ────────────────────────────────────────────────
let lastFetch = 0;
async function anilistPage(id, page) {
  const cacheFile = `anime-${id}-p${page}.json`;
  const hit = cacheRead(cacheFile);
  if (hit) return hit;

  const wait = DELAY_MS - (Date.now() - lastFetch);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastFetch = Date.now();

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    try {
      res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { id, page } }),
      });
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    if (res.status === 429) {
      console.log(`  ⏳ Rate-limited — pausing 60s…`);
      await new Promise(r => setTimeout(r, 60000));
      continue;
    }
    if (!res.ok) { console.warn(`  ⚠️  ${id} → HTTP ${res.status}`); return null; }
    const data = (await res.json()).data?.Media ?? null;
    if (data) cacheWrite(cacheFile, data);
    return data;
  }
  return null;
}

async function anilist(id) {
  let genres = null;
  const allEdges = [];
  let page = 1;
  while (true) {
    const data = await anilistPage(id, page);
    if (!data) return null;
    if (!genres) genres = data.genres;
    allEdges.push(...(data.characters?.edges ?? []));
    if (!data.characters?.pageInfo?.hasNextPage) break;
    page++;
  }
  return { genres, characters: { edges: allEdges } };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const trimDesc = (desc = '') => {
  const t = (desc || '').replace(/~!.*?!~/gs, '').replace(/\n+/g, ' ').trim();
  return t.length > 280 ? t.slice(0, 277) + '…' : t;
};

// ── Anime catalog (AniList IDs) ───────────────────────────────────────────────
const ANIME_CATALOG = {
  moreThanMarried:    { title: 'More Than a Married Couple, But Not Lovers',                               anilistId: 141949 },
  quintuplets:        { title: 'The Quintessential Quintuplets',                                            anilistId: 103572 },
  jjk:                { title: 'Jujutsu Kaisen',                                                            anilistId: 113415 },
  alya:               { title: 'Alya Sometimes Hides Her Feelings In Russian',                             anilistId: 162804 },
  chainsawMan:        { title: 'Chainsaw Man',                                                              anilistId: 127230 },
  bunnyGirl:          { title: 'Rascal Does Not Dream of Bunny Girl Senpai',                               anilistId: 101291 },
  akameGaKill:        { title: 'Akame Ga Kill!',                                                            anilistId: 20613  },
  mushokuTensei:      { title: 'Mushoku Tensei',                                                            anilistId: 108465 },
  angelBeats:         { title: 'Angel Beats!',                                                              anilistId: 6547   },
  shiunji:            { title: 'The Children of Shiunji Family',                                           anilistId: 174802 },
  fragrantFlower:     { title: 'The Fragrant Flower Blooms With Dignity',                                   anilistId: 181444 },
  oshinoko:           { title: 'Oshi No Ko',                                                                anilistId: 150672 },
  chivalry:           { title: 'Chivalry of a Failed Knight',                                              anilistId: 21092  },
  blueLock:           { title: 'Blue Lock',                                                                 anilistId: 137822 },
  charlotte:          { title: 'Charlotte',                                                                 anilistId: 20997  },
  dxd:                { title: 'High School DxD',                                                          anilistId: 11617  },
  hsotd:              { title: 'High School of the Dead',                                                   anilistId: 8074   },
  sao:                { title: 'Sword Art Online',                                                          anilistId: 11757  },
  hundredGirlfriends: { title: 'The 100 Girlfriends Who Really, Really, Really, Really, Really Love You',  anilistId: 162694 },
  demonSlayer:        { title: 'Demon Slayer',                                                              anilistId: 101922 },
  blueBox:            { title: 'Blue Box',                                                                  anilistId: 170942 },
  dressingDarling:    { title: 'My Dress-Up Darling',                                                       anilistId: 132405 },
  rezero:             { title: 'Re:Zero',                                                                   anilistId: 21355  },
  ditf:               { title: 'Darling in the Franxx',                                                    anilistId: 99423  },
  callOfNight:        { title: 'Call of the Night',                                                         anilistId: 141391 },
  aot:                { title: 'Attack on Titan',                                                           anilistId: 16498  },
  soloLeveling:       { title: 'Solo Leveling',                                                             anilistId: 151807 },
  angelNextDoor:      { title: 'The Angel Next Door Spoils Me Rotten',                                     anilistId: 143338 },
  deathNote:          { title: 'Death Note',                                                                anilistId: 1535   },
  codeGeass:          { title: 'Code Geass',                                                                anilistId: 1575   },
  seraphEnd:          { title: 'Seraph of the End',                                                         anilistId: 20829  },
  fireForce:          { title: 'Fire Force',                                                                anilistId: 105310 },
  konosuba:           { title: 'KonoSuba',                                                                  anilistId: 21202  },
  tensura:            { title: 'That Time I Got Reincarnated as a Slime',                                   anilistId: 101280 },
  tokyoGhoul:         { title: 'Tokyo Ghoul',                                                               anilistId: 20605  },
  vinlandSaga:        { title: 'Vinland Saga',                                                              anilistId: 101348 },
  trinitySeven:       { title: 'Trinity Seven',                                                             anilistId: 20631  },
  fate:               { title: 'Fate/Stay Night: Unlimited Blade Works',                                   anilistId: 20791  },
  edgerunners:        { title: 'Cyberpunk: Edgerunners',                                                   anilistId: 120377 },
  dateALive:          { title: 'Date A Live',                                                               anilistId: 15583  },
  prisonSchool:       { title: 'Prison School',                                                             anilistId: 20807  },
  testament:          { title: 'The Testament of Sister New Devil',                                         anilistId: 20678  },
  narutoFull:         { title: 'Naruto',                                                                    anilistId: 20     },
  erased:             { title: 'Erased',                                                                    anilistId: 21234  },
  shikimori:          { title: "Shikimori's Not Just a Cutie",                                             anilistId: 127911 },
  midnightHeart:      { title: 'Tune In To The Midnight Heart',                                            anilistId: 187942 },
  danDaDan:           { title: 'Dan Da Dan',                                                                anilistId: 171018 },
  snafuSNAFU:         { title: 'My Teen Romantic Comedy SNAFU',                                            anilistId: 14813  },
  classroomElite:     { title: 'Classroom of the Elite',                                                   anilistId: 98659  },
  vermeil:            { title: 'Vermeil in Gold',                                                           anilistId: 146210 },
  cafeTerrace:        { title: 'The Café Terrace and Its Goddesses',                                       anilistId: 154412 },
  hokkaido:           { title: 'Hokkaido Gals Are Super Adorable!',                                        anilistId: 155963 },
  takamineSan:        { title: 'Please Put Them On, Takamine-san',                                         anilistId: 179965 },
  komi:               { title: "Komi Can't Communicate",                                                   anilistId: 133965 },
  eigtyySix:          { title: '86 Eighty-Six',                                                             anilistId: 116589 },
  horimiya:           { title: 'Horimiya',                                                                  anilistId: 124080 },
  yourLieApril:       { title: 'Your Lie in April',                                                         anilistId: 20665  },
  coupleCuckoos:      { title: 'Couple of Cuckoos',                                                         anilistId: 132052 },
};

// ── Player definitions ────────────────────────────────────────────────────────
const PLAYER_NAMES = { caden: 'Caden', gavin: 'Gavin', gabe: 'Gabe', liam: 'Liam' };

const PLAYERS = {
  caden: [
    'dxd', 'quintuplets', 'bunnyGirl', 'ditf', 'moreThanMarried',
    'jjk', 'soloLeveling', 'sao', 'alya', 'charlotte',
    'blueLock', 'seraphEnd', 'deathNote', 'angelBeats', 'akameGaKill',
    'classroomElite', 'dressingDarling', 'rezero', 'blueBox', 'chainsawMan',
    'takamineSan', 'konosuba', 'callOfNight', 'codeGeass', 'angelNextDoor',
    'fireForce', 'shiunji', 'mushokuTensei', 'hsotd', 'snafuSNAFU',
    'chivalry', 'hundredGirlfriends', 'tensura', 'demonSlayer', 'vermeil',
    'cafeTerrace', 'dateALive', 'aot', 'trinitySeven', 'fate',
    'edgerunners', 'fragrantFlower', 'oshinoko', 'danDaDan', 'tokyoGhoul',
    'vinlandSaga', 'hokkaido', 'prisonSchool', 'testament', 'narutoFull',
    'erased', 'shikimori', 'midnightHeart',
  ],
  gavin: [
    'narutoFull', 'hsotd', 'dxd', 'chainsawMan', 'quintuplets',
    'jjk', 'sao', 'blueLock', 'blueBox', 'shiunji',
    'moreThanMarried', 'hundredGirlfriends', 'alya', 'charlotte',
    'bunnyGirl', 'chivalry', 'akameGaKill', 'mushokuTensei',
    'angelBeats', 'demonSlayer', 'komi', 'fragrantFlower',
    'oshinoko', 'eigtyySix',
  ],
  gabe: [
    'moreThanMarried', 'dressingDarling', 'shiunji', 'horimiya',
    'quintuplets', 'bunnyGirl', 'alya', 'angelNextDoor', 'jjk',
    'fragrantFlower', 'yourLieApril', 'oshinoko', 'callOfNight',
    'chainsawMan', 'akameGaKill', 'aot', 'rezero', 'coupleCuckoos',
    'mushokuTensei', 'ditf', 'soloLeveling', 'blueLock',
  ],
  liam: [
    'moreThanMarried', 'chainsawMan', 'chivalry', 'quintuplets',
    'blueLock', 'jjk', 'alya',
  ],
};

// ── Build ─────────────────────────────────────────────────────────────────────
async function buildAnimeEntry(key, { title, anilistId }) {
  process.stdout.write(`  [${key}] ${title} … `);
  const media = await anilist(anilistId);

  if (!media) { console.log('⚠️  no data'); return { title, characters: [] }; }

  const genres = media.genres ?? [];
  const edges  = media.characters?.edges ?? [];

  const characters = edges
    .filter(e =>
      e.role === 'MAIN' ||
      (e.role === 'SUPPORTING' && (e.node.favourites ?? 0) >= MIN_SUPPORTING_FAVOURITES)
    )
    .map(e => ({
      id:          `anilist_${e.node.id}`,
      name:        e.node.name.full,
      role:        e.role === 'MAIN' ? 'Main' : 'Supporting',
      gender:      e.node.gender ?? 'Unknown',
      imageUrl:    e.node.image?.large ?? '',
      description: trimDesc(e.node.description),
      genres,
    }));

  console.log(`${characters.length} chars`);
  return { title, characters };
}

function generateSeedScript(profiles) {
  return `/**
 * AniGuess Seed Script (auto-generated — do not edit by hand)
 * Regenerate with: node generateProfiles.js
 *
 * HOW TO USE:
 *  1. Run \`npm run dev\` and open the app in your browser.
 *  2. Press F12 → Console tab.
 *  3. Paste this entire file and press Enter.
 *  4. Refresh the page.
 */

(function () {
  const PROFILES_KEY = 'aniguess_profiles';
  const SEED = ${JSON.stringify(profiles, null, 2)};

  let existing = {};
  try { existing = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}'); } catch (_) {}

  let addedAnime = 0, addedChars = 0;

  for (const [key, seedProfile] of Object.entries(SEED)) {
    if (!existing[key]) {
      existing[key] = seedProfile;
      addedAnime += seedProfile.animeList.length;
      seedProfile.animeList.forEach(a => { addedChars += a.characters.length; });
    } else {
      for (const seedAnime of seedProfile.animeList) {
        const already = existing[key].animeList.find(
          a => a.title.toLowerCase() === seedAnime.title.toLowerCase()
        );
        if (!already) {
          existing[key].animeList.push(seedAnime);
          addedAnime++;
          addedChars += seedAnime.characters.length;
        } else {
          for (const sc of seedAnime.characters) {
            if (!already.characters.find(c => c.name.toLowerCase() === sc.name.toLowerCase())) {
              already.characters.push(sc);
              addedChars++;
            }
          }
        }
      }
    }
  }

  localStorage.setItem(PROFILES_KEY, JSON.stringify(existing));
  console.log('%c✅ AniGuess seed complete!', 'color:#a855f7;font-weight:bold;font-size:14px');
  console.log(\`   +\${addedAnime} anime entries, +\${addedChars} characters.\`);
  console.log('   Refresh the page to see the data.');
})();
`;
}

async function main() {
  console.log('🎌  AniGuess Profile Generator (AniList)\n');

  const allKeys = [...new Set(Object.values(PLAYERS).flat())];
  console.log(`Fetching ${allKeys.length} unique anime…\n`);

  const animeData = {};
  for (const key of allKeys) {
    const info = ANIME_CATALOG[key];
    if (!info) { console.error(`❌  No catalog entry for: "${key}"`); continue; }
    animeData[key] = await buildAnimeEntry(key, info);
  }

  const profiles = {};
  for (const [playerId, keys] of Object.entries(PLAYERS)) {
    profiles[playerId] = {
      id: playerId,
      name: PLAYER_NAMES[playerId] ?? playerId.charAt(0).toUpperCase() + playerId.slice(1),
      animeList: keys.filter(k => animeData[k]).map((k, i) => ({
        id: `${playerId}_anime_${i}`,
        title: animeData[k].title,
        characters: animeData[k].characters.map(c => ({ ...c, series: animeData[k].title })),
      })),
    };
  }

  fs.writeFileSync(OUTPUT, generateSeedScript(profiles), 'utf8');

  const totalChars = Object.values(profiles).flatMap(p => p.animeList).flatMap(a => a.characters).length;
  console.log(`\n✅  Done! ${allKeys.length} anime · ~${totalChars} character refs`);
  console.log(`   Wrote: ${OUTPUT}`);
}

main().catch(err => { console.error('\n❌  Fatal:', err); process.exit(1); });
