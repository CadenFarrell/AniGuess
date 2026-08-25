import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Checkbox, Field, NumberInput } from '../../../shared/ui';
import OptionRow from './OptionRow';
import { SETTING_HELP, capHelp, poolCount } from '../help';
import {
  CATEGORY_MODES, CATEGORY_POOLS, DEFAULT_PREFS, MAX_ROUNDS, MIN_ROUNDS,
  MODE_LABELS, POOL_LABELS,
} from '../prefs';
import { MAX_CAP, MIN_CAP } from '../rules';
import { poolSize } from '../categories';

/**
 * Every option AniTag remembers, rendered once.
 *
 * IT WAS THE SAME HUNDRED LINES IN TWO FILES. AniTagSetup and OnlineLobby are
 * near-twins that offer an identical set here, and CLAUDE.md's warning about
 * exactly that pair is what this closes: two copies of a settings card drift one
 * edit at a time, and the drift is invisible until somebody plays the other half
 * of the game. anirank's FormatOption is the precedent at the level of a single
 * control; this is the same argument at the level of the card.
 *
 * IT IS TWO CARDS, NOT ONE. The old card held five settings and up to three
 * paragraphs of grey text each, with `mb-5` doing the work of both a section
 * break and a line break — so nothing grouped and the eye had nowhere to rest.
 * They split cleanly along a real line: what the game IS, and how long it runs.
 *
 * ONE `onChange(key, value)` RATHER THAN FIVE SETTERS, because the two callers
 * hold their state differently — the lobby also has to assemble a `settings`
 * object that is literally what leaves the host's device — and five props each
 * would put the drift back one level down.
 */
export default function AniTagSettings({
  values, onChange, playerCount = 0, customCategories = [], onReset,
}) {
  const { rounds, proposalCap, categoryPool, categoryMode, useCustom } = values;
  const dealt = categoryMode === 'dealt';
  const size = poolSize(categoryPool, useCustom ? customCategories : []);

  return (
    <>
      <Card title="⚙️ The game" action={<DetailToggle />} padding="lg" className="mb-6">
        {/* First, because it is the only setting that changes what the game IS
            rather than how long it runs — and because the hint under each option
            is the fastest way to explain a game somebody has not played. */}
        <Field label="How categories work" className="mb-2">
          <div className="flex flex-col gap-2">
            {CATEGORY_MODES.map((m) => (
              <OptionRow
                key={m}
                active={categoryMode === m}
                onClick={() => onChange('categoryMode', m)}
                title={MODE_LABELS[m].label}
                hint={MODE_LABELS[m].blurb}
              />
            ))}
          </div>
        </Field>
        <SettingHelp className="mb-5" more={SETTING_HELP.categoryMode.more}>
          {SETTING_HELP.categoryMode.short}
        </SettingHelp>

        <Field label="Categories about" className="mb-2">
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_POOLS.map((p) => (
              <OptionRow
                key={p}
                active={categoryPool === p}
                onClick={() => onChange('categoryPool', p)}
                title={POOL_LABELS[p].label}
                hint={`Name a ${POOL_LABELS[p].noun} at a time`}
              />
            ))}
          </div>
        </Field>
        <SettingHelp className="mb-2" more={SETTING_HELP.categoryPool.more}>
          {SETTING_HELP.categoryPool.short}
        </SettingHelp>
        <p className="text-sm text-white/50">
          {poolCount({ size, players: playerCount, pool: categoryPool, dealt })}
        </p>
      </Card>

      <Card title="⚙️ Length" padding="lg" className="mb-6">
        <Field label="Rounds" htmlFor="anitag-rounds" className="mb-2">
          <NumberInput
            id="anitag-rounds"
            ariaLabel="Rounds"
            min={MIN_ROUNDS}
            max={MAX_ROUNDS}
            value={rounds}
            onChange={(v) => onChange('rounds', v)}
          />
        </Field>
        <SettingHelp className="mb-5" more={SETTING_HELP.rounds.more}>
          {SETTING_HELP.rounds.short}
        </SettingHelp>

        {/* "Per round" rather than "per turn", and the change is not cosmetic:
            names are spent one at a time as the seat goes round, so this is the
            size of a player's whole round rather than the length of one sitting. */}
        <Field label="Names each, per round" htmlFor="anitag-cap" className="mb-2">
          <NumberInput
            id="anitag-cap"
            ariaLabel="Names each, per round"
            min={MIN_CAP}
            max={MAX_CAP}
            value={proposalCap}
            onChange={(v) => onChange('proposalCap', v)}
          />
        </Field>
        <SettingHelp className="mb-5" more={SETTING_HELP.proposalCap.more}>
          {SETTING_HELP.proposalCap.short} {capHelp}
        </SettingHelp>

        <Checkbox
          label={dealt ? 'Deal my own categories too' : 'Offer my own categories too'}
          checked={useCustom}
          onChange={(e) => onChange('useCustom', e.target.checked)}
          className="mb-2"
        />
        <SettingHelp indent more={SETTING_HELP.useCustom.more}>
          {SETTING_HELP.useCustom.short}
        </SettingHelp>

        <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
      </Card>
    </>
  );
}
