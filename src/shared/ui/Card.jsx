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
  padding = 'md',
  className = '',
  children,
  ...rest
}) {
  return (
    <div className={`card-pop ${PADDING[padding]} ${className}`} {...rest}>
      {title && (
        <h3 className="font-display text-sm font-extrabold uppercase tracking-widest text-white/50 mb-3">
          {title}
        </h3>
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
