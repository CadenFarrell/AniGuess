# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

**Ask everything in one round before building, then build the whole thing.** Any task, however
small, starts with the questions needed to pin the spec — an assumption made silently at the
start becomes work that has to be thrown away and redone. This sets *when* a round happens,
not how big it is: a one-line tweak earns one question, not a padded set of four.

Use option menus only for genuinely concrete alternatives (2–4 of them); ask open design
questions — "how should X behave?" — in plain prose, because a menu forces a pick before the
mechanics are on the table. Both can go in the same round.

After the answers land, run to completion: no approval gates, no progress check-ins. If an
ambiguity the round missed turns up mid-build, stop and ask rather than guess — but treat that
as evidence the opening round was too thin.

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

**AniRank's board runs top-down: slot 1 is the top of the ranking — the MOST of whatever
the axis measures.** `trueOrder` sorts *descending* to match, and every axis names its ends
`topLabel`/`bottomLabel` rather than low/high. That naming is the fix for a real bug, not
tidiness: `lowLabel`/`highLabel` said nothing about which way a vertical list runs, so the
board spent a release rendering `← OLDEST` beside the slot that held the newest show. Only
the comparator knows the direction — `rankMap` ranks by *position in the list it is handed*
and `scoreBoard` compares ranks with `<=`, so both are direction-agnostic and a future flip
means editing one line. `axes.test.js` pins labels to that line by running each fact axis's
`valueFor` through `trueOrder`; without it a flipped label pair passes the entire suite,
which is how the two drifted apart in the first place.

**Scoring is Kendall tau: every pair of cards, not the neighbouring ones.** `scoreBoard`
returns `concordant` out of `comparisons` — 45 on a full ten-card board — and that `<=`
(not `<`) is what makes a tie free, since cards sharing a value share a rank. It counted
only the nine *adjacent* pairs until a randomly-dealt board scored 6/9, which is the
measurement failing rather than the player succeeding: nine of forty-five relationships
cannot describe a ranking, and a card could sit nine slots from home and cost two points
because only its neighbours ever looked. Counting every pair is proportional, still
forgiving of one bad card (9 of 45, against 2 of 9 before), and never cascades.

That choice is also why the reveal is a slopegraph. Two lines between the player's column
and the real column cross **iff** those cards are inverted, so the crossings *are* the
points lost — the picture and the arithmetic are the same object, and nothing has to be
encoded as a number inside a cell. Every earlier attempt failed by printing a card's true
rank inside the slot it was placed in: two coordinate systems in one square, so "1 next to
6" read as a claim that ranks 1 and 6 are neighbours. `explainBoard` feeds the drawing
per-card `conflicts` (how many cards this one is inverted against, summing to twice
`inversions`) — never slot distance, which calls an unpenalised tie a mistake.

**Which pool you are ranking is a control, not a property of the mode you happened to pick.**
`AxisPicker` puts a Shows/Characters toggle above both mode boxes and filters everything —
both boxes and your own prompts — to that pool. Before it, `items` was discoverable only from
a grey line under each mode name, so half of every list was irrelevant: someone tiering their
shows was offered "Would win → Would lose".

**The tab is derived from the selection, never held in `useState`** — it is just
`getAxis(value).items`. There is no second copy to fall out of step, and three things come
free: opening the picker with `fight` saved shows the Characters tab; saving a character
prompt while looking at Shows switches the tab, because the save path already calls
`onChange`; and nothing new is remembered in `prefs.js`, since `axisId` already implies the
pool. Flipping the tab goes through `axes.js`'s **`axisForPool`, which preserves `kind`** —
somebody on "Release date" who flips to Characters is still asking a factual question. Every
other fallback that lands on `DEFAULT_AXIS_ID` (deleting the selected prompt; switching into a
tier format off a fact axis) has to route through it too, because that constant is a *shows*
mode and would otherwise flip the tab as a side effect.

**The line under a mode name renders only when `needsEndLabels(axis)`** — `kind === 'fact' ||
custom`. That rule lives in `axes.js` rather than sniffing the label for an arrow, because it
is a fact about those two groups: a built-in opinion `label` is *required* to read
top-to-bottom (see the AXES header), so "BEST → WORST" under "Best → Worst" is noise, while a
fact axis names a dimension and a custom prompt names a clause and neither says which end is
#1. `axes.test.js` pins both halves, including that every opinion label actually contains the
arrow it is trusted to have. `minCount` is a prop for the same class of reason: the count
badge reddens below what *this screen* needs, which is ten for a round and two for a tier list.

