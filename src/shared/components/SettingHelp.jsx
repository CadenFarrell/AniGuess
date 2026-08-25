import { useHelpDetail } from '../context/helpDetailContext';

/**
 * The note under one setting, in two tiers: what it does, and — only when the
 * player has asked for it — why it matters.
 *
 * Every setup screen and online lobby used to hand-place a `<p className="ml-10
 * text-base text-white/50">` holding both halves at once. Four games' worth of
 * that put a two-to-four line paragraph under every single-line control, so a
 * settings card ran roughly three times taller in prose than in controls and the
 * whole thing read as a wall rather than as help. The copy is good and several
 * paragraphs carry rules the table needs, so none of it is deleted — the *why*
 * simply stops being the first thing on the screen.
 *
 * The split is nearly always where the existing paragraph already broke: its
 * opening sentence names the behaviour and the rest argues for it. Pass the
 * first as `children`, the second as `more`. A setting whose note was already one
 * line just omits `more` and renders unchanged apart from its weight.
 *
 * That weight is the second half of the fix. Helper copy had drifted to three
 * different treatments across the games (`text-base text-white/50`, `text-sm
 * text-white/50`, `text-sm text-white/30`), which is what made the volume read as
 * noise instead of hierarchy — there was no consistent signal for "this is the
 * secondary line". Everything routes through here now, at two weights only.
 */
export default function SettingHelp({ indent = false, more, className = '', children }) {
  const { detail } = useHelpDetail();

  return (
    // ml-10 lines the note up with a Checkbox's label, clearing the 7-unit box
    // plus its 3-unit gap. A note under a Field (which has no box) takes no
    // indent — hence the prop rather than baking it in.
    <div className={`${indent ? 'ml-10' : ''} ${className}`}>
      <p className="text-sm text-white/50">{children}</p>
      {/* Rendered in flow rather than as an overlay, the way every other
          disclosure in the app does it (see Combobox's note on why popovers were
          rejected): the card growing downward is the correct behaviour when the
          player has just asked for more to read. */}
      {more && detail && <p className="mt-1.5 text-sm text-white/40">{more}</p>}
    </div>
  );
}

/**
 * The switch that reveals every `more` on the screen, sized and placed to sit in
 * a Card's title row via its `action` prop.
 *
 * On every settings card that has something to reveal, not once per screen. Two
 * of them showing the same state a few hundred pixels apart (AniTune renders two
 * cards) is mild redundancy; a card full of quietly-truncated notes whose control
 * is somewhere above the fold is a feature nobody finds.
 *
 * A real <button> with aria-pressed, matching every other toggle in the app
 * (FormatOption, ModePicker, AxisPicker's AxisButton) — a complete keyboard and
 * screen-reader story with no extra wiring. Renders nothing at all outside a
 * HelpDetailProvider, where it would be a control that does nothing.
 */
export function DetailToggle({ className = '' }) {
  const { detail, setDetail } = useHelpDetail();
  if (!setDetail) return null;

  return (
    <button
      type="button"
      onClick={() => setDetail(!detail)}
      aria-pressed={detail}
      // Not `sticker`/`btn-pop`: this sits inside a section heading and has to
      // read as part of it. The border is what keeps it findable at this weight.
      //
      // Lime for the on state, not amber: index.css assigns lime to yes/on/ready
      // and it is already what Checkbox fills with when ticked, so the two
      // switches on one card agree about what "on" looks like. Amber would read
      // as a warning about the setting underneath it.
      className={`focus-pop flex-shrink-0 rounded-pop-sm border-2 px-2.5 py-1
        font-display text-xs font-extrabold uppercase tracking-widest transition-colors
        ${detail
          ? 'border-pop-lime/60 bg-pop-lime/15 text-pop-lime'
          : 'border-white/15 text-white/40 hover:border-white/30 hover:text-white/70'}
        ${className}`}
    >
      ⓘ Detail
    </button>
  );
}
