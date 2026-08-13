// One choice in the "which half of AniRank" picker.
//
// Its own file because the setup screen and the online lobby both offer this
// choice and CLAUDE.md's warning about those two drifting is the reason: they
// are near-twins that are not identical, so the parts they DO share have to be
// literally shared or they stop looking alike one edit at a time.
//
// A pressed button rather than a radio group, matching AniTune's mode picker:
// `aria-pressed` on a real <button> is a complete keyboard and screen-reader
// story, and the options carry a title and a hint rather than a bare label,
// which a radio's own label element renders badly.
export default function FormatOption({ active, onClick, title, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-pop rounded-pop-sm border-2 px-3 py-2.5 text-left transition-colors
        ${active
      ? 'border-pop-amber bg-pop-amber/20'
      : 'border-white/10 bg-surface-2/40 hover:border-white/30'}`}
    >
      <span className="block font-display text-base font-extrabold text-white">{title}</span>
      <span className="block text-sm text-white/50">{hint}</span>
    </button>
  );
}