### AniRank's other half: tier lists

`anirank/tiers.js` is a second pure module beside `rules.js`, not an extension of it. A
round deals ten cards and scores one board against an answer key; a tier list takes *every*
eligible show or character, has no answer key at all, and is kept afterwards. It is local
only — `format` in `prefs.js` routes `LocalGame` to `TierMode.jsx`, and the online path is
untouched.

**One shape covers both formats, and that is the load-bearing decision.** A list is rows,
each holding an ordered array of card ids; `format: 'ranked'` is *exactly one row* whose
array is the whole 1..N ordering, and `format: 'tiers'` is N labelled rows. So a "numbered
list" is not a second data structure, and every mutator, every test and the whole compare
path is written once — only the renderer branches. Same trick `pendingPlacers` plays: branch
at the single point the modes differ and nowhere else. The tray is derived (`trayCards`),
never stored, for the reason `unplacedCards` is.

**Cards are stored by folded key, never by AniList id, and never as objects.**
`normalizeProfile` runs `dedupeProfileAnimeList` on *every* read, rewriting an entry's `id`
and `title` to the best member of its franchise — so a list keyed on `anime.id` loses
entries between two sessions with no import in between. The ids are the ones `utils/deck.js`
already stamps (`franchiseTitleKey` / `characterNameKey`), which is also why a list and a
round can never disagree about what one card is. Storing objects instead of ids is the other
trap: `aniguess_profiles` is already several hundred KB on the same origin and
`storage.setItem` swallows a quota failure, so `useTierLists` reads back after every write
and surfaces a banner rather than letting an hour of sorting vanish quietly.

**`compareLists` deliberately does NOT reuse `scoreBoard`,** and reusing it looks free.
`scoreBoard` measures a board against an answer *key*: `rankMap` collapses the key's ties and
`ra <= rb` forgives them, so only one side's ties cost nothing. That is right when one side
is the truth. Two people's tier lists are equals, and a measure that changes when you swap
the arguments is not a measure of agreement — so both sides' ties are forgiven, which is the
same generosity stated symmetrically. `tiers.test.js` pins that with an explicit
swap-the-arguments test. What it *does* inherit is per-card `conflicts` as the blame metric,
for `explainBoard`'s reason plus one more: it is the only measure that survives comparing a
tier list against a ranked one, where "tier 2" and "position 2" are not the same claim.
A consequence the compare screen has to say out loud: a card can carry conflicts while
sitting in the *same* row on both lists, because everything that moved past it is an
inversion and conflicts blames both ends of one.

**Tap-to-assign is the primary gesture and the only keyboard path; drag is pointer-only.**
dnd-kit's `KeyboardSensor` activates on Space/Enter, the same keypress that fires a button's
click, so wiring it to a tile that is also tap-to-hold makes one key mean two things. Every
tile and every row target is a real `<button>` instead, which is a complete keyboard story;
`@dnd-kit` adds `useDroppable` per row and a `DragOverlay` on top of it for pointers only.
`PointerSensor` needs `activationConstraint: { distance: 8 }` or it swallows the click and
the primary gesture stops working.

**`utils/tierTone.js` is the one place red-at-the-bottom is semantic rather than vibe.**
`index.css` assigns lime = yes/correct and red = no/wrong; a tier list's top row *is* the
shows you say yes to. Every other ordered list in the app has no good/bad axis, which is why
`rail.js` steps one accent instead. Its ladder is five rungs *because* the default board is
S/A/B/C/D — a six-rung ladder made the middle row skip solid amber and come out olive — and
each rung carries its own text colour, because `text-ink` on `bg-pop-red/60` falls under AA.

### Online rooms (Firebase Realtime Database)

**The room lifecycle is `shared/hooks/useRoomCore.js`, not per-game.** AniGuess and AniTune
each grew their own copy first and the copies drifted; a game's online hook now configures
the core and adds only its own rules bindings:

