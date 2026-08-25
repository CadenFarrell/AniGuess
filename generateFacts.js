#!/usr/bin/env node
/* eslint-env node */
/**
 * Builds the fact pack — the answers a profile cannot derive.
 *
 * Regenerate with: npm run generate:facts  [-- --limit 500]
 *
 * Writes public/facts/pack-v1.json and public/facts/index.json. Both are checked
 * in: public/ is copied verbatim into dist/, so `firebase deploy --only hosting`
 * carries them with no bundler involvement, and the manifest indirection means a
 * data fix is two files rather than an app release.
 *
 * Unlike generateProfiles.js this does NOT carry its own throttle. It imports
 * anilistClient.js, which is the only place that knows AniList's real ~30/min
 * limit and its Retry-After / X-RateLimit-Reset backoff; that file predates the
 * client, and a third copy is how a rate-limit fix reaches two callers out of
 * three.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateFact, META_FIELDS, SECTION_FOR } from './src/shared/utils/facts.js';
import { ANIME_CATALOG } from './animeCatalog.js';
import { collect, popularIds } from './factSources/anilist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Deliberately NOT .anilist-cache/. That directory holds anime-<id>-p<n>.json
// from generateProfiles.js's very different query, and somebody clearing it to
// force a profile refetch should not silently reset an hour of fact fetching.
const CACHE_DIR = path.join(__dirname, '.facts-cache');
const OUT_DIR = path.join(__dirname, 'public', 'facts');
const REVIEW_DIR = path.join(__dirname, 'facts');
const OVERRIDES = path.join(REVIEW_DIR, 'overrides.json');
const REJECTED = path.join(REVIEW_DIR, 'rejected.json');

const PACK_VERSION = 1;
const PACK_FILE = `pack-v${PACK_VERSION}.json`;
const DEFAULT_LIMIT = 500;

const log = (msg) => console.log(msg);

const cache = {
  read(file) {
    try {
      const p = path.join(CACHE_DIR, file);
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
    } catch { return null; }
  },
  write(file, data) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, file), JSON.stringify(data));
  },
};

function readJson(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch (err) {
    console.error(`⚠️  could not read ${path.basename(file)}: ${err.message}`);
    return fallback;
  }
}

function argLimit() {
  const i = process.argv.indexOf('--limit');
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_LIMIT;
}

// `--ids 16498,1` skips discovery entirely and fetches exactly those AniList
// ids. Two uses: re-pulling one show after correcting an override, and running
// the whole assembly offline against a warm cache — which is the only way to
// exercise this script while AniList itself is down.
//
// It writes a pack containing ONLY those subjects, so it is a diagnostic, not
// an incremental update.
function argIds() {
  const i = process.argv.indexOf('--ids');
  if (i < 0) return null;
  const ids = String(process.argv[i + 1] ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? ids : null;
}

// Sorted on the way out so a re-run over an unchanged cache produces a
// byte-identical pack. Without it the file churns on every regeneration and a
// real data change is invisible in the diff.
function sortedObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * Applies the hand-maintained corrections, last, so a regeneration can never
 * clobber one. A null value SUPPRESSES a fact — the way to delete something the
 * source is simply wrong about.
 *
 * Shape: { "<section>": { "<subjectKey>": { "<field>": value | null } } }
 */
function applyOverrides(pack, overrides) {
  let applied = 0;
  let suppressed = 0;
  for (const section of ['shows', 'characters']) {
    for (const [key, fields] of Object.entries(overrides?.[section] ?? {})) {
      if (!fields || typeof fields !== 'object') continue;
      const entry = pack[section][key] ?? (pack[section][key] = {});
      for (const [field, value] of Object.entries(fields)) {
        if (value === null) { delete entry[field]; suppressed++; continue; }
        entry[field] = value;
        applied++;
      }
      // An override that only ever suppressed leaves an entry with nothing but
      // its own name, which is not a subject anything can ask about.
      const facts = Object.keys(entry).filter((f) => !META_FIELDS.has(f));
      if (facts.length === 0) delete pack[section][key];
    }
  }
  return { applied, suppressed };
}

