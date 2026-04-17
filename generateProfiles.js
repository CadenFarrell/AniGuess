#!/usr/bin/env node
/* eslint-env node */
/**
 * AniGuess Profile Generator
 * ══════════════════════════
 * Fetches character data from the Jikan API and writes a new seedProfiles.js.
 *
 * Usage:    node generateProfiles.js
 * Requires: Node 18+ (built-in fetch)
 *
 * What gets auto-filled per character:
 *   name        ← character.name
 *   role        ← "Main" | "Supporting"
 *   imageUrl    ← character.images.jpg.image_url
 *   description ← character.about  (first paragraph, ≤ 280 chars)
 *   nicknames   ← character.nicknames  (string[])
 *   difficulty  ← derived from character.favorites
 *                   easy   ≥ 10 000 favorites
 *                   medium ≥  2 000 favorites
 *                   hard   <  2 000 favorites
 *
 * Results are cached in .jikan-cache/ so re-runs are instant.
 * Delete that folder to force a full re-fetch.
 *
 * ── VERIFY MAL IDs ──────────────────────────────────────────────────────────
 * Each anime entry below has a MAL ID. Double-check any marked "← verify" at:
 *   https://myanimelist.net/anime/{id}
 * If an anime logs "⚠️  0 characters returned", the ID is probably wrong.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = path.join(__dirname, '.jikan-cache');
const OUTPUT     = path.join(__dirname, 'seedProfiles.js');

// ── Tuning ───────────────────────────────────────────────────────────────────
const DELAY_MS = 420;               // ~2.4 req/s — safe for Jikan's rate limit
const MIN_SUPPORTING_FAVORITES = 200; // drop very obscure supporting characters

// ── Helpers ──────────────────────────────────────────────────────────────────
const getDifficulty = (favorites = 0) => {
  if (favorites >= 10_000) return 'easy';
  if (favorites >=  2_000) return 'medium';
  return 'hard';
};

const trimAbout = (about = '') => {
  const para = (about || '').split('\n').find(p => p.trim().length > 30) ?? '';
  const t = para.trim();
  return t.length > 280 ? t.slice(0, 277) + '…' : t;
};

// ── Cache ─────────────────────────────────────────────────────────────────────
const cacheRead  = f => { try { const p = path.join(CACHE_DIR, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; } catch { return null; } };
const cacheWrite = (f, d) => { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(path.join(CACHE_DIR, f), JSON.stringify(d)); };

// ── Rate-limited fetch ────────────────────────────────────────────────────────
let lastFetch = 0;
async function jikan(endpoint, cacheFile) {
  if (cacheFile) { const hit = cacheRead(cacheFile); if (hit !== null) return hit; }
  const wait = DELAY_MS - (Date.now() - lastFetch);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastFetch = Date.now();

  const url = `https://api.jikan.moe/v4${endpoint}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    try { res = await fetch(url); } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }
    if (res.status === 429) {
      console.log(`  ⏳ Rate-limited — pausing 4 s… (attempt ${attempt})`);
      await new Promise(r => setTimeout(r, 4000));
      continue;
    }
    if (!res.ok) { console.warn(`  ⚠️  ${endpoint} → HTTP ${res.status}`); return null; }
    const data = (await res.json()).data ?? null;
    if (cacheFile && data) cacheWrite(cacheFile, data);
    return data;
  }
  return null;
}

// ── Anime catalog ─────────────────────────────────────────────────────────────
// title is only used in the generated output label; malId drives the fetch.
const ANIME_CATALOG = {
  moreThanMarried:    { title: 'More Than a Married Couple, But Not Lovers',                              malId: 49827  },
  quintuplets:        { title: 'The Quintessential Quintuplets',                                           malId: 38101  },
  jjk:                { title: 'Jujutsu Kaisen',                                                           malId: 40748  },
  alya:               { title: 'Alya Sometimes Hides Her Feelings In Russian',                            malId: 56642  },
  chainsawMan:        { title: 'Chainsaw Man',                                                             malId: 44511  },
  bunnyGirl:          { title: 'Rascal Does Not Dream of Bunny Girl Senpai',                              malId: 37999  },
  akameGaKill:        { title: 'Akame Ga Kill!',                                                           malId: 22177  },
  mushokuTensei:      { title: 'Mushoku Tensei',                                                           malId: 39535  },
  angelBeats:         { title: 'Angel Beats!',                                                             malId: 6547   },
  shiunji:            { title: 'The Children of Shiunji Family',                                          malId: 54968  }, // ← verify
  fragrantFlower:     { title: 'The Fragrant Flower Blooms With Dignity',                                  malId: 55643  }, // ← verify
  oshinoko:           { title: 'Oshi No Ko',                                                               malId: 52034  },
  chivalry:           { title: 'Chivalry of a Failed Knight',                                             malId: 30484  },
  blueLock:           { title: 'Blue Lock',                                                                malId: 49587  },
  charlotte:          { title: 'Charlotte',                                                                malId: 30167  },
  dxd:                { title: 'High School DxD',                                                         malId: 11617  },
  hsotd:              { title: 'High School of the Dead',                                                  malId: 8074   },
  sao:                { title: 'Sword Art Online',                                                         malId: 11757  },
  hundredGirlfriends: { title: 'The 100 Girlfriends Who Really, Really, Really, Really, Really Love You', malId: 51815  },
  demonSlayer:        { title: 'Demon Slayer',                                                             malId: 38000  },
  blueBox:            { title: 'Blue Box',                                                                 malId: 55537  }, // ← verify
  dressingDarling:    { title: 'My Dress-Up Darling',                                                      malId: 48736  },
  rezero:             { title: 'Re:Zero',                                                                  malId: 31240  },
  ditf:               { title: 'Darling in the Franxx',                                                   malId: 35849  },
  callOfNight:        { title: 'Call of the Night',                                                        malId: 50346  },
  aot:                { title: 'Attack on Titan',                                                          malId: 16498  },
  soloLeveling:       { title: 'Solo Leveling',                                                            malId: 62796  },
  angelNextDoor:      { title: 'The Angel Next Door Spoils Me Rotten',                                    malId: 52189  },
  deathNote:          { title: 'Death Note',                                                               malId: 1535   },
  codeGeass:          { title: 'Code Geass',                                                               malId: 1575   },
  seraphEnd:          { title: 'Seraph of the End',                                                        malId: 28623  },
  fireForce:          { title: 'Fire Force',                                                               malId: 38671  },
  konosuba:           { title: 'KonoSuba',                                                                 malId: 30831  },
  tensura:            { title: 'That Time I Got Reincarnated as a Slime',                                  malId: 37430  },
  tokyoGhoul:         { title: 'Tokyo Ghoul',                                                              malId: 22319  },
  vinlandSaga:        { title: 'Vinland Saga',                                                             malId: 37521  },
  trinitySeven:       { title: 'Trinity Seven',                                                            malId: 27519  },
  fate:               { title: 'Fate/Stay Night: Unlimited Blade Works',                                  malId: 22297  },
  edgerunners:        { title: 'Cyberpunk: Edgerunners',                                                  malId: 42310  },
  dateALive:          { title: 'Date A Live',                                                              malId: 15583  },
  prisonSchool:       { title: 'Prison School',                                                            malId: 28135  },
  testament:          { title: 'The Testament of Sister New Devil',                                        malId: 27655  },
  narutoFull:         { title: 'Naruto',                                                                   malId: 20     },
  erased:             { title: 'Erased',                                                                   malId: 31043  },
  shikimori:          { title: "Shikimori's Not Just a Cutie",                                            malId: 50465  },
  midnightHeart:      { title: 'Tune In To The Midnight Heart',                                           malId: 57877  }, // ← verify
  danDaDan:           { title: 'Dan Da Dan',                                                               malId: 57334  },
  snafuSNAFU:         { title: 'My Teen Romantic Comedy SNAFU',                                           malId: 23455  },
  classroomElite:     { title: 'Classroom of the Elite',                                                  malId: 35507  },
  vermeil:            { title: 'Vermeil in Gold',                                                          malId: 51888  },
  cafeTerrace:        { title: 'The Café Terrace and Its Goddesses',                                      malId: 52844  },
  hokkaido:           { title: 'Hokkaido Gals Are Super Adorable!',                                       malId: 53089  }, // ← verify
  takamineSan:        { title: 'Please Put Them On, Takamine-san',                                        malId: 49727  }, // ← verify
  komi:               { title: "Komi Can't Communicate",                                                  malId: 48926  },
  eigtyySix:          { title: '86 Eighty-Six',                                                           malId: 41457  },
  horimiya:           { title: 'Horimiya',                                                                 malId: 42897  },
  yourLieApril:       { title: 'Your Lie in April',                                                       malId: 23273  },
  coupleCuckoos:      { title: 'Couple of Cuckoos',                                                       malId: 49236  }, // ← verify
};

// ── Player definitions ────────────────────────────────────────────────────────
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

// ── Core fetch logic ──────────────────────────────────────────────────────────
async function fetchAnimeCharacters(malId) {
  return await jikan(`/anime/${malId}/characters`, `anime-${malId}.json`) ?? [];
}

async function fetchCharacterDetail(charId) {
  return await jikan(`/characters/${charId}`, `char-${charId}.json`);
}

async function buildAnimeEntry(key, { title, malId }) {
  process.stdout.write(`  [${key}] ${title} … `);
  const rawList = await fetchAnimeCharacters(malId);

  if (!Array.isArray(rawList) || rawList.length === 0) {
    console.log('⚠️  0 characters returned — check MAL ID');
    return { title, characters: [] };
  }

  // Keep only Main / Supporting; drop Background etc.
  const relevant = rawList.filter(e =>
    e.role === 'Main' ||
    (e.role === 'Supporting' && (e.character?.favorites ?? 0) >= MIN_SUPPORTING_FAVORITES)
  );

  console.log(`${relevant.length} chars (filtered from ${rawList.length})`);

  const characters = [];
  for (const entry of relevant) {
    const base    = entry.character;
    const detail  = await fetchCharacterDetail(base.mal_id);
    const favs    = base.favorites ?? detail?.favorites ?? 0;

    characters.push({
      id:          `jikan_${base.mal_id}`,
      name:        base.name,
      role:        entry.role,                                      // "Main" | "Supporting"
      description: trimAbout(detail?.about),
      nicknames:   detail?.nicknames ?? [],
      difficulty:  getDifficulty(favs),
      imageUrl:    base.images?.jpg?.image_url ?? '',
    });
  }

  return { title, characters };
}

// ── Seed script template ──────────────────────────────────────────────────────
function generateSeedScript(profiles) {
  const json = JSON.stringify(profiles, null, 2);
  return `/**
 * AniGuess Seed Script  (auto-generated — do not edit by hand)
 * ─────────────────────────────────────────────────────────────
 * Regenerate with:  node generateProfiles.js
 *
 * HOW TO USE:
 *  1. Run \`npm run dev\` and open the app in your browser.
 *  2. Press F12 → Console tab.
 *  3. Paste this entire file and press Enter.
 *  4. Refresh the page — profiles will be populated.
 */

