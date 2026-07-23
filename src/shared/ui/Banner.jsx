// Inline notice box. Covers the room-connection error, the "every player needs
// a character" warnings, and the online last-outcome banner — three shapes that
// were each spelled out separately with their own tinted-background classes.

const TONES = {
  info: 'bg-surface-2 border-ink text-white/80',
  success: 'bg-pop-lime/15 border-pop-lime text-white',
  warning: 'bg-pop-amber/15 border-pop-amber text-white',
  danger: 'bg-pop-red/15 border-pop-red text-white',
};

export default function Banner({
  tone = 'info',
  onDismiss,
  className = '',
  children,
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-pop border-2 px-4 py-3 ${TONES[tone]} ${className}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <div className="flex-1 text-base">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="focus-pop -my-1 -mr-1 grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm font-black text-white/60 hover:text-white"
        >
          ✕
        </button>
      )}
    </div>
  );
}
