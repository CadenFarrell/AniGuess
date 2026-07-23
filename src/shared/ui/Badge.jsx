// Small status pill — "4 chars", "⚠️ No chars", "SOON", "(you)".
// Same semantic colour map as Button, at label scale.

const TONES = {
  neutral: 'bg-surface-2 text-white/70 border-ink',
  pink: 'bg-pop-pink text-ink border-ink',
  purple: 'bg-pop-purple text-ink border-ink',
  lime: 'bg-pop-lime text-ink border-ink',
  red: 'bg-pop-red text-ink border-ink',
  amber: 'bg-pop-amber text-ink border-ink',
  blue: 'bg-pop-blue text-ink border-ink',
};

export default function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pop-sm border-2 px-2.5 py-1
        font-display text-xs font-extrabold uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
