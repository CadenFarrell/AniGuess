// Surface panel. Replaces `bg-white/5 border border-white/10 rounded-2xl p-6`
// and, with `title`, the repeated
// `text-white/60 text-sm font-bold uppercase tracking-wider` section heading.

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export default function Card({
  title,
  action,
  padding = 'md',
  className = '',
  children,
  ...rest
}) {
  return (
    <div className={`card-pop ${PADDING[padding]} ${className}`} {...rest}>
      {title && (
        // `action` is a control that belongs to the whole card rather than to any
        // one row in it — today, SettingHelp's ⓘ Detail switch. It rides in the
        // heading so a card does not have to rebuild the h3 to get one control
        // beside its title; without it, every settings card would hand-roll this
        // row and they would drift.
        //
        // The margin moves onto the wrapper so the h3 keeps its own spacing when
        // there is no action, leaving the title-only path byte-identical.
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-extrabold uppercase tracking-widest text-white/50">
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// A row inside a Card's list, with the hairline separator the old screens all
// spelled out as `py-2 border-b border-white/10 last:border-0`.
export function CardRow({ className = '', children, ...rest }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-3
        border-b border-white/10 last:border-0 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
