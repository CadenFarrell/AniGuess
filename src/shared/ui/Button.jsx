// The chunky press-down block that every action in the app is built from.
// The physics (border, hard shadow, lift on hover, sink on press) live in the
// `btn-pop` utility in src/index.css; this file only picks colour and size.
//
// Solid variants all use ink-coloured text rather than white. That is both the
// neo-brutalist look and the accessible choice — white on pop-pink is only
// 3.1:1, while ink on pop-pink is 6.4:1 and passes AA at any size.

// Bright fills take an ink border; the dark `neutral` fill takes a light one,
// because ink-on-canvas has no edge to show.
const VARIANTS = {
  primary: 'bg-pop-pink text-ink border-ink',
  secondary: 'bg-pop-purple text-ink border-ink',
  success: 'bg-pop-lime text-ink border-ink',
  danger: 'bg-pop-red text-ink border-ink',
  warning: 'bg-pop-amber text-ink border-ink',
  info: 'bg-pop-blue text-ink border-ink',
  neutral: 'bg-surface-2 text-white border-white/20',
};

const SIZES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-base',
  lg: 'px-6 py-4 text-lg',
  xl: 'px-6 py-5 text-2xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled = false,
  children,
  ...rest
}) {
  // Disabled blocks keep the border and shadow so the layout never shifts;
  // they just go flat and grey, and `btn-pop` already suppresses the motion.
  const tone = disabled
    ? 'bg-surface-2 text-white/25 border-white/10'
    : VARIANTS[variant];

  return (
    <button
      disabled={disabled}
      className={`btn-pop focus-pop ${tone} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Bare text button for low-emphasis navigation ("← Back"). No block, no
// shadow — using a full pop block for these would flatten the visual hierarchy.
export function GhostButton({ className = '', children, ...rest }) {
  return (
    <button
      className={`focus-pop rounded-pop-sm px-2 py-1 font-display font-bold text-white/60
        transition-colors hover:text-white ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
