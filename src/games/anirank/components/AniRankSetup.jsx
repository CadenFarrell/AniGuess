import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import AxisPicker from './AxisPicker';
import FormatOption from './FormatOption';
import { useCustomPrompts } from '../hooks/useCustomPrompts';
import { eligibleItems, opinionPoolCounts } from '../utils/deck';
import { DEFAULT_PREFS, axisIdOf, resolveSavedAxis } from '../prefs';
import { AXES, axisForPool, getAxis, isOpinion } from '../axes';
import { BOARD_SIZE } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Screen, Wordmark,
} from '../../../shared/ui';

// Local setup. Same shape as AniTuneSetup — your main profile is already
// seated, the picker adds the rest of the couch, and nobody types a name.
export default function AniRankSetup({ onStart, error, onBack }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  // Prompts are read before the axis state, not after: only an id is saved, and
  // turning that back into a spec means looking it up among them.
  const { prompts, savePrompt, deletePrompt } = useCustomPrompts();
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anirank', DEFAULT_PREFS);
  const [sharedOnly, setSharedOnly] = useState(prefs.sharedOnly);
  // An axis SPEC, not an id — a string for a built-in, the stored prompt object
  // for one the player wrote. See getAxis.
  const savedAxis = resolveSavedAxis(prefs.axisId, prompts);
  const [axis, setAxis] = useState(savedAxis);
  const [scoring, setScoring] = useState(prefs.scoring);
  // 'round' | 'tiers' | 'ranked' — which half of the game Start opens.
  const [format, setFormat] = useState(prefs.format);
  // The saved `blind` is only trusted when the axis it was saved beside is the
  // one we actually got back. resolveSavedAxis falls back when a custom prompt
  // has been deleted, and a blind flag chosen for that prompt says nothing about
  // the axis standing in for it — so that case takes the new axis's default.
  const [blind, setBlind] = useState(
    () => (axisIdOf(savedAxis) === prefs.axisId ? prefs.blind : getAxis(savedAxis).defaultBlind)
  );

  // Picking a mode resets how it is dealt to that mode's default. Modes differ
  // enough here that a sticky toggle would silently carry "open" from an opinion
  // round into a fact one, where seeing all ten is a different game.
  const handleAxisChange = (spec) => {
    setAxis(spec);
    setBlind(getAxis(spec).defaultBlind);
  };

  // Switching to a tier format has to drag the axis with it when the current one
  // is a fact axis: those are hidden from the picker in tier mode (they filter
  // the pool by a stat older profiles do not carry), so leaving one selected
  // would show an empty picker while quietly ranking a fraction of the list.
  //
  // Through axisForPool, not straight to DEFAULT_PREFS.axisId: that is a *shows*
  // mode, so someone on "Character popularity" would be silently moved off their
  // characters as well as off facts. Only one of those two is the point.
  const handleFormatChange = (next) => {
    setFormat(next);
    if (next !== 'round' && getAxis(axis).kind === 'fact') {
      handleAxisChange(axisForPool(DEFAULT_PREFS.axisId, getAxis(axis).items));
    }
  };

  const applyDefaults = () => {
    setSharedOnly(DEFAULT_PREFS.sharedOnly);
    setScoring(DEFAULT_PREFS.scoring);
    setFormat(DEFAULT_PREFS.format);
    // Through the same handler the picker uses, so `blind` lands on the default
    // axis's defaultBlind rather than on whatever the last axis wanted.
    handleAxisChange(DEFAULT_PREFS.axisId);
    resetPrefs();
  };

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  const resolved = getAxis(axis);
  const opinion = isOpinion(resolved);
  const tiering = format !== 'round';
  // The id, not the spec — persisting a custom prompt's object would freeze a
  // copy of something the player can still edit or delete. See resolveSavedAxis.
  const remembered = { sharedOnly, scoring, blind, format, axisId: axisIdOf(axis) };

  // Counted for every axis, not just the selected one, so the picker can show
  // which modes this table can actually play before anyone commits to one.
  //
  // Custom prompts are all opinion, so their count depends only on shows vs
  // characters — two pool counts cover every prompt a player has written, where
  // counting them one by one would be a fresh pass over every list per prompt.
  const counts = useMemo(() => {
    const pools = opinionPoolCounts(players, { sharedOnly });
    return {
      ...Object.fromEntries(
        AXES.map((a) => [a.id, eligibleItems(players, { axis: a, sharedOnly }).length])
      ),
      ...Object.fromEntries(prompts.map((p) => [p.id, pools[p.items]])),
    };
  }, [players, sharedOnly, prompts]);

  const eligible = counts[resolved.id] ?? 0;
  // A board needs ten cards; a tier list needs two, because it is not a round —
  // there is no deck to fill and nothing to guess at.
  const need = tiering ? 2 : BOARD_SIZE;
  const enough = eligible >= need;
  const noun = resolved.items === 'characters' ? 'characters' : 'shows';
  // The subject is the answer key, so someone has to be guessing at them. A tier
  // list has no answer key at all, so one person is a full table.
  const enoughPlayers = opinion && scoring && !tiering ? players.length >= 2 : players.length >= 1;
  const canStart = enoughPlayers && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md" onBack={onBack}>
        {/* The subtitle is true of both deals. The old "one at a time, no
            takebacks" described blind mode, but the default axis deals open. */}
        <Wordmark
          tone="amber"
          subtitle={tiering ? 'Your whole list, best at the top' : 'Ten cards, one board, best at the top'}
          className="mb-10"
        >
          AniRank
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

        {/* Above the mode picker because it decides how much of the picker
            applies: a tier list has no fact axes, no blind deal and no score. */}
        <Card title="🎲 Format" padding="lg" className="mb-6">
          <div className="flex flex-col gap-2">
            <FormatOption
              active={format === 'round'}
              onClick={() => handleFormatChange('round')}
              title="🎲 Round of ten"
              hint="Ten random cards, one board, scored against an answer key."
            />
            <FormatOption
              active={format === 'tiers'}
              onClick={() => handleFormatChange('tiers')}
              title="📋 Tier list"
              hint={`Every ${noun.replace(/s$/, '')} you have, sorted into S–D rows. Saved and kept.`}
            />
            <FormatOption
              active={format === 'ranked'}
              onClick={() => handleFormatChange('ranked')}
              title="🔢 Full ranking"
              hint={`Every ${noun.replace(/s$/, '')} you have, in one strict order from 1 to N.`}
            />
          </div>
        </Card>

        <AxisPicker
          value={axis}
          onChange={handleAxisChange}
          counts={players.length ? counts : undefined}
          opinionOnly={tiering}
          minCount={need}
          prompts={prompts}
          onSavePrompt={savePrompt}
          onDeletePrompt={deletePrompt}
        />

        <Card title="⚙️ Settings" padding="lg" className="mb-6">
          <Checkbox
            label={`Shared ${noun} only`}
            checked={sharedOnly}
            onChange={(e) => setSharedOnly(e.target.checked)}
            className="mb-2"
          />
          <p className="ml-10 mb-4 text-base text-white/50">
            {tiering
              ? `Only use ${noun} everyone has on their list, so two lists are built from the same pool and can be compared.`
              : `Only use ${noun} everyone has on their list. Everyone ranks the same ten, so a card only one player knows is a free guess for the rest.`}
          </p>

          {/* Neither applies to a tier list — there is no deal to make blind and
              no answer key to score against — and a visible-but-inert checkbox
              is worse than one that is not there. */}
          {!tiering && (
            <>
              <Checkbox
                label="Blind ranking"
                checked={blind}
                onChange={(e) => setBlind(e.target.checked)}
                className="mb-2"
              />
              <p className="ml-10 mb-4 text-base text-white/50">
                Cards arrive one at a time and can&rsquo;t be moved once placed. Turn it off to
                see all ten at once and arrange them freely before locking in.
              </p>

              <Checkbox
                label="Keep score"
                checked={scoring}
                onChange={(e) => setScoring(e.target.checked)}
                className="mb-2"
              />
              <p className="ml-10 text-base text-white/50">
                Turn this off to just build boards and compare them at the end — no answer
                key, no points, nothing to win.
              </p>
            </>
          )}

          <SettingsFooter values={remembered} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
        </Card>

        {players.length > 0 && (
          <p className="mb-4 text-center text-base text-white/50">
            {eligible} {eligible === 1 ? noun.replace(/s$/, '') : noun} to draw from
            {sharedOnly && players.length > 1 && ' (shared by everyone)'}
          </p>
        )}

        {/* With a small shared list — or a fact axis on a profile imported before
            the stats existed — this is the ordinary outcome, not an edge case, so
            it gets a reason rather than a dead Start button. */}
        {players.length > 0 && !enough && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Need {need} {noun} to {tiering ? 'build a list' : 'fill a board'} — found {eligible}.
            {resolved.kind === 'fact'
              ? ' Re-import a list with the 🔗 button: this mode needs stats that older saved profiles don’t carry.'
              : sharedOnly && players.length > 1
                ? ` Turn off “Shared ${noun} only”, or import more lists.`
                : ' Import a bigger list with the 🔗 button.'}
          </Banner>
        )}

        {players.length === 1 && opinion && scoring && !tiering && (
          <Banner tone="warning" className="mb-4">
            ⚠️ An opinion round needs someone to guess at the subject. Add a player, or
            turn off “Keep score” to rank on your own.
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
            savePrefs(remembered);
            onStart({ players, sharedOnly, axis, scoring, blind, format });
          }}
          disabled={!canStart}
        >
          {tiering ? '📋 Open tier lists' : '🎮 Start Game'}
        </Button>
      </Screen>
    </>
  );
}

// One format. Same treatment as AxisPicker's AxisButton so the two cards read as
// one set of choices rather than two unrelated widgets.
