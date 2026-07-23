// Form controls. These take over the inputClass / selectClass / labelClass
// consts that ListManager had already extracted locally — same idea, now
// shared, and with a real focus ring instead of only a border-colour change.

const BASE = `w-full rounded-pop-sm border-2 border-ink bg-surface-2 px-4 py-3
  text-white placeholder-white/35 focus-pop transition-colors`;

export function Input({ className = '', ...rest }) {
  return <input className={`${BASE} ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={`${BASE} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Label({ className = '', children, ...rest }) {
  return (
    <label
      className={`block font-display text-xs font-extrabold uppercase tracking-widest
        text-white/50 mb-1.5 ${className}`}
      {...rest}
    >
      {children}
    </label>
  );
}

// Label + control pair, so callers stop re-typing the wrapper div.
export function Field({ label, htmlFor, className = '', children }) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
    </div>
  );
}

// The settings checkboxes were `w-5 h-5` native boxes, which render as tiny
// pale-blue system controls that look nothing like the rest of the app.
export function Checkbox({ label, className = '', ...rest }) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer group ${className}`}>
      <input
        type="checkbox"
        className="peer sr-only"
        {...rest}
      />
      {/* The tick lives directly on this span, not in a child: `peer-checked:`
          compiles to a sibling selector, so it cannot reach a descendant. */}
      <span
        aria-hidden="true"
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-pop-sm border-2 border-ink
          bg-surface-2 text-transparent text-lg font-black leading-none transition-colors
          peer-checked:bg-pop-lime peer-checked:text-ink
          peer-focus-visible:ring-4 peer-focus-visible:ring-white/80
          peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas"
      >
        ✓
      </span>
      <span className="text-white/80 text-lg group-hover:text-white transition-colors">{label}</span>
    </label>
  );
}
