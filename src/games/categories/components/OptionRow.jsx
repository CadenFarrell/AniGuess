/**
 * One choice in a picker, with its explanation INSIDE the control.
 *
 * A port of anirank's FormatOption, and for the same reason it exists there:
 * the setup screen and the online lobby both offer these choices, so the parts
 * they share have to be literally shared or they stop looking alike one edit at
 * a time. Its own file rather than a lump inside AniTagSettings because it is a
 * shape, not a setting — the mode picker and the pool picker are both this.
 *
 * WHAT IT REPLACES IS THE POINT. AniTag drew these as a pair of plain buttons
 * with the description of the SELECTED one in an orphaned paragraph underneath,
 * so tapping a button changed text that was not visually attached to it and the
 * option you were not on never explained itself at all. The hint belongs to the
 * option, so it lives in the option.
 *
 * A pressed button rather than a radio group: `aria-pressed` on a real
 * <button> is a complete keyboard and screen-reader story, and a radio's own
 * label element renders a title-plus-hint badly.
 */
export default function OptionRow({ active, onClick, title, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-pop w-full rounded-pop-sm border-2 px-3 py-2.5 text-left transition-colors
        ${active
      ? 'border-pop-lime bg-pop-lime/15'
      : 'border-white/10 bg-surface-2/40 hover:border-white/30'}`}
    >
      <span className="block font-display text-base font-extrabold text-white">{title}</span>
      {hint && <span className="mt-0.5 block text-sm text-white/50">{hint}</span>}
    </button>
  );
}
