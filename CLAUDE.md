# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (port 5173)
npm run build         # production build into dist/
npm run preview       # serve the built dist/
npm run lint          # ESLint over the project
npm test              # vitest run (one pass, no watch)
npm run generate      # regenerate seedProfiles.js from AniList (Node script)
```

Tests:

```bash
npx vitest                                     # watch mode
npx vitest run src/games/aniguess/rules.test.js # one file
npx vitest run -t "advances the turn"           # one test by name
```

The vitest config lives in the `test` block of `vite.config.js`. Only files matching its
`include` glob run at all — today that is `src/**/*.test.js` under `environment: 'node'`,
so the suite covers pure `.js` modules and a `.test.jsx` file would silently never run.
That is a property of the current config, not a rule: to add component tests, widen
`include` and set an `environment` (jsdom) in the same block.

Firebase (online rooms only):

```bash
firebase emulators:start --only database,auth --project demo-aniguess
firebase deploy --only database    # database.rules.json
firebase deploy --only hosting     # dist/
```

`.env.local` (copied from `.env.local.example`) holds the `VITE_FIREBASE_*` config. When
pointing at the emulator, `VITE_FIREBASE_DATABASE_URL` must use the `-default-rtdb`
suffixed namespace — the wrong namespace connects to a rules-less database instead of the
one your rules were deployed to.

## Architecture

### Hub and game registration

`src/hub/registry.js` is the entire arcade menu. A game is a folder under `src/games/`
whose `index.js` default-exports a descriptor (`{ id, title, blurb, icon, accent,
available, Component }`) plus one line added to that array. `Component` receives a single
`onExit` prop and owns everything from there.

Each game's top component (`<Game>Game.jsx`) is just a local/online mode picker; the
online button is disabled unless `firebaseEnabled`. It delegates to
`LocalGame.jsx` or `OnlineGame.jsx`, each of which is a thin view-router holding a `view`
string and rendering dumb screens from `components/`.

### rules.js — the central invariant

`src/games/<game>/rules.js` holds all game logic as pure functions: no React, no storage,
no network. Each takes a slice of round state and returns a `{ patch }` (sometimes plus
`next` view / derived values) for the caller to apply however its persistence layer works.

Every game pairs two hooks over that one `rules.js`, both in `games/<game>/hooks/`: a
local one backed by `useState`, and an online one backed by Firebase RTDB. Same rules,
two persistence layers.

This is what keeps turn order, scoring, and phase transitions from drifting between local
and online play. **Change game behaviour in `rules.js`, not in the hooks** — and the
`*.test.js` files that cover it are the reason it stays testable without a DOM or a
network.

### Online rooms (Firebase Realtime Database)

All games share one `rooms/{code}` namespace — codes are unique across the whole app, not
per game, so a new game cannot assume it has the code space to itself. A code is claimed by
a `runTransaction` on `rooms/{code}/createdAt`. Codes are 5 chars from an alphabet with
ambiguous `0/O/1/I` removed.

```
rooms/{code}/
  createdAt              claim marker
  open                   accepting joins
  memberUids/{uid}       → playerId   (the membership check every other rule reads)
  claims/{playerId}      → uid        (stops two devices claiming one seat)
  state/                 the subtree the whole room subscribes to (players, turn + score
                         state, presence/{playerId}, view/game phase)
  …                      a game may add its own sub-nodes alongside these