```js
useRoomCore({ storageKey, playersPath, initialState, normalizeState, onExitRoom })
```

- `storageKey` — `<game>_online_room`, per-game so two games' saved rooms can't clobber
  each other.
- `playersPath` — where the roster lives under `state/`. Genuinely differs
  (`gameSession/players` in AniGuess, `players` elsewhere); the join transaction and the
  roster read both follow it.
- `normalizeState` — repairs what RTDB dropped, at the single point state enters the hook.

It owns codes, `memberUids`/`claims`/`open`, create/join/leave, the `onValue`
subscription, presence and the grace-window clock, `guard`/`bestEffort`, `patchState`, the
`once` one-shot, and host migration. What stays per-game is the
departure-reconciliation effect: noticing *that* someone left is generic, deciding what
their absence broke is not.

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

There are two such nodes, and they are mirror images — pick by who must not see the value:

| node | read | write | for |
| --- | --- | --- | --- |
| `assignments/{playerId}` | everyone **except** the owner | everyone except the owner | a value about you that you alone must not learn |
| `secrets/{playerId}` | the owner **only** | any member | a value only you may learn |

`secrets/` is read by AniFake (the dealt card) and is there for Wavelength's hidden target
and Categories' secret category too. Write is any member, not the host, because "the host"
is a `state/` value the rules cannot cheaply check, and a room's members are already
trusted with everything in `state/`.

Three things AniFake learned the hard way, all of which the next `secrets/` consumer
inherits:

- **`secrets/` is a sibling of `state/`, so `useRoomCore`'s subscription never sees it.**
  The game hook needs its own `onValue` on `rooms/{code}/secrets/{myPlayerId}`.
  `useRoom.js`'s `readAssignment` is the precedent — same shape, opposite rule.
- **Stamp each card with the round, don't clear between rounds.** A clear is N writes that
  can half-fail and leave the previous answer readable; a `forRound` stamp makes a stale
  card invisible with no write at all. AniGuess's assignments do the same. A round can now
  be dealt more than once (the card check below), so cards carry `forDeal` as well and a
  device renders its card only when *both* match — the two writes that supersede a card are
  separate and arrive in either order, so one stamp would show the old character during the
  gap. Add a stamp, never a clear, for the same reason each time.
