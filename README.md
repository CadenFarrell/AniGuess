# AniArcade

Anime games you play with friends. One hub, a growing set of games, all built on
[AniList](https://anilist.co) data so the anime and characters come from real lists —
including your own.

## Games

| Game | What it is |
| --- | --- |
| 🎭 **AniGuess** | You're assigned an anime character and have to work out who you are by asking the table yes/no questions. Local pass-and-play or online rooms. |
| 🎵 **AniTune** | Guess the anime from the sound of its opening or ending. |

Each game lives in its own folder under `src/games/` and is registered with a single
line in `src/hub/registry.js` — that list is the entire hub menu.

## Running it

```bash
npm install
npm run dev
```

Other scripts:

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint over the project |
| `npm run generate` | Rebuild `seedProfiles.js` from AniList (see below) |

## Configuration

Copy `.env.local.example` to `.env.local` and fill in your Firebase web-app config.
Firebase backs the online rooms (Realtime Database + anonymous auth); everything else
runs client-side.

To develop without touching the real project, the example file documents running
against the emulators:

```bash
firebase emulators:start --only database,auth --project demo-aniguess
```

Database rules live in `database.rules.json`.

## Seed profiles

`generateProfiles.js` queries AniList and writes `seedProfiles.js`, a bundled snapshot
of characters used to populate games without hitting the API at play time. Regenerate
with `npm run generate`. `seedProfiles.js` is generated — don't edit it by hand.

## Layout

```
src/
  hub/          the arcade menu — HubScreen + the game registry
  games/
    aniguess/   character 20-questions (local + online)
    anitune/    opening/ending quiz
  shared/       UI kit, AniList + Firebase services, hooks used by every game
  index.css     design tokens — colours, radii, shadows, fonts
```

Restyling should mean editing the `@theme` block in `src/index.css`, not sweeping
through components.
