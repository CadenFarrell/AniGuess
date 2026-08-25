import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// loadFactPack memoizes in a module-level promise, so every test has to start
// from a fresh module registry or it is served the previous test's answer.
async function freshLoader() {
  vi.resetModules();
  return (await import('./factPack.js')).loadFactPack;
}

const MANIFEST = { current: 'pack-v7.json', generatedAt: '2026-08-22' };
const PACK = {
  version: 1,
  shows: { 'cowboy bebop': { title: 'Cowboy Bebop', studio: 'Sunrise' } },
  characters: { 'spike spiegel': { name: 'Spike Spiegel', voiceActorJp: 'Koichi Yamadera' } },
};

function stubFetch(routes) {
  return vi.fn(async (url) => {
    const body = routes[String(url)];
    if (body === undefined) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => body };
  });
}

const ROUTES = { '/facts/index.json': MANIFEST, '/facts/pack-v7.json': PACK };

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('loadFactPack', () => {
  it('follows the manifest to the versioned pack and indexes it', async () => {
    globalThis.fetch = stubFetch(ROUTES);
    const loadFactPack = await freshLoader();

    const pack = await loadFactPack();

    expect(globalThis.fetch.mock.calls.map((c) => c[0])).toEqual([
      '/facts/index.json', '/facts/pack-v7.json',
    ]);
    expect(pack.shows.get('cowboy bebop').studio).toBe('Sunrise');
    expect(pack.characters.get('spike spiegel').voiceActorJp).toBe('Koichi Yamadera');
    expect(pack.file).toBe('pack-v7.json');
  });

  // The manifest must never be served from cache — it is the whole mechanism by
  // which a data fix reaches players without an app release.
  it('revalidates the manifest but lets the pack file be cached', async () => {
    globalThis.fetch = stubFetch(ROUTES);
    const loadFactPack = await freshLoader();
    await loadFactPack();

    expect(globalThis.fetch.mock.calls[0][1]).toEqual({ cache: 'no-store' });
    expect(globalThis.fetch.mock.calls[1][1]).toBeUndefined();
  });

  it('costs one request per file no matter how many callers ask', async () => {
    globalThis.fetch = stubFetch(ROUTES);
    const loadFactPack = await freshLoader();

    const [a, b, c] = await Promise.all([loadFactPack(), loadFactPack(), loadFactPack()]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('resolves null rather than throwing when the pack is missing', async () => {
    globalThis.fetch = stubFetch({ '/facts/index.json': MANIFEST });
    const loadFactPack = await freshLoader();

    await expect(loadFactPack()).resolves.toBeNull();
  });

  it('resolves null when the manifest names no pack', async () => {
    globalThis.fetch = stubFetch({ '/facts/index.json': { generatedAt: '2026-08-22' } });
    const loadFactPack = await freshLoader();

    await expect(loadFactPack()).resolves.toBeNull();
  });

  // A failure must not be memoized: a player who opened the game on a dropped
  // connection would otherwise be served that failure for the rest of the
  // session, with no way to retry short of a reload.
  it('retries after a failure instead of caching it', async () => {
    let routes = {};
    globalThis.fetch = vi.fn(async (url) => {
      const body = routes[String(url)];
      if (body === undefined) return { ok: false, status: 503, json: async () => null };
      return { ok: true, status: 200, json: async () => body };
    });
    const loadFactPack = await freshLoader();

    expect(await loadFactPack()).toBeNull();
    routes = ROUTES;
    expect((await loadFactPack())?.shows.get('cowboy bebop').studio).toBe('Sunrise');
  });
});
