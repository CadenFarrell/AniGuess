// Loads the fact pack — the answers a profile cannot derive. Generated offline
// by generateFacts.js, served as a static file out of public/facts/, and shaped
// by shared/utils/facts.js, which holds every pure part of this.
//
// Nothing reads this yet. It exists so a quiz-style game finds its answer key
// already fetchable; see the plan in facts.js's header for why the answer has to
// ship with the question at all.
import { indexPack } from '../utils/facts';

// Two fetches rather than one, and the indirection is the whole point: the
// manifest is small and always revalidated, while the pack file it names is
// immutable and can be cached hard. A data fix is then "write pack-v2.json,
// change one line of index.json" — no app code change, no rebuild, no redeploy
// of anything but the two files.
//
// The alternative, a bundled `import()` of the JSON, was rejected for the same
// reason plus a second one: a bundled pack is parsed as JavaScript on every
// load by every player, including everyone who never opens the game.
const MANIFEST_PATH = 'facts/index.json';

// Vite serves public/ from the configured base, which is '/' today but is a
// config value rather than a fact.
const base = () => import.meta.env?.BASE_URL || '/';

let pending = null;

async function fetchJson(path, init) {
  const res = await fetch(`${base()}${path}`, init);
  if (!res.ok) throw new Error(`fact pack: HTTP ${res.status} for ${path}`);
  return res.json();
}

async function load() {
  // no-store on the manifest only. It is a few dozen bytes and it is the thing
  // that has to be right the moment it changes; caching it would defeat the
  // versioning it exists to provide.
  const manifest = await fetchJson(MANIFEST_PATH, { cache: 'no-store' });
  const current = manifest?.current;
  if (typeof current !== 'string' || !current) {
    throw new Error('fact pack: manifest names no current pack');
  }
  const raw = await fetchJson(`facts/${current}`);
  return { ...indexPack(raw), file: current, generatedAt: manifest.generatedAt ?? null };
}

/**
 * The indexed pack: { version, shows: Map, characters: Map, file, generatedAt }.
 *
 * Memoized in a module-level promise, so N callers in one session cost one
 * request and one parse. Deliberately NOT mirrored into localStorage: AniTune's
 * anitune_theme_cache_v2 is the tempting precedent and the wrong one, because
 * that cache grows only with what you actually played while a pack is hundreds
 * of KB written in one go — onto the same origin whose quota is why
 * storage.setItem grew a read-back guard and a banner. HTTP caching already
 * does this job, and does it without competing with anyone's saved profiles.
 *
 * Resolves to null rather than throwing. No game exists to render an error yet,
 * and when one does, "the pack did not load" is something its own setup screen
 * should say — the way AniTune reports the shows it cannot use — rather than
 * something that takes a render down.
 */
export function loadFactPack() {
  if (!pending) {
    pending = load().catch((err) => {
      console.error(err);
      // Drop the rejected promise so a later attempt can retry rather than
      // being served the failure forever.
      pending = null;
      return null;
    });
  }
  return pending;
}
