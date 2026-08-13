import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import ModePicker from './ModePicker';
import {
  eligibleCharacters, famousCount, hasAnyFameData, hasFameSignal, MIN_FAME_POOL,
} from '../utils/pool';
import { FAME_LEVELS, getFame } from '../fame';
import { DEFAULT_PREFS } from '../prefs';
import { MAX_CLUE_ROUNDS, MAX_DEALS, minPool, MIN_PLAYERS } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Field, NumberInput, Screen,
  Select, Wordmark,
} from '../../../shared/ui';

// Local setup. Same shape as AniRankSetup — your main profile is already
// seated, the picker adds the rest of the couch, and nobody types a name.
export default function AniFakeSetup({ onStart, error, onBack }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  // Seeded from whatever this device last started a game with, not from the
  // literal defaults — see shared/hooks/useGamePrefs.js.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anifake', DEFAULT_PREFS);
  const [sharedOnly, setSharedOnly] = useState(prefs.sharedOnly);
  const [mode, setMode] = useState(prefs.mode);
  const [laps, setLaps] = useState(prefs.laps);
  const [talkMode, setTalkMode] = useState(prefs.talkMode);
  const [fame, setFame] = useState(prefs.fame);
  const [allowRedeal, setAllowRedeal] = useState(prefs.allowRedeal);

  const settings = { mode, laps, sharedOnly, talkMode, fame, allowRedeal };

  const applyDefaults = () => {
    setSharedOnly(DEFAULT_PREFS.sharedOnly);
    setMode(DEFAULT_PREFS.mode);
    setLaps(DEFAULT_PREFS.laps);
    setTalkMode(DEFAULT_PREFS.talkMode);
    setFame(DEFAULT_PREFS.fame);
    setAllowRedeal(DEFAULT_PREFS.allowRedeal);
    resetPrefs();
  };

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  // The entries, not just the count: the fame warning below has to ask the same
  // array whether it carries any popularity data, and building the pool twice to
  // answer that would be a second walk over everyone's whole list.
  const poolEntries = useMemo(
    () => eligibleCharacters(players, { sharedOnly }),
    [players, sharedOnly]
  );
  const eligible = poolEntries.length;
  // The setting is on but the lists cannot answer it — either nothing carries a
  // favourites count or too little does. See utils/pool.js's fameFloor. The deal
  // degrades to the old role ladder rather than failing, so this is a note and
  // never a gate on Start.
  const fameBlind = fame !== 'any' && eligible > 0 && !hasFameSignal(poolEntries);
  // How much the level is actually narrowing the draw. Zero when the term is
  // inactive, so `famous > 0` doubles as "the setting is doing something".
  const famous = fame === 'any' ? 0 : famousCount(poolEntries, fame);
  const fameTooTight = famous > 0 && famous < MIN_FAME_POOL;
  // Nothing fills a grid anymore, so the bar is what the *mode* needs to deal:
  // one character for blind, two for decoy. That is the whole reason the old
  // sixteen-character minimum is gone — it was a board size, and under "shared
  // characters only" it locked out most tables.
  const needed = minPool(mode);
  const enough = eligible >= needed;
  const enoughPlayers = players.length >= MIN_PLAYERS;
  const canStart = enoughPlayers && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md" onBack={onBack}>
        <Wordmark
          tone="teal"
          subtitle="Everyone knows the character. One of you is faking it."
          className="mb-10"
        >
          AniFake
        </Wordmark>

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="mb-5"
          onClick={() => setShowPicker(true)}
        >
          ➕ Add player
        </Button>

        {showPicker && (
          <ProfilePicker
            mode="add"
            excludeIds={players.map((p) => p.id)}
            onPick={(profile) => setPlayers((prev) => [...prev, profile])}
            onClose={() => setShowPicker(false)}
          />
        )}

        {players.length === 0 && (
          <p className="mb-6 text-center text-base text-white/40">
            Nobody seated yet — set your main profile with the 👤 button at the hub,
            or add a player above. Profiles and anime lists are shared with every game.
          </p>
        )}

        {players.length > 0 && (
          <Card padding="sm" className="mb-6">
            {players.map((p) => {
              const shows = (p.animeList || []).length;
              return (
                <CardRow key={p.id}>
                  <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                    {p.name}
                  </span>
                  {p.id === activeId && <Badge tone="purple">You</Badge>}
                  <Badge tone={shows ? 'lime' : 'amber'}>
                    {shows ? `${shows} shows` : '⚠️ No list'}
                  </Badge>
                  <Button
                    variant="neutral"
                    size="sm"
                    className="flex-shrink-0"
                    aria-label={`Import ${p.name}'s list from AniList`}
                    onClick={() => setImportTarget(p)}
                  >
                    🔗
                  </Button>
                  <button
                    onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.name}`}
                    className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                      text-lg font-black text-pop-red hover:text-white disabled:opacity-30"
                  >
                    ✕
                  </button>
                </CardRow>
              );
            })}
          </Card>
        )}

        <ModePicker value={mode} onChange={setMode} />

        <Card title="⚙️ Settings" padding="lg" className="mb-6">
          <Field label="Clue rounds" htmlFor="anifake-laps" className="mb-2">
            <NumberInput
              id="anifake-laps"
              ariaLabel="Clue rounds"
              min={1}
              max={MAX_CLUE_ROUNDS}
              value={laps}
              onChange={setLaps}
            />
          </Field>
          <p className="mb-5 text-base text-white/50">
            How many times round the table before the vote opens. More clues means more to
            go on — and more chances for the fake to trip over their own story.
          </p>

          <Checkbox
            label="Shared characters only"
            checked={sharedOnly}
            onChange={(e) => setSharedOnly(e.target.checked)}
            className="mb-2"
          />
          <p className="mb-5 ml-10 text-base text-white/50">
            Only use characters <em>everyone</em> has on their list. The whole table gives
            clues about one of them, so a character only one player has seen makes the
            round unplayable for the rest — and unfalsifiable for the fake.
          </p>

          <Field label="How well known">
            <Select value={fame} onChange={(e) => setFame(e.target.value)} className="text-lg">
              {FAME_LEVELS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </Select>
          </Field>
          <p className="mb-2 text-base text-white/50">
            {getFame(fame).blurb} Sharing a show is not the same as remembering everyone in
            it — a background character nobody can describe makes every clue meaningless
            and the fake impossible to catch.
          </p>
          {fameBlind && (
            <Banner tone="warning" className="mb-5">
              {/* Which of the two causes it is decides whether a re-import helps
                  at all, so the copy has to name it rather than always
                  recommending one. */}
              ⚠️ {hasAnyFameData(poolEntries)
                ? `Only some of these characters have popularity data, so “${getFame(fame).label}”
                   would be judging the whole table on a handful of them.`
                : `No popularity data on these lists, so “${getFame(fame).label}” has nothing to
                   go on.`}
              {' '}The deal falls back to picking a lead. Popularity arrived after these lists
              were imported — open 🔗 and re-import the shows marked “Missing details” to fill
              it in.
            </Banner>
          )}
          {fameTooTight && (
            <Banner tone="warning" className="mb-5">
              ⚠️ Only {famous} character{famous === 1 ? '' : 's'} {famous === 1 ? 'is' : 'are'}{' '}
              well known enough for “{getFame(fame).label}”, so rounds will start repeating.
              Try a broader setting, or import more lists.
            </Banner>
          )}

          <Checkbox
            label="🃏 Card check before the clues"
            checked={allowRedeal}
            onChange={(e) => setAllowRedeal(e.target.checked)}
            className="mb-2"
          />
          {/* Kept word for word identical to OnlineLobby's. The last sentence is
              deliberately public: saying out loud that a re-deal changes the
              character and not the role is what stops anyone trying to veto their
              way out of being the fake. It is a fact about the rule, not about any
              player, so it gives nothing away. */}
          <p className="mb-5 ml-10 text-base text-white/50">
            Everyone looks at their card first, and anyone who draws a blank can ask for a
            new character. Nobody is told who asked, and a round can be re-dealt at most{' '}
            {MAX_DEALS - 1} times. A re-deal changes everyone&apos;s character, but not who
            the fake is — and in Blind the fake can&apos;t ask, since they hold no character
            to not-know.
          </p>

          <Checkbox
            label="🗣️ Talk it out"
            checked={talkMode}
            onChange={(e) => setTalkMode(e.target.checked)}
            className="mb-2"
          />
          <p className="ml-10 text-base text-white/50">
            Say your clue out loud instead of typing it, and just tap to pass the turn on.
            Faster round the table — but nothing is written down, so there is no clue list
            to read back when it is time to vote.
          </p>

          <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
        </Card>

        {players.length > 0 && (
          <p className="mb-4 text-center text-base text-white/50">
            {eligible} character{eligible === 1 ? '' : 's'} to draw from
            {sharedOnly && players.length > 1 && ' (shared by everyone)'}
            {/* What the level leaves after narrowing. Worth showing even when
                the number is healthy: it is the only place the difference
                between the levels is a concrete number rather than a word. */}
            {famous > 0 && ` · “${getFame(fame).label}” narrows this to ${famous}`}
          </p>
        )}

        {players.length > 0 && players.length < MIN_PLAYERS && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Needs {MIN_PLAYERS} players — with fewer, spotting the odd one out is a
            coin toss.
          </Banner>
        )}

        {/* With a small shared list this is the ordinary outcome, not an edge
            case, so it gets a reason rather than a dead Start button. */}
        {players.length > 0 && !enough && (
          <Banner tone="warning" className="mb-4">
            ⚠️ {needed === 1
              ? 'Nobody has a character in common — found none.'
              : `Decoy mode needs ${needed} characters, so the fake can be handed a different
                 one — found ${eligible}.`}
            {sharedOnly && players.length > 1
              ? ' Turn off “Shared characters only”, or import more lists.'
              : ' Import a bigger list with the 🔗 button.'}
          </Banner>
        )}

        {importTarget && (
          <AniListImport
            profile={importTarget}
            onClose={() => setImportTarget(null)}
            onImported={handleImported}
          />
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => {
            savePrefs(settings);
            onStart({ players, ...settings });
          }}
          disabled={!canStart}
        >
          🎮 Start Game
        </Button>
      </Screen>
    </>
  );
}
