import { hasLives, isRace } from '../rules';
import { MODES } from '../modes';
import { PLAYBACK_RATES } from '../prefs';
import {
  eligibleEntries, SAMPLE_POINTS, YEAR_MIN, YEAR_MAX, yearRangeIsOpen,
} from '../utils/questionPool';
import {
  POPULARITY_LEVELS, getPopularityLevel, hasPopularitySignal, hasAnyPopularityData,
  MIN_POPULARITY_POOL,
} from '../utils/popularity';
import {
  Banner, Card, Checkbox, Field, NumberInput, Select,
} from '../../../shared/ui';

// The mode picker and both settings cards, rendered identically by the local
// setup screen and the online lobby.
//
// Extracted rather than duplicated, and that is a change of approach worth
// stating: AniTune's two setup surfaces offer exactly the same options, and the
// old arrangement made adding one option a four-place edit (a useState and an
// applyDefaults line in each screen). At six settings that was tolerable; at
// seventeen it is a guarantee the two will drift. The screens now hold a single
// `settings` object and hand it here.
//
// prefs.js is still the schema — this component never invents a default, it only
// renders what it is given.

// The pool as each dial sees it, so a warning can say what that dial cost rather
// than reporting a number the player cannot attribute to anything.
function poolStages(players, values) {
  const base = eligibleEntries(players, { sharedSongsOnly: values.sharedSongsOnly })
    .map((e) => e.anime);
  const afterYear = eligibleEntries(players, {
    sharedSongsOnly: values.sharedSongsOnly,
    yearFrom: values.yearFrom,
    yearTo: values.yearTo,
  }).map((e) => e.anime);
  const final = eligibleEntries(players, {
    sharedSongsOnly: values.sharedSongsOnly,
    yearFrom: values.yearFrom,
    yearTo: values.yearTo,
    popularity: values.popularity,
  }).map((e) => e.anime);
  return { base, afterYear, final };
}

