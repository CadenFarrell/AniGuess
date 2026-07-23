import { GhostButton } from './Button';

// Page shell. Replaces the `min-h-screen flex flex-col items-center px-6 py-10`
// + `w-full max-w-md` pair that was hand-written at the top of a dozen screens,
// each with slightly different padding.
//
// Top-anchored screens carry extra head-room so their first element clears the
// fixed "🏠 Hub" button; centred menu screens float clear of it already.

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

export default function Screen({
  width = 'sm',
  center = false, // vertically centre the content — for short menu screens
  onBack,
  backLabel = '← Back',
  className = '',
  children,
}) {
  return (
    <div
      className={`min-h-screen flex flex-col items-center px-5 sm:px-6
        ${center ? 'justify-center py-8 sm:py-10' : 'pt-16 pb-8 sm:pb-10'} ${className}`}
    >
      <div className={`w-full ${WIDTHS[width]}`}>
        {onBack && (
          <div className="mb-6">
            <GhostButton onClick={onBack}>{backLabel}</GhostButton>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