```

That last line is an extension point worth understanding before using it. AniGuess adds
`assignments/{playerId}`, whose security rules **deny** read and write to the assignee's
own device — that rule, not any client-side check, is the mechanism by which a player
cannot see their own character. Anything a player must not learn belongs in a sibling node
gated the same way, never inside `state/`, which every member reads in full.

Two things that bite every time:

- **Multi-location `update()` rules evaluate against the pre-update tree.** A batch that
  writes `memberUids` alongside paths whose rules depend on `memberUids` existing will
  fail. Write and `await` `memberUids` first.
- **RTDB does not store empty objects/arrays** — a `{}` or `[]` write simply doesn't exist
  on read-back. Every room hook must therefore normalize state at *every* entry point (the
  `onValue` subscription *and* inside transaction callbacks, which see raw stored values)
  before handing anything to `rules.js`, which calls `.includes`/`.every` unguarded.

The room a device is in is remembered in localStorage under a per-game key
(`<game>_online_room` — per-game so two games' saved rooms can't clobber each other), so a
refresh rejoins instead of landing on the join screen. Firebase persists the anonymous uid,
so the membership rules still pass.

### Presence and the departed-player problem

`src/shared/hooks/usePresence.js` keeps one record alive at
`state/presence/{playerId}` using Firebase's `onDisconnect` (server-side, so no
`beforeunload` handler or heartbeat). `src/shared/utils/presence.js` is the pure half:
`rosterSnapshot` classifies each player as active / dropping / gone / left against a
20-second `GRACE_MS`, using *server* time (`Date.now() + serverTimeOffset`) so all devices
agree on the boundary.

This matters because every readiness gate ("everyone is ready", "everyone has answered",
"everyone is locked out") counts the roster — a closed tab would wedge the room forever.
Rules functions therefore take `skipIds` or an already-filtered *active* roster, and there
are dedicated escape hatches (`skipDepartedTurn`, `releaseBuzz`, `revealNow`,
`nextHostId` for host migration). Preserve this when adding room logic.

### Profiles and identity

Player profiles (name + anime list + characters) live in localStorage under
`aniguess_profiles` and are shared by every game. The key name is
historical — it predates the hub and is **not** AniGuess-specific. Leave it alone:
renaming it to something tidier would orphan every profile players have already saved.
Every read runs `normalizeProfile`, so older saved shapes are repaired without a
migration flag — and it guards missing `animeList`/`characters`, because the picker
renders *every* saved profile, so a half-shaped one now takes the hub down on mount
rather than merely being invisible.

Two layers, and components must use the outer one:

- `shared/hooks/useProfile.js` is **storage only** — stateless, every call re-reads
  localStorage. It also owns `aniarcade_active_profile`, the pointer to your main
  profile (a current-name key, unlike `PROFILES_KEY` above, because it is new).
- `shared/context/ProfileProvider.jsx` holds the one copy of the profile map for the
  whole app; consumers import `useProfileStore` from `context/profileContext.js`.
  **Call `useProfile()` directly and your write reaches localStorage but re-renders
  nothing else** — no other screen holding that profile, and not the hub's profile
  pill. That was harmless when each screen asked for a name and used only its own
  answer; it is a silent data-loss bug now that one profile is shared everywhere. The
  `profilesRef` inside the provider is load-bearing for the same reason: two writes in
  one event handler both close over the same render's map, so without it the second
  persists over the first.

The user picks their profile once, in the hub (`ProfileButton` → `ProfilePicker`), and
every game inherits it: seated automatically in local setup, and *the* identity online.
`ProfilePicker` has two modes over one list — `'main'` writes the active id, `'add'`
hands a profile to a local roster and must never touch it (hence `createProfile` vs
`ensureProfile`). Do not add a "type your name" box back to a screen: profile ids are
folded names (`profileIdFromName` in `shared/utils/profileStats.js`), so a typo mints a
new empty profile indistinguishable from a lost AniList import. That bug is the reason
the picker exists.

Identity is deliberately not id-based, and the reasons are non-obvious:

- `characterNameKey` (`shared/utils/character.js`) identifies a character by name with
  diacritics folded — AniList ids and the `Date.now()` ids ListManager creates share no id
  space, and the same person appears under several season titles.
- Shows are grouped by `shared/utils/franchise.js` (AniList relation data during an import,
  title heuristic offline) and merged by `shared/utils/profileMerge.js`, which falls back to
  a shared-cast heuristic because neither ids nor titles line up across sources
  (`anilist_anime_<id>` + AniList's long titles vs. `<player>_anime_<n>` + hand-shortened
  ones).
- Characters come in two shapes (`genres` array from AniList, singular `genre` string from
  ListManager); `normalizeCharacter` collapses them so consumers never branch.

### External APIs

- `shared/services/anilistClient.js` — GraphQL. Throttles from the `X-RateLimit-*` headers
  the API actually returns (~30/min, not the widely-cited 90) and backs off on 429.
  `shared/services/anilist.js` batches ~15 media per aliased query to stay under AniList's
  500 query-complexity cap; the characters connection is hard-capped at 25/page.
- `games/anitune/services/animethemesClient.js` — public, no auth. Two verified quirks
  documented in the file: the API bot-filters on `User-Agent` (fine in a browser, fatal for
  Node scripts), and the audio CDN omits CORS headers on the actual GET, so `<audio src>`
  playback and Range seeking work but `fetch`/`decodeAudioData` never will.

With no `.env.local`, `firebaseEnabled` is false, `ensureInitialized()` is never called, and
local play touches no network at all. Keep that property intact.

### Styling

Tailwind v4 with all design tokens in the `@theme` block of `src/index.css` — restyling
means editing values there, not sweeping components. Each accent has a fixed semantic job
(pink = primary/guessing, purple = secondary/whose-turn, lime = yes/correct/ready,
red = no/wrong/destructive); don't pick them by vibe at the call site. The `btn-pop` /
`focus-pop` utilities carry the press-down physics. UI primitives are imported from the
`src/shared/ui` barrel; solid buttons use `text-ink`, not white, for AA contrast.

### Generated files — don't read these

`generateProfiles.js` (Node, `npm run generate`) queries AniList through
`.anilist-cache/` and writes `seedProfiles.js` — not an app module, but a script you paste
into the browser console to seed `aniguess_profiles`. It is generated, eslint-ignored, and
must not be hand-edited.

It also must not be *read*. `seedProfiles.js` is the trap here: a root-level `.js` file
that looks like source but is one enormous repetitive JSON blob, and a default 2000-line
`Read` of it burns roughly 22K tokens to show you 9% of it. Same for its inputs and the
lockfile:

| Path | Rough size | What it is |
| --- | --- | --- |
| `seedProfiles.js` | ~22K lines / ~950 KB | generated console seed script |
| `.anilist-cache/` | ~130 files / ~1.7 MB | raw AniList API responses (gitignored) |
| `package-lock.json` | ~13K lines / ~460 KB | npm lockfile |

None of the three carries architectural information. `Grep` them for a specific key when
you genuinely need one, exclude them from repo-wide searches, and never `Read` them
wholesale.

## Conventions

Comments here explain *why*, and heavily so — most are hard-won API, Firebase, or
accessibility findings that would be re-broken without them. Match that density rather
than stripping it. ESLint treats unused vars as errors, with `varsIgnorePattern: '^[A-Z_]'`.