(function () {
  const PROFILES_KEY = 'aniguess_profiles';

  const SEED = ${json};

  // ── Merge (safe to re-run — no duplicates) ──────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎌  AniGuess Profile Generator\n');

  // Unique anime keys across all players
  const allKeys = [...new Set(Object.values(PLAYERS).flat())];
  console.log(`Fetching ${allKeys.length} unique anime from Jikan…\n`);

  // Build anime data
  const animeData = {};
  for (const key of allKeys) {
    const info = ANIME_CATALOG[key];
    if (!info) { console.error(`❌  No catalog entry for key: "${key}"`); continue; }
    animeData[key] = await buildAnimeEntry(key, info);
  }

  // Build player profiles
  const profiles = {};
  for (const [playerId, keys] of Object.entries(PLAYERS)) {
    const name = playerId.charAt(0).toUpperCase() + playerId.slice(1);
    profiles[playerId] = {
      id: playerId,
      name,
      animeList: keys
        .filter(k => animeData[k])
        .map((k, i) => {
          const { title, characters } = animeData[k];
          return {
            id: `${playerId}_anime_${i}`,
            title,
            // Attach series name to each character at build time
            characters: characters.map(c => ({ ...c, series: title })),
          };
        }),
    };
  }

  // Write output
  const script = generateSeedScript(profiles);
  fs.writeFileSync(OUTPUT, script, 'utf8');

  const totalChars = Object.values(profiles)
    .flatMap(p => p.animeList)
    .flatMap(a => a.characters).length;

  console.log(`\n✅  Done!`);
  console.log(`   Wrote: ${OUTPUT}`);
  console.log(`   ${allKeys.length} anime · ~${totalChars} character references across all players`);
  console.log(`\n   To seed: paste seedProfiles.js into the browser DevTools console.`);
}

main().catch(err => { console.error('\n❌  Fatal error:', err); process.exit(1); });