async function main() {
  const limit = argLimit();
  const explicitIds = argIds();
  console.log('🎌  AniArcade Fact Pack Generator (source: AniList)\n');

  let subjects;
  if (explicitIds) {
    console.log(`Resolving subjects (--ids: ${explicitIds.length} given)…`);
    subjects = [...new Set(explicitIds)];
  } else {
    // The union is what makes ONE pack serve both ends of the targeting filter:
    // top-N popularity covers a table playing globally, and this group's own
    // catalog guarantees the shows they actually watch are present regardless of
    // where they fall on that curve.
    console.log(`Resolving subjects (top ${limit} by popularity + ${Object.keys(ANIME_CATALOG).length} catalog shows)…`);
    const popular = await popularIds(limit, { cache, log });
    const catalog = Object.values(ANIME_CATALOG).map((c) => c.anilistId);
    subjects = [...new Set([...popular, ...catalog])];
  }
  console.log(`  ${subjects.length} unique subjects\n`);

  console.log('Fetching…');
  const { rows, meta } = await collect(subjects, { cache, log });

  // Validation is not a formality — it is the only thing standing between a
  // source adapter's bad day and a clue read aloud to a table. Rejects are
  // WRITTEN, because a generator that silently drops a tenth of its rows looks
  // exactly like one that worked.
  const pack = { version: PACK_VERSION, shows: {}, characters: {} };
  for (const [section, source] of [['shows', meta.shows], ['characters', meta.characters]]) {
    for (const [key, identity] of Object.entries(source)) pack[section][key] = { ...identity };
  }

  const rejected = [];
  let accepted = 0;
  for (const row of rows) {
    const verdict = validateFact(row);
    if (!verdict.ok) { rejected.push({ ...row, reason: verdict.reason }); continue; }
    pack[SECTION_FOR[row.kind]][row.key][row.field] = row.value;
    accepted++;
  }

  const overrides = readJson(OVERRIDES, {});
  const { applied, suppressed } = applyOverrides(pack, overrides);

  // Drop subjects left holding nothing but their own name.
  for (const section of ['shows', 'characters']) {
    for (const [key, entry] of Object.entries(pack[section])) {
      if (Object.keys(entry).every((f) => META_FIELDS.has(f))) delete pack[section][key];
    }
    pack[section] = sortedObject(pack[section]);
  }

  const showCount = Object.keys(pack.shows).length;
  const charCount = Object.keys(pack.characters).length;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, PACK_FILE), `${JSON.stringify(pack, null, 2)}\n`, 'utf8');

  // Date only, not a timestamp: the manifest is the one file that changes on
  // every run, and a full clock reading would churn the diff for nothing.
  const manifest = {
    current: PACK_FILE,
    generatedAt: new Date().toISOString().slice(0, 10),
    shows: showCount,
    characters: charCount,
    facts: accepted + applied - suppressed,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(REJECTED, `${JSON.stringify(rejected, null, 2)}\n`, 'utf8');

  console.log(`\n✅  ${showCount} shows · ${charCount} characters · ${manifest.facts} facts`);
  if (applied || suppressed) console.log(`   overrides: ${applied} set, ${suppressed} suppressed`);
  if (rejected.length) {
    console.log(`   ⚠️  ${rejected.length} rows rejected — see facts/rejected.json`);
    const byReason = {};
    for (const r of rejected) byReason[r.reason] = (byReason[r.reason] ?? 0) + 1;
    for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`      ${count}× ${reason}`);
    }
  }
  console.log(`   Wrote: public/facts/${PACK_FILE} + index.json`);
}

main().catch((err) => { console.error('\n❌  Fatal:', err); process.exit(1); });
