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
npm run generate:facts # regenerate the fact pack in public/facts/ (Node script)
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

**The menu is a board rather than a list, and the tile sizing is the whole of it.**
`HubScreen.jsx` lays the roster out `grid-cols-2 sm:grid-cols-4 lg:grid-cols-6` inside a
`max-w-4xl` shell. A stacked column was already running off a laptop at six games and the
registry only grows. The ladder is picked so a tile stays roughly 136–155px at *every*
breakpoint rather than ballooning on desktop — which is why the icon inside it needs no
responsive size at all. `lg:` is the app's only one; everything else here is `sm:`-only.

Six across rather than four is also what stops the accent panel being mostly paint. The
icons are square and the marquee is `aspect-[4/3]`, so **growing the icon can never fill
the sides — the panel has to come IN to meet it.**

**The icon is sized with a definite height and never a percentage.** A percentage resolves
against a height the marquee's own `aspect-ratio` has not computed yet, so the box falls
back to sizing itself from the icon: the marquee comes out square instead of 4:3 and the
board grows straight past the fold. Same reason the emoji fallback is sized in `text-*`.

**`hub/gameIcons.js` is icon geometry as DATA, keyed by game id rather than carried on the
descriptor.** `icon` is still the emoji string and nothing about that shape changed —
`GameIcon` returns `null` when it finds no entry and the tile falls back to the emoji, so a
game added tomorrow has a working tile the day it lands and drawing it one later is a
single entry. The shapes live in a `.js` rather than in JSX for `wavelength/utils/arc.js`'s
reason: vitest only runs `src/**/*.test.js` under `environment: 'node'`, so anything
defined in a `.jsx` is untestable by construction.

`gameIcons.test.js` earns its place because **every failure here is silent.** A mistyped
key is indistinguishable from a game nobody has drawn yet, and "the icon never appeared" is
not something the hub can report. It pins the key set against the registry in *both*
directions — a game with no icon, and an orphan key naming no game — and that every shape
carries a `fill-`/`stroke-` class, because an unpainted shape is not a blank icon but a
BLACK one: SVG's default fill is black, which on this palette looks almost right.