- **Whoever computes the deal learns it.** There is no server, so one device — the host's —
  holds the answer in the clear. `dealRoles` returns it and `startGame` destructures only
  what the check phase needs, so the secret character never reaches React state or the room.
  There are **two** exceptions, both deliberate, both bounded the same way — host device
  only, never React state, never `state/`, cleared the moment the view leaves `check`, lost
  entirely by an incoming host on migration — and both gated on `allowRedeal`, so a table
  with the card check off keeps the one-function-call ceiling:

  | ref | holds | so that |
  | --- | --- | --- |
  | `dealtRef` | the folded names dealt this round | a re-deal can't hand back the card the table just rejected |
  | `fakeRef` | **who the fake is** | a re-deal keeps them in the role (`dealRoles`' `pinFake`) |
  | `secretNamesRef` | each secret in display casing | the next deal can publish the discards (see below) |

  `secretNamesRef` is not a third concession: `dealtRef` already holds the same characters
  folded, and a folded name *is* the name. It is separate only because `dealtRef` also carries
  decoys and feeds an id comparison.

  `fakeRef` is the larger concession and should be read as one: `dealtRef` holds a character
  that in blind mode is already printed on the host's own card, while this holds a fact no
  player is ever meant to learn. It is taken because without it the re-deal answered two
  different things — a bad draw, and *a role you didn't want* — and since nobody is told who
  asked, a fake could veto their way out undetectably. Every serverless alternative was
  worse: `secrets/{playerId}` is read-gated to its owner so the host can't recover last
  deal's fake from the room; a public seed or a `state/` field publishes it to everybody;
  per-device role bits still leave the host deciding who gets a null character; and choosing
  the fake only when the check ends means the fake spent the check holding the secret.
  Moving the deal into a Cloud Function is the real fix, and it is the fix for both.

**Do not hand the reveal to one device.** The obvious design makes the host publish the
answer key at the end; it breaks when the host *is* the hidden role and breaks worse when
they leave mid-round. AniFake instead has every device publish only *its own* card once the
vote closes (`state/game/reveal/{playerId}`) and derives the answer from the published set —
so nothing about the secret exists in `state/` until it is over, no device is trusted with
more than it was dealt, and a player who left is identified by elimination rather than
wedging the room. See `anifake/rules.js`'s `publishCard` / `deriveTruth`.

**A vote nobody may be seen casting is one shared flag, not a tally.** AniFake's pre-clue
card check lets anyone ask for a fresh character, and the fake — who in blind mode holds no
character at all — must not be forced to bluff about a card they cannot see. So `state/`
records only *that* someone responded (`check/responded/{playerId}`, identical for a
confirmer and an asker) plus one owner-less `check/asked` boolean every asker writes the
same `true` to. There is no count, no array, no per-player value: the property is that the
information does not exist, not that no screen renders it. The hook then returns a phase
*string* rather than `asked`, so a component cannot leak the correlation by accident. Copy
all three parts — no per-player record, one shared latch, a derived phase at the hook
boundary — for any hidden-role decision the room has to make collectively. Two limits worth
stating out loud rather than papering over: a member watching raw RTDB can correlate the
latch flipping with whoever responded just before it, and at three players a confirmer who
sees a re-deal knows one of the other two asked. Say "nobody is *told* who asked".

And note what that anonymity costs on the other side, because it is the half that got missed
first: a control nobody can be seen using is a control nobody can be held to, so it must not
change anything the presser has a stake in. The re-deal used to pick a new fake as well as a
new secret, which made one anonymous button answer both "this card is unplayable" and "I
don't want this role" — so the fake could veto their way out, undetectably, for free. Hence
`dealRoles`' `pinFake`. Give any anonymous action the same audit: list what it changes, and
check that none of it is something a hidden role would want changed.

**The blind fake cannot ask at all, and that gate is client-side by necessity.** They hold no
character, so there is nothing for them to fail to recognise, and a fake who pressed it could
be asked afterwards to justify not knowing a card they never saw — the very thing the shared
latch exists to prevent. `state/` never records who the fake is, so `rules.js` cannot enforce
this and `respondToCheck` still accepts `asked: true` from anyone; both screens gate on
`card.isFake` instead (only ever true in blind — the decoy fake keeps the button, since a
missing control on a card they are never told differs would be the tell that mode forbids).
**`pinFake` is what makes a presentational gate sufficient**: a hacked client that asks anyway
is re-dealt and is still the fake, so defeating the check wins nothing. When a rule cannot be
enforced where the state lives, make the thing it protects worthless instead.

One consequence, recorded rather than designed around: once the fake cannot ask, "I asked for
the re-deal" becomes a claim of innocence — and an unfalsifiable one, since several players
can ask and the latch merely ORs them, so two people claiming it contradicts nothing. Expect
every fake to claim it, which is why it is worth nothing.

**A re-deal creates common knowledge the hidden role does not share — publish it or it is a
free detector.** The crew all saw the discarded character; the blind fake never did. So
"everyone name the one we threw out" catches them with certainty, costs the table nothing, and
has nothing to do with how they played — a detector the card check *invented*, absent from any
round with no re-deal, and one `pinFake` sharpened (before it, a re-deal re-rolled roles, so
the new fake had often seen the discard). The fix is to stop it being secret: `dealRoles`
stamps every card with `discarded`, the fake's included, and `SecretCard` renders it in both
branches and in `compact`, since the clue phase is when a table would ask. Giving it away costs
nothing — a character that is definitively *not* the answer, out of hundreds. Decoy mode cannot
have this: its fake discarded a *different* character, so one shared list would tell them their
card differs. That mode keeps the detector and only copy can help it. Whenever a hidden-role
game lets state be replaced mid-round, ask what the discard proves.

**A one-shot key must name whatever it is meant to happen once per.** `useRoomCore` clears
`reconciledRef` on a view *change*, so `once('runoff')` is latched for the life of the
`vote` view — which is exactly what caps the runoff at one. A phase that can repeat without
the view changing needs the repeating value in the key (`redeal:${round}:${game.deal}`), or
it fires once and leaves the room wedged. Host migration was the first exception; the card
check is the second. Ask which of the two you are writing before copying either.

Two things that bite every time:

- **Multi-location `update()` rules evaluate against the pre-update tree.** A batch that
  writes `memberUids` alongside paths whose rules depend on `memberUids` existing will
  fail. Write and `await` `memberUids` first.
- **RTDB does not store empty objects/arrays** — a `{}` or `[]` write simply doesn't exist
  on read-back. Every room hook must therefore normalize state at *every* entry point (the
  `onValue` subscription *and* inside transaction callbacks, which see raw stored values)
  before handing anything to `rules.js`, which calls `.includes`/`.every` unguarded.
- **An array with gaps comes back as one of three shapes.** RTDB drops null elements, so a
  partly-filled fixed-length array (AniRank's ten slots) reads back as a *sparse* array,
  or — once it is mostly empty — as an object keyed by index (`{ "5": … }`). Normalizing
  one shape is not enough, and `Array.map`/`forEach` silently **skip holes**, so a sparse
  array needs a plain index loop. `anirank/rules.js`'s `normalizeBoard` handles all three;
  copy it rather than rediscovering this.
- **Rebuilding a keyed collection from the *active* roster deletes departed players' data.**
  The active roster is the right input to readiness gates and the wrong input to anything
  that reconstructs stored state — a normalizer fed active ids drops the absent players'
  entries on the very next write, and their answers are gone by the reveal. Normalize
  against everyone in the room; filter to active only at the gate.

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

### Game settings

Every game's remembered options live in `games/<game>/prefs.js` as a single `DEFAULT_PREFS`
literal, read through `shared/hooks/useGamePrefs.js` and stored in **one** arcade-wide key
(`aniarcade_game_prefs`, a `{ [gameId]: {...} }` map) — unlike the per-game keys that hold
state one game owns (`<game>_online_room`, `anirank_custom_prompts`).

`DEFAULT_PREFS` **is the schema**, not just a fallback: `mergePrefs` drops unknown keys and
type-mismatched values against it. Two consequences that are easy to get wrong:

- **`writePrefs` merges a partial**, and that is load-bearing rather than tidy. Setup screens
  and online lobbies are near-twins but not identical (AniFake's lobby has no talk mode), and
  a lobby that replaced the slice would wipe the options only local play can reach.
- **Adding a key changes behaviour for existing players**, because `mergePrefs` fills missing
  keys from the defaults on the next read. A new option defaulted to "on" reaches everyone
  who never opens the settings card — usually what you want, but decide it rather than
  discover it.

Adding an option means: the key in `prefs.js`, a `useState(prefs.X)` plus a line in
`applyDefaults` in **both** screens, the key in the `settings`/`remembered` object at Start
(the lobby's object is what reaches `startGame`, so a key missing there never leaves the
host's device), and — only if the *rules* act on it — a copy onto the round node in the room
hook with a `!== false`-style back-compat default in `normalizeGame`. An option that only
decides which screen renders (`talkMode`) or how a pool is drawn (`sharedOnly`, `fame`) stays
out of round state.

Anything derived from a pref that is worth testing has to live in a `.js` module — the vitest
config only runs `src/**/*.test.js` — which is why `prefs.js` and `fame.js` are separate files
from the screens that read them.

### Profiles and identity

Player profiles (name + anime list + characters) live in localStorage under
`aniguess_profiles` and are shared by every game. The key name is
historical — it predates the hub and is **not** AniGuess-specific. Leave it alone:
renaming it to something tidier would orphan every profile players have already saved.
Every read runs `normalizeProfile`, so older saved shapes are repaired without a
migration flag — and it guards missing `animeList`/`characters`, because the picker
renders *every* saved profile, so a half-shaped one now takes the hub down on mount
rather than merely being invisible.

**What a profile actually stores is narrower than what the import fetches, and
conflating the two ships a broken game.** `fetchUserAnimeList` returns far more per
show than `mergeAnimeIntoProfile` persists; anything not in the list below is dropped
at `AniListImport.runImport` and is simply not there at read time.

| entry | stored fields |
| --- | --- |
| anime | `id`, `title`, `characters`, plus the `STAT_KEYS` in `profileMerge.js` (`coverImageUrl`, `startDate`, `episodes`, `averageScore`, `popularity`) |
| character | `id`, `name`, `role`, `gender`, `imageUrl`, `description`, `favourites`, `genres` |

The stats arrived after the first games did, so **they are absent, not null, on any
profile imported before them** — a re-import backfills (`backfillStats`, which never
overwrites a value already there). A feature that ranks or filters by one must treat
missing as "not eligible" and say so on screen, the way `anirank/axes.js` returns
`null` from `valueFor` and the setup screen offers a re-import. AniRank's release-year
mode shipped dealing zero cards for exactly this reason: its comment described the
fetch shape and the code read the stored one.

Character `favourites` needs more care than the show-level stats, and AniFake's
`utils/pool.js` is the worked example. `collapseCharacters` writes `favourites ?? 0`, so
missing and genuinely-zero are the *same value* by the time anything reads it. **An
unmeasured character therefore reads as "nobody has heard of them" rather than "we don't
know", and there are three coverage cases, not two:**

| coverage | what a naive quantile does |
| --- | --- |
| none | median is 0, `fav >= 0` admits everybody — the setting does nothing |
| **partial** | ranks the measured few, so "top 15%" becomes 15% *of the imported fifth* — the round deals the same three characters forever, and nothing looks wrong |
| full | correct |

The partial case is the dangerous one because a signal technically exists, so any
`some(fav > 0)` check reports healthy. `fameFloor` handles all three in one place: it ranks
**only the entries carrying a positive count**, and returns `null` both when none do and when
fewer than `MIN_FAME_COVERAGE` of the pool do. One null, one degraded path — the fame term
zeroes out and the role ladder runs, which is why the bias must stay a *preference* (a
weighted score, never a filter). `hasFameSignal` is defined as `fameFloor(pool, 0) != null` so
the screens and the pick cannot drift about what "no data" means.

**A re-import only repairs a saved character because `addOrBackfillCharacter` makes it, and
that is recent.** Until it existed the merge early-returned on any character whose folded name
was already stored, so the fetch pulled correct data and dropped it — every field of a saved
character was frozen at its import vintage forever, and profiles imported before `favourites`
existed could never gain it no matter how many times you re-imported. The backfill follows
`backfillStats`' rule (fill absent fields, never overwrite one already there, `== null` so a
real `0` counts as an answer) and returns a NEW object, because
`mergeAnimeIntoProfile`'s `characters: [...a.characters]` is shallow — the character objects
are still the ones `ProfileProvider` holds in React state.

Repairs are counted as `updatedChars`, apart from `addedChars`: a repair run on a list you
already have adds nothing, and a screen reporting "+0 characters" reads as a failed import.
`classifyImportGroups` gains a matching `'stale'` state — every member fetched, but no saved
character carries `favourites` — so the checklist suggests exactly those shows instead of
calling them `known` and hiding them. Key it on "**none** of the cast has it", never "any lacks
it": a fetch returns only MAIN plus SUPPORTING above the favourites threshold, so a supporting
character under it can never be filled and "any" would re-suggest that show forever.

A secondary effect worth knowing when coverage still looks patchy after a repair: `preferred`
only falls through to `favourites` when portrait and genres tie, so across players a
re-imported copy can still lose to an older one.

Two things the screens must then say, because neither is inferable from the pick:
`hasAnyFameData` (ungated) separates "never fetched" from "fetched patchily" — only the second
is worth importing for — and `famousCount` reports what the level actually leaves, since a
level can be perfectly valid and still narrow a small shared list to two characters. Warn,
never gate: a small famous set is a real answer to what the user asked for, and silently
overriding a setting someone just picked is what makes one feel broken.

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

Online adds a third step, and it is easy to miss: the room stores a *copy* of the whole
profile (the player record in `state/` **is** the profile, lists and all), written at
exactly three moments — `createRoom`, `joinRoom`, and `updateMyProfile`. `saveProfile`
reaches localStorage and the provider and stops there. So the store is the source of truth
and the room copy is derived, and each `OnlineLobby` runs an effect that republishes via
`updateMyProfile` when `profileFingerprint` (`shared/utils/profileStats.js`) says the two
have diverged. Import into `activeProfile`, never into the room copy: that copy is a
join-time snapshot that has been through RTDB, so merging out of it rolls back later edits
and drops the empty-array fields the import checklist reads.

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