export default function AniTuneSettings({ players, values, onChange, disabled = false }) {
  const set = (patch) => onChange(patch);
  const { base, afterYear, final } = poolStages(players, values);

  const level = getPopularityLevel(values.popularity);
  const dialIsOn = level.quantile != null;
  // Three states, not two — the distinction AniFake's pool.js exists to make.
  // "Nothing was ever fetched" and "some was" look identical to a naive check,
  // and only the second is fixed by importing more lists.
  const canMeasure = hasPopularitySignal(afterYear);
  const anyData = hasAnyPopularityData(afterYear);
  const yearNarrowed = !yearRangeIsOpen(values.yearFrom, values.yearTo);

  return (
    <>
      {/* Mode. aria-pressed rather than a radio group because these are big
          tappable blocks, not a form control. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {MODES.map((m) => {
          const selected = values.mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => set({ mode: m.id })}
              disabled={disabled}
              aria-pressed={selected}
              className={`focus-pop rounded-pop border-2 p-4 text-left transition-colors disabled:opacity-40
                ${selected
                  ? 'border-pop-blue bg-pop-blue/15'
                  : 'border-white/15 bg-surface hover:border-white/30'}`}
            >
              <span className="text-2xl">{m.icon}</span>
              <p className="mt-1 font-display text-lg font-extrabold text-white">{m.label}</p>
              <p className="mt-1 text-sm text-white/50">{m.blurb}</p>
            </button>
          );
        })}
      </div>

      <Card title="⚙️ The round" padding="lg" className="mb-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row">
          <Field label="Questions" htmlFor="anitune-round-size" className="flex-1">
            <NumberInput
              id="anitune-round-size"
              ariaLabel="Questions"
              min={1}
              max={50}
              value={values.roundSize}
              disabled={disabled}
              onChange={(roundSize) => set({ roundSize })}
            />
          </Field>
          <Field label="Clip length (s)" htmlFor="anitune-clip-seconds" className="flex-1">
            <NumberInput
              id="anitune-clip-seconds"
              ariaLabel="Clip length in seconds"
              min={3}
              max={30}
              value={values.clipSeconds}
              disabled={disabled}
              onChange={(clipSeconds) => set({ clipSeconds })}
            />
          </Field>
        </div>

        <Checkbox
          label="Timed guesses"
          checked={values.timed}
          disabled={disabled}
          onChange={(e) => set({ timed: e.target.checked })}
          className="mb-2"
        />
        {/* ml-10 lines the note up with the label, clearing the 7-unit box plus
            its 3-unit gap. */}
        <p className="mb-4 ml-10 text-base text-white/50">
          A countdown per song, and the faster you answer the more the point is worth
          (up to double). Turn it off and every correct answer is worth exactly one,
          with no clock at all.
        </p>

        {values.timed && (
          <div className="mb-5 ml-10 flex flex-col gap-4 sm:flex-row">
            <Field label="Guess time (s)" htmlFor="anitune-guess-seconds" className="flex-1">
              <NumberInput
                id="anitune-guess-seconds"
                ariaLabel="Guess time in seconds"
                min={5}
                max={60}
                value={values.guessSeconds}
                disabled={disabled}
                onChange={(guessSeconds) => set({ guessSeconds })}
              />
            </Field>
            {/* Only race has a second, shorter clock — the one that starts when
                somebody claims the song. */}
            {isRace(values.mode) && (
              <Field label="Answer time (s)" htmlFor="anitune-answer-seconds" className="flex-1">
                <NumberInput
                  id="anitune-answer-seconds"
                  ariaLabel="Answer time after buzzing, in seconds"
                  min={3}
                  max={30}
                  value={values.answerSeconds}
                  disabled={disabled}
                  onChange={(answerSeconds) => set({ answerSeconds })}
                />
              </Field>
            )}
          </div>
        )}

        {hasLives(values.mode) && (
          <Field label="Lives each" htmlFor="anitune-lives" className="mb-5">
            <NumberInput
              id="anitune-lives"
              ariaLabel="Starting lives"
              min={1}
              max={9}
              value={values.startingLives}
              disabled={disabled}
              onChange={(startingLives) => set({ startingLives })}
            />
          </Field>
        )}

        <div className="flex flex-col gap-4 sm:flex-row">
          <Field label="Clip starts" htmlFor="anitune-sample-point" className="flex-1">
            <Select
              id="anitune-sample-point"
              value={values.samplePoint}
              disabled={disabled}
              onChange={(e) => set({ samplePoint: e.target.value })}
            >
              {SAMPLE_POINTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Speed" htmlFor="anitune-playback-rate" className="flex-1">
            <Select
              id="anitune-playback-rate"
              value={String(values.playbackRate)}
              disabled={disabled}
              onChange={(e) => set({ playbackRate: Number(e.target.value) })}
            >
              {PLAYBACK_RATES.map((r) => (
                <option key={r} value={r}>{r === 1 ? 'Normal' : `${r}×`}</option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mt-2 text-sm text-white/30">
          {SAMPLE_POINTS.find((s) => s.id === values.samplePoint)?.blurb}
        </p>
      </Card>

      <Card title="🎵 The song pool" padding="lg" className="mb-6">
        <Checkbox
          label="Shared songs only"
          checked={values.sharedSongsOnly}
          disabled={disabled}
          onChange={(e) => set({ sharedSongsOnly: e.target.checked })}
          className="mb-2"
        />
        <p className="mb-5 ml-10 text-base text-white/50">
          Only use shows <em>everyone</em> has on their list, so nobody is guessing blind.
        </p>

        <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
          <Checkbox
            label="Openings"
            checked={values.includeOpenings}
            disabled={disabled}
            onChange={(e) => set({ includeOpenings: e.target.checked })}
          />
          <Checkbox
            label="Endings"
            checked={values.includeEndings}
            disabled={disabled}
            onChange={(e) => set({ includeEndings: e.target.checked })}
          />
        </div>

        <Field label="How well known" htmlFor="anitune-popularity" className="mb-2">
          <Select
            id="anitune-popularity"
            value={values.popularity}
            disabled={disabled}
            onChange={(e) => set({ popularity: e.target.value })}
          >
            {POPULARITY_LEVELS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </Select>
        </Field>
        <p className="mb-3 text-sm text-white/30">{level.blurb}</p>

        {/* Warn, never gate. A small pool is a valid answer to what was asked,
            and silently overriding a setting someone just picked is what makes
            one feel broken. The two dead ends are separated because only one of
            them is worth importing for. */}
        {dialIsOn && !canMeasure && (
          <Banner tone="warning" className="mb-4">
            {anyData
              ? '⚠️ Too few of these shows have popularity data to rank them — re-import your lists to fill it in. Using every show for now.'
              : '⚠️ None of these shows have popularity data — it arrived after your lists did. Re-import to enable this. Using every show for now.'}
          </Banner>
        )}
        {dialIsOn && canMeasure && final.length > 0 && final.length < MIN_POPULARITY_POOL && (
          <Banner tone="warning" className="mb-4">
            ⚠️ That leaves only {final.length} show{final.length === 1 ? '' : 's'} — expect
            repeats. Loosen it or import more lists.
          </Banner>
        )}

        <div className="mb-2 flex flex-col gap-4 sm:flex-row">
          <Field label="From year" htmlFor="anitune-year-from" className="flex-1">
            <NumberInput
              id="anitune-year-from"
              ariaLabel="Earliest release year"
              min={YEAR_MIN}
              max={YEAR_MAX}
              value={values.yearFrom}
              disabled={disabled}
              onChange={(yearFrom) => set({ yearFrom })}
            />
          </Field>
          <Field label="To year" htmlFor="anitune-year-to" className="flex-1">
            <NumberInput
              id="anitune-year-to"
              ariaLabel="Latest release year"
              min={YEAR_MIN}
              max={YEAR_MAX}
              value={values.yearTo}
              disabled={disabled}
              onChange={(yearTo) => set({ yearTo })}
            />
          </Field>
        </div>
        <p className="mb-5 text-sm text-white/30">
          {yearNarrowed
            ? `Shows with no release date on file are left out while this is narrowed${
              afterYear.length < base.length ? ` — ${base.length - afterYear.length} dropped.` : '.'}`
            : 'Leave at the full range to include everything, dated or not.'}
        </p>

        <Field label="Max songs per show" htmlFor="anitune-max-per-anime">
          <NumberInput
            id="anitune-max-per-anime"
            ariaLabel="Maximum songs from any one show"
            min={1}
            max={5}
            value={values.maxPerAnime}
            disabled={disabled}
            onChange={(maxPerAnime) => set({ maxPerAnime })}
          />
        </Field>
      </Card>
    </>
  );
}