Paint goes in `className` so the icons use the `@theme` tokens; geometry and stroke shape go
in attributes. That split is `Dial.jsx`'s. **No hex literals and no `currentColor`** —
`public/favicon.svg` is the one place hex appears in this repo, because a file in `public/`
cannot see the theme. Ink-on-accent is also what makes the unavailable card's `grayscale
opacity-50` work: a silhouette greys out cleanly where an emoji's own palette half-fades.

**A tile's blurb has two homes and exactly one is ever mounted** — `blurb-overlay` and
`blurb-inline` in `index.css`, guarded by `@media (hover: hover)` and `(hover: none)`. On a
pointer it overlays the panel on hover, which costs the tile no height and gives the text
the panel's whole depth: six lines instead of two, so a 97-character blurb stops truncating
on a 136px tile. On a touch screen there is no hover to reveal it with, and an overlay left
showing at rest would bury the artwork on every phone permanently, so there it sits under
the title and the tile is simply taller. The overlay is a **sibling** of the marquee rather
than a child, because the marquee is `aria-hidden` and nesting the text inside would drop
the blurb out of the button's accessible name.

`ArcadeMark` is `public/favicon.svg` brought into the app — the logo had lived only in the
tab. It is a **wide** plaque and that is not a styling whim: a ball on a stem over a base is
a person, the exact glyph the profile pill in the opposite corner wears, so it needs the
buttons beside it to read as a control panel — and squeezed into a 64px square a white ball
plus two white dots collapse into a face instead. Width is free on this screen; height is
not.

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

### AniWave: three modes, and the one that needs no deck

`games/wavelength/` (id `aniwave`) has three clue modes, and **`clueMode` defaults to `text`,
which draws no cards at all**. That default is load-bearing rather than arbitrary: it makes
AniWave **the only game playable before an AniList import has ever run**, which is the one
thing a brand-new player can do. `WavelengthSetup` says so in a banner, and every pool
control, count and warning is gated behind `needsCardPool(mode)` so the default path never
grows one. Do not change that default without deciding out loud that the property is going.

The other two draw from `utils/cards.js`, which is a **wrapper over `anirank/utils/deck.js`,
deliberately not a fork** — the opposite call from `anifake/utils/pool.js`, and for a stated
reason: AniFake needed different fields and a fame ladder, AniWave wants the identical card
off the identical collapse rules. Franchise folding, the folded-name character key and
portrait-beats-no-portrait are three non-obvious rules, and a second copy of them means one
show reading as two different cards between two games on one device. `POOL` passes synthetic
`{ kind: 'opinion', items }` probes, the same trick `opinionPoolCounts` uses; an opinion axis
filters nothing, which is exactly the pool a clue card wants.

| mode | target | published with the clue |
| --- | --- | --- |
| `text` | random, hidden | typed clue |
| `cards` | random, hidden | one card, **searched** out of the eligible pool |
| `readroom` | **the psychic's own dial** | the one card they were **dealt** |

**The two card modes differ on dealt-vs-searched, and that asymmetry is the design rather
than an unfinished migration.** `cards` used to deal a hand of five; on a shared list near
`MIN_CARD_POOL` that is half the deck, and the ordinary round was one where nothing in the
hand sat anywhere near the target. A hand is a *physical-deck* constraint and does not
survive the translation, so the psychic now searches the whole eligible pool through the
same `Combobox` + `rankSuggestions` typeahead AniGuess and AniFake use. `readroom` keeps its
deal for the opposite reason: the mode is judging the psychic on a card they did **not**
choose, and a psychic who can search picks one they have a loud obvious opinion about, which
measures nothing. Do not "tidy" the two into one path.

That split is why `rules.js` carries **two** predicates where it once had `dealsCards`:
`needsCardPool` (both card modes — what the setup screens gate on) and `dealsHand`
(`readroom` alone — what the hooks write into `secrets/`). Merging them writes a hand the
mode never reads and leaves `myDealReady` waiting on a card that is never coming, which is a
round stuck on "Dealing you in…" forever. `sharedOnly` also stops being merely advisable and
becomes the only thing between the table and a psychic who searches up something nobody else
has watched — the deal used to prevent that structurally.

One cost, paid deliberately: `cards` and `text` converge, since both are now "say anything".
What still separates them is that a card is unambiguous and pictured, and that the round is
about anime rather than about vocabulary. The search box's empty state shows a `BROWSE_SIZE`
strip of random eligible cards — a search box is a worse cold start than a hand was, since
with nothing typed there is nothing on screen to react to. It is not a hand: every other
eligible card is one query away, and it never rerolls.

`readroom` sounds like a different game and isn't: the answer key stops being a random number
and becomes an opinion, but it still arrives through `revealTarget` from the psychic's device
alone, so every guarantee below holds unchanged. `scoreDial`, `explainRound` and `finalScores`
never learn the mode exists — `submitClue` is the only function that branches.

**`spectra.js` is a fork of `axes.js`'s discipline, not an import.** An axis carries `kind`,
`items`, `defaultBlind`, `valueFor` and a "rank these as {name} would" prompt; a spectrum is
two words. The precedent is `anifake/utils/pool.js` forking `deck.js` for the same reason.
What *is* copied is the direction rule — `leftLabel` names dial value `DIAL_MIN` — and here a
flipped pair does not merely mislabel a track, it silently inverts every score, so
`spectra.test.js` pins the labels against `scoreDial` exactly as `axes.test.js` does.
The display label is *derived* (`${leftLabel} → ${rightLabel}`), so unlike AniRank's the two
cannot disagree. `utils/arc.js` pins the same promise in geometry — `valueToAngle(DIAL_MIN)`
is the left cap — because the arc dial is a second place the two ends can be swapped.

**A written spectrum travels as its whole definition, never as an id.** `getSpectrum` is the
polymorphic resolver `axes.js`'s `getAxis` already is, and the custom branch must come
**first**: a stored custom carries an id that resolves to nothing, so checking `spec.id`
before `spec.custom` would silently play every written spectrum as `FILLER → CANON` on every
device. The round's field is `spectrum` and `normalizeRound` still reads `spectrumId` — the
same back-compat seam as `settings?.axis ?? settings?.axisId`. `spectra.test.js` pins the
JSON round-trip, which *is* the online path.

**The psychic's own device draws its own target — and in `readroom` its own card — and no
other device ever computes either.** This is the one place the arcade escapes AniFake's
"whoever computes the deal learns it" concession: `startRound` writes only `psychicId`,
`round` and `mode`, and the psychic's device writes `{ target, hand, forRound }` to
`secrets/{psychicId}` (`hand` null in the two modes that are dealt nothing). Stamped, never
cleared, for the reason every other secret is — and the freshness check is on the **stamp**,
not on the target, because `readroom` legitimately has no target until the psychic places one.
The one-shot key needs the round in it (`secret:${round}:${playerId}`) — `useRoomCore` clears
its latches on a *view* change and the view stays `round` all game, so without it round two
sits clueless forever.

That the psychic's device *can* deal is worth stating: the roster in `state/` carries each
player's whole profile, so `eligibleCards` is computable anywhere. It is computed there and
only there. **It is also what makes player-written spectra possible at all** — the host has
never seen them, so the host cannot offer them, so the psychic must be the one who chooses.
`SpectrumPicker`'s candidates therefore never enter room state; only the pick is published.

`cards` mode's search box is the same fact used a second time: `searchableCards` runs on the
psychic's device off that same roster, so the whole eligible pool, every query typed into it
and every candidate it offered stay local, and only the card finally played is published.
Both hooks gate the memo on being the psychic in a `cards` round, because it flattens every
seated player's anime list and a guesser would pay for a list they never see.

**A round can never be in the guess phase without a spectrum.** `submitClue` publishes the
spectrum, the clue-or-card and the phase change in one patch, so the alternative — two writes
that can arrive in either order or half-fail, leaving the table dialling against blank ends —
is unrepresentable rather than merely avoided.

**The cost is stated rather than papered over: the psychic is the target's sole holder.** It
reaches the room only when they publish it at the moment dials lock — never at clue time,
which would put the answer in `state/` while people are still guessing. A psychic who leaves
in between takes it with them and `abandonRound` voids that round, keeping totals. Do **not**
"fix" this by having the host keep a backup: the host is a guesser that round, which is
strictly worse than the concession it imitates. `skipDepartedPsychic` splits the two cases —
in `clue` nothing is committed so the role is simply handed on, in `guess` it is unrecoverable.

**Presence cannot see a player who is connected and simply not acting, so there are two manual
endings — and each sits on the only device that can perform it.** `revealNow` is the psychic's,
because a reveal needs the target and they are its sole holder; it is the same call the clock
makes, reached early, and it is what stops an untimed round waiting forever on somebody who is
reading their phone. "Abandon this round" is the host's, because the case it covers is *the
psychic* having stopped responding. Do not merge them into one host control: that would need the
host to hold a target, which is the backup copy the paragraph above forbids. The residual limit,
recorded rather than designed around: a host who is also the stalled psychic leaves neither
button with a live device behind it, and only presence recovers that room.

**A timed round reveals `REVEAL_GRACE_MS` *after* its deadline, and the gap is load-bearing.** At
expiry every guesser holding a placed-but-unlocked dial submits it, so revealing on the same
instant races the writes it should be collecting and scores as "no dial" a guess the player can
see in front of them. That auto-lock lives in `OnlineGame` rather than in `GuessView`, because up
there the "have I locked already?" guard is `iHaveDialled` — real round state — while down there
it can only be a latch, and react-hooks forbids both spellings of one (a ref cannot be read during
render to caption the result, a state latch is a setState inside an effect). The draft is
deliberately *not* cleared on that path, so the screen keeps saying the dial went in; a
render-time reset keyed on the round number is what clears it, since "next round" is a host-only
button and a guest's draft would otherwise pre-place their dial in the round after. The hook therefore runs **two** `useDeadline` clocks:
the one `GuessView` renders drains to the real deadline, because that is the number the table was
promised, and a second one offset by the grace gates the reveal and nothing else. The duration
lives in `rules.js` and the instant does not, for the reason `startRound` reads `deadline` and
never invents one.

**Local and online are symmetric, and that is what keeps the game small.** `dials` is
`{ [playerId]: number }` in both — online each guesser writes their own, locally each writes
their own as the device is passed — so `finalScores` branches nowhere: a guesser scores their
own dial, the psychic scores the mean of the dials *actually placed*. Non-dialers are excluded
from that mean rather than counted as zero, or the psychic's score would measure the room's
connection quality. `normalizeDials` invents no entries, which is why the "rebuilding from the
active roster deletes departed players" trap cannot bite it.

**The arc dial splits keyboard from pointer, and both halves are load-bearing.** The flat bar
it replaced could let one transparent `<input type="range">` take everything, because a range
maps *x* linearly to value and so did the track. On an arc it does not — x is `cos(angle)` —
so a tap on the visible needle would jump elsewhere. The input therefore stays for what only
it can do (arrow keys, Home/End, `aria-valuetext`) with **`pointer-events: none`**, and
pointers go through `pointToValue` on the SVG. Deleting either half breaks a whole class of
user. `pointToValue` clamps below the baseline to the **near** cap: `atan2` goes negative
down there, and reading that as past `DIAL_MAX` would snap a drag heading for the left cap to
the far right — which happens in ordinary play, since a finger crosses the baseline first.

Three traps worth knowing before touching it.

- `normalizeRound` rebuilds from **named** fields rather than spreading `raw`, so a field the
  hook writes and it does not name is dropped on the first read — that is how `deadline`
  silently never started a clock, and the round now has five more fields to forget.
- `Number(null)`, `Number('')` and `Number([])` are all `0`, a perfectly finite dial at the far
  left, so `toDial` screens *before* coercing; a range input reports `''` before first paint
  and RTDB returns `null` for a cleared key, so both arrive in normal play.
- **A background tab does not run `requestAnimationFrame`.** The reveal's score count-up froze
  every total at `+0` until the player looked back at it, which self-heals — and that is what
  made it dangerous, since a screenshot or a second monitor showed a table where nobody scored.
  `prefersStill()` treats `document.hidden` exactly like `prefers-reduced-motion`. Correctness
  must never depend on an animation completing; an animation nobody can see is worth nothing.
  The band and marker keyframes have the matching property by construction — they animate
  **from** a start state with no `to`, so removing the animation leaves the finished picture
  rather than a blank one.

### AniTag: the arcade's only inductive game, and its only two-player one

`games/categories/` (id `anitag`) is AniGuess inverted. There you are dealt a character you
cannot see and ask yes/no questions about it; here a **category** is hidden and you offer
characters — "Nezuko?" — until you can state the rule. Same hidden-value seam, opposite
direction of inference.

**A go is ONE name, and the seat moves after every one of them.** `settlePending` writes the
next `seatId` alongside the trail entry, so P1 names one thing, the table answers, and it is
P2's go — which at two players is the back-and-forth the game reads as, and at six means nobody
waits through five whole hands before their first name. `cap` is therefore **names per player
per round**, not the length of an uninterrupted block. What ends a player's *round* is unchanged
and is the only thing `results` has ever meant: a correct declaration, a give-up, or spending
the cap. Everyone else plays on until they each reach one of those, and the last player standing
simply keeps the seat (`seatFrom` falls back to them, because their own missing result is what
makes the scan wrap round).

`seatFrom` sits beside `nextSeatId` rather than inside it because the two callers want different
offsets, and that is the whole of the rotation: `startRound` scans from the **round number**, so
the opening seat moves between rounds; everything mid-round scans from **the seat's own index
plus one**, so a name hands on to the person sitting next. `nextTurn` is now the rare half — it
fires only from `turnEnd`, which only a *finished* player produces.

**It comes in two modes, and they are mirror images.** `categoryMode` in `prefs.js`:

| | `chosen` (the default) | `dealt` |
| --- | --- | --- |
| your clause | you **pick** it; only you know it | you are **handed** one; everyone but you knows it |
| who answers a name | **every** other player, each against their own | one derived judge, against the seat's |
| what you declare | somebody **else's** rule, at a named target | **your own** rule |
| where it lives | `secrets/{playerId}` | `assignments/{playerId}` |

**`requiredJudges` is the entire branch between them, and keeping it that way is the load-bearing
decision.** One round shape, one `pending` slot, one `trails` map, one `results` map, one
`scoreTurn`, one departure story. Every mutator asks the same single question — *who must rule on
the thing currently pending?* — and nothing else in `rules.js` learns that modes exist. That
survived the seat starting to move: `judge` and `settlePending` now take `playerIds`/`skipIds`,
but purely to answer *who sits next*, which is a question neither mode answers differently. It is the
same move `tiers.js` makes with "a ranked list is exactly one row". Adding a second branch is how
this becomes two games sharing a folder.

**It needs no AniList import, and that is the property to protect.** A profile stores no studios,
no tags and no show-level genres (see the table below), so "wears glasses" is unanswerable by any
code in this repo and always will be. The judge is therefore a person, so a proposal is free text,
so nothing is drawn from anybody's list. `prefs.js` deliberately has no `sharedOnly`, no card pool
and no minimum list size, and `prefs.test.js` pins that by rejecting any key matching
`/shared|list|deck|fame|import/`. AniWave's default clue mode is the only other game with this
property. Adding a pool-shaped option here is adding the requirement itself — decide it out loud
rather than discover it.

**Neither mode required a `database.rules.json` change**, because both read-gated nodes were
already deployed. Which one a clause belongs in is decided by *who must not see it*, and AniTag is
now the worked example on **both** rows of that table — see the node table below. Reaching for the
wrong one is silent: a `chosen` clause in `assignments/` is readable by everyone it is hidden
from, and a `dealt` one in `secrets/` is readable by precisely the one player the mode is built
around keeping in the dark.

**`dealt`: nobody deals their own, and two dealers is what guarantees it.** The host writes every
slot but its own; the first other seated player writes the host's. Both writes are legal under the
deployed rule and the forbidden one is refused by Firebase rather than by a client-side check, so
a bug there is a `PERMISSION_DENIED` instead of a silent leak. This is where the arcade escapes
AniFake's "whoever computes the deal learns it" concession rather than inheriting it: AniFake's
host holds a value *nobody* may know, while here every player is meant to know everyone else's, so
the only forbidden computation is a device's own — and two dealers arranges that. **One residual
limit, recorded rather than designed around:** the second dealer cannot read its own category, so
when drawing the host's it cannot exclude the one clause it holds. It excludes every clause it
*can* see, leaving a roughly one-in-a-dozen chance those two share. It is unfixable without a
server — any device able to exclude every dealt category would by construction know its own.

**`chosen`: there is no deal at all**, which is strictly stronger and much less machinery. Every
device writes its own clause to its own `secrets/` node and nothing else, so no device ever holds
a value it is not entitled to. The round opens in a `picking` phase and waits until every
**active** player has committed one — active, so a closed tab cannot hold the table on the opening
screen forever.

**First claim wins, and it plugs a real hole rather than adding flavour.** Verdicts are public —
the trail *is* the information channel — so the moment P1 correctly declares P2's clause the whole
table knows it, and `scoreTurn` pays a solve with **zero names spent the maximum**. Without a rule,
a later seat re-declares it for free and outscores the person who worked it out. So a player can
be correctly declared exactly once per round: `claimedTargets` records it, `declarableIds` stops
offering them, `declareCategory` refuses. Three consequences worth keeping:

- **A wrong declaration claims nobody.** Missing at somebody must not lock them away from the
  players who could have got them — and the softened miss below makes that matter more, not
  less: a missed player is still worth full marks to everybody else.
- **`revealAllowed` is the same fact read from the other side.** A clause may be shown once its
  owner is claimed (it is worth nothing now) or at `roundEnd`, and **never** after a wrong
  declaration — revealing an unclaimed clause hands the next seat exactly the free points the
  claim rule exists to deny. `publishCategory` is AniFake's `publishCard` shape: the owner is the
  only device that can publish, because they are the only one that can read.
- `declarableIds` **can legitimately come back empty** — at three or more players when everyone
  else has been claimed, and at any size once a seat has missed at everybody left. The screen has
  to say so rather than render a dead control.

**A wrong declaration costs `WRONG_DECLARATION_COST` names, not the round, and it is carried by
the trail with no new state.** It used to end the turn outright, which was right when a turn was
an uninterrupted block of ten and is a spectator sport now that the seat moves every name — a
miss on name two would mean watching the rest of the round on a device you are holding. So the
miss lands in the misser's own trail as an entry with `kind: 'declaration'`, and
`proposalsUsed` **weighs** that entry rather than counting it. One entry does three jobs: the
penalty (and `used` already flows into `scoreTurn`, so it is priced in the currency the game
had), the record `declaredTargets` reads to stop the same person being aimed at twice, and a row
the table can read. A miss that *spends* the cap does end the round, which is the floor under the
rule — without it a player one name from the cap could guess for free.

`declaredTargets` is the mirror of `claimedTargets` and deliberately **not** the same shape: a
claim is global (nobody may declare that player again), a miss is personal (only the player who
spent the names is barred). Hence one takes a `playerId` and the other does not. Both are
subtracted by `declarableIds` and refused by `declareCategory`, so a stale screen cannot spend
names on a declaration that was never going to land.

**Two named fields exist only because a miss no longer stops the round to announce itself.**
`normalizeTrail` has to carry `kind` and `targetId` — an entry that came back as a plain name
would silently refund two thirds of the penalty *and* unlock the target — and `lastPlayed` is one
overwritten slot holding what the table just watched, which is what the turn screen says out loud
now that there is no `turnEnd` screen to say it. Both are the "rebuild from NAMED fields" trap,
one level apart.

**Who opens still rotates between rounds** (`startRound` passes the round number as
`nextSeatId`'s `startAt`). With the whole table answering every name, whoever opens has seen the
fewest verdicts about clauses they may declare; rotating spreads that across the session. Passing
0 reproduces plain roster order exactly.

**The judge is derived, never stored,** and that is what makes a judge who walks out a non-event.
In `dealt` mode `judgeIdFor` returns the next active player on the next render, with no write; in
`chosen` mode a departed judge simply stops being required. Do not "fix" this by storing a
`judgeId`. What the second case *does* need is `settlePending` as a **separate** pure function
from `judge`: the required set shrinks on a departure, so a pending that could not settle a minute
ago can settle now with no new verdict at all — and the only thing that can notice is an effect,
which has no verdict to submit. An empty required list ends that player's round rather than
inventing one. Only a departed **hot seat** needs `skipDepartedSeat`, because only they hold a go
nobody else can finish — and it keeps the round in `picking` if that is where it was, or it would
open a go before the table has clauses to answer with.

**The hot seat can never publish their own answer in `dealt` mode,** which is the mirror of
AniFake's `publishCard` and lands in the same place. At the end of their round they are the one
person who still does not know what their clause was, so `attachCategory` lets *any* non-owner
write it onto the result — idempotent, refuses to overwrite, so a judge who leaves between ruling
and revealing costs nothing. `chosen` mode inverts it exactly: only the owner can, because only
the owner can read.

**A player's written categories never enter room state, in either mode.** Each device draws from —
or offers — the built-ins plus its own local list (`anitag_custom_categories`), and only the clause
actually in play is published, the same rule AniWave applies to written spectra. The visible
consequence in `dealt` mode, which is fine: the host can only ever receive a built-in or something
the second dealer wrote, never one of their own.

**One pool per session, not one per player** — and the two modes need it for different reasons. In
`dealt` the hot seat cannot see their clause, so the prompt telling them whether to name a show or
a character is the only thing that says which pool it is about, and a per-player pool would turn
that prompt into a clue. In `chosen` everybody knows their own, but they are all answering the
*same* name, so one player holding a clause about shows while the table names characters can only
ever say no.

**A trail entry carries a verdict *map*, not a boolean** (`{ text, verdicts: { [judgeId]: bool } }`
— `dealt` is simply a map of one), because in `chosen` mode *which* player said no is the entire
fact. `verdictsOf` is the one place that flattens the three stored shapes, including the
unattributed scalar a pre-`chosen` build wrote, so no screen branches.

**There is deliberately no "skip my go".** `passTurn` drops you out of the round; nothing passes
the seat on for free. Now that the seat moves every name, a free skip would be a stalling
strategy — sit out every go, watch everyone else's verdicts accumulate, then declare off their
evidence with a full cap in hand. Naming one thing is the price of staying in.

**Local play's handovers differ by mode**, which is the one place the modes really diverge on a
shared device — and the moving seat costs neither of them anything, which is worth stating
because it is not obvious. `dealt` has no pass screens: the only hidden value is the seat's
clause, so the device sits in the middle and `CategoryPeek` hides that one thing behind a toggle
(it now re-closes on every name rather than once a turn). `chosen` has **one pass screen per
player per round** and then none at all: a clause has to be on screen exactly once, while its
owner picks it, because every judge afterwards rules from memory. Between picks nothing hidden is
on the device, so a go changing hands is somebody leaning over, not a handover. Both use a
**toggle rather than a hold** for the reason AniRank's tier board gives about dragging: a
keyboard user cannot hold a button, so the tap path has to be the real one.

**The screens follow from the moving seat, and three of them exist only because of it.**
`SeatStrip` draws the whole rotation from `turnOrder` (roster order *is* seat order), because
otherwise the only evidence the seat moved is a heading that changed — which reads as the game
jumping. `TrailBoard` groups every trail by owner with yours open and the rest collapsed: one
trail was complete while a turn was a block, and now a player's own evidence would leave the
screen the instant they hand the go on. And `TurnScreen` is a header, **one** card and the trail:
`judging` and `naming` are mutually exclusive by construction, so exactly one of them is being
asked of you and it gets the only surface. `AniTagSettings` is shared by the setup screen and the
lobby for CLAUDE.md's own near-twin reason — it was the same hundred lines in both files.

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

`secrets/` is read by AniFake (the dealt card), AniWave (the hidden target, plus
`readroom`'s dealt card — see that section for why the freshness check is on the stamp rather
than on the target) and AniTag in `chosen` mode (the clause you picked). Write is any member,
not the host, because "the host" is a `state/` value the rules cannot cheaply check, and a
room's members are already trusted with everything in `state/`. AniTag is the one case where
the writer is the *owner* — nobody else could, since nobody else may read it.

`assignments/` is read by AniGuess (the character you are guessing) and AniTag in `dealt` mode
(the category you are guessing).

**AniTag sits on BOTH rows, one mode each, which makes it the worked example** — and it earned
that by getting it wrong first: this note used to promise `secrets/` to "Categories' secret
category", and it named the wrong node. The question is never "is this a secret" but **who
must not see it**, and the two AniTag modes answer it in opposite directions:

- `dealt` — the clause is known to the whole table and hidden from exactly one person.
  `assignments/`. Written to `secrets/` it would have been visible to precisely the one player
  the mode is built around keeping in the dark.
- `chosen` — the clause is known to exactly one person and hidden from the whole table.
  `secrets/`. Written to `assignments/` it would have been readable by every single player it
  exists to be hidden from, and the round would look normal the entire time.

Ask "who is this hidden from" before reaching for either. Both mistakes are silent.

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

**A setting's note comes in two tiers, and `shared/components/SettingHelp.jsx` is the only
place either one is styled.** Every setup screen and lobby used to hand-place a `<p
className="ml-10 text-base text-white/50">` holding both halves at once; four games' worth
of that put a two-to-four line paragraph under every single-line control, so a settings card
ran roughly three times taller in prose than in controls and read as a wall rather than as
help. None of the copy was deleted — several paragraphs carry rules the table actually needs
— the *why* simply stops being the first thing on screen. The split is nearly always where
the existing paragraph already broke: its opening sentence names the behaviour and the rest
argues for it. Pass the first as `children`, the second as `more`.

The weight was the other half of the problem. Helper copy had drifted to three treatments
across the games (`text-base text-white/50`, `text-sm text-white/50`, `text-sm
text-white/30`), and with no consistent signal for "this is the secondary line" the volume
read as noise instead of hierarchy. Everything routes through here now, at two weights only.

**`DetailToggle` goes on a card only when that card has something to reveal**, and on every
such card rather than once per screen — two of them a few hundred pixels apart is mild
redundancy, while a card full of quietly-truncated notes whose control is somewhere above
the fold is a feature nobody finds. AniTune's second card is every-note-one-line and so
carries no toggle rather than an inert one.

**Both halves fail soft, deliberately.** `useHelpDetail` returns `{ detail: false, setDetail:
null }` outside a provider instead of throwing, and `DetailToggle` renders nothing at all
there rather than a control that does nothing. This is presentation only, and its consumers
are leaf components scattered across every game's setup screen — exactly the population most
likely to end up in a future screen nobody remembered to wrap.

AniFake and AniRank keep their copy in a `help.js` beside `prefs.js`, being long enough that
inlining buried the controls in JSX; AniTune and AniGuess inline theirs. **The preference is
arcade-wide and gets its own localStorage key** (`aniarcade_setting_detail`), not a slot in
`aniarcade_game_prefs`: that map is `{ [gameId]: {...} }` and each game's `DEFAULT_PREFS`
*is* its schema, so there is nowhere in it for a value belonging to no game. Off by default,
which is the point of the split — the short line is what a returning player should meet. It
is deliberately absent from `resetKeys.js`'s `PRESERVED_KEYS`: a crash reset clearing a
cosmetic preference is the right outcome, and the default it falls back to is the quiet one.

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

### Fact packs: the answers a profile cannot derive

Every game above computes its own answer key on the device — `valueFor` reads a stored
field, `trueOrder` sorts it, `scoreBoard` grades against it. "Who directed this" is not a
function of anything a profile holds (see the table above for how narrow a profile actually
is), so a quiz-style game cannot work that way: **the answer has to ship with the
question.** `generateFacts.js` (Node, `npm run generate:facts`) writes a pack, `public/facts/`
serves it as a static file, `shared/services/factPack.js` loads it, and
`shared/utils/facts.js` holds every pure part of it.

**The pack that ships today is EMPTY, and visibly so on purpose** — `index.json` says
PLACEHOLDER and names zero shows, zero characters, zero facts, because AniList's API was
down while the pipeline was built. **Nothing in `src/` reads it yet.** A consumer must treat
an empty pack as normal rather than as a failed load, and must not be written assuming a
populated one has ever existed.

**A pack key is the SAME fold a saved profile keys on** — `franchiseTitleKey` for shows and
`characterNameKey` for characters, exactly what `anirank/utils/deck.js` computes when it
collapses a profile into cards. That identity is the whole targeting design: "only shows
this room imported" becomes a Set lookup at draw time and "any show at all" is skipping it,
so which game asks what is not decided in the data and nothing has to be regenerated to
change the answer. The keys are re-exported through `facts.js` rather than imported
directly by the generator, so the two sides cannot drift on what a key is. `anilistId` is
carried as **provenance only** — identity in this repo is deliberately not id-based, since
the ids ListManager mints and AniList's own share no id space, so a lookup routed through
it would miss every hand-entered entry.

**The loader takes two fetches and the indirection is the point.** The manifest is small and
always revalidated; the pack file it names is immutable and can be cached hard. A data fix
is then "write `pack-v2.json`, change one line of `index.json`" — no app code change, no
rebuild, no redeploy of anything but those two files. A bundled `import()` of the JSON was
rejected for that reason plus one more: it is parsed as JavaScript on every load by every
player, including everyone who never opens the game.

Everything testable lives in `shared/utils/facts.js` rather than in the generator, for the
reason `prefs.js` and `fame.js` are separate from the screens that read them — logic in a
root-level script is logic with no test. **It carries explicit `.js` extensions**, unlike the
rest of the app, because `generateFacts.js` imports it under plain Node, which does not do
Vite's extensionless resolution; `franchise.js`'s import of `./ranking.js` carries one for
the same reason. That is the price of the generator and the app sharing one definition of a
key, and sharing it is exactly the point.

`facts/overrides.json` is applied **after** generation, so a regeneration can never clobber a
hand-made correction, and a `null` value there *suppresses* a fact the source got wrong.
`generateFacts.js` imports `anilistClient.js` directly rather than hand-rolling a throttle —
that module is plain fetch and timers and is Node-safe despite its "for the browser" header.
`generateProfiles.js` keeps its own 600ms copy only because it predates it, and a third copy
is how a rate-limit fix ends up applied to two callers out of three.

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
| `.facts-cache/` | grows with the catalog | same, for `generateFacts.js` (gitignored) |
| `package-lock.json` | ~13K lines / ~460 KB | npm lockfile |

None of them carries architectural information. `Grep` them for a specific key when you
genuinely need one, exclude them from repo-wide searches, and never `Read` them wholesale.

Two root-level files near these are **not** generated and are meant to be edited by hand:
`animeCatalog.js`, the show list both generators read (it was lifted out of
`generateProfiles.js` so there would be one copy), and `facts/overrides.json`. Neither is
large. `public/facts/pack-v1.json` *is* generated output, but it is currently an empty
placeholder — see the fact pack section rather than reading it for content.

## Conventions

Comments here explain *why*, and heavily so — most are hard-won API, Firebase, or
accessibility findings that would be re-broken without them. Match that density rather
than stripping it. ESLint treats unused vars as errors, with `varsIgnorePattern: '^[A-Z_]'`.
