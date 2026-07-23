import { useEscapeKey } from '../hooks/useEscapeKey';

// There were six hand-rolled copies of this overlay, and only three of them
// wired up Escape. Folding the hook in here means every dialog gets keyboard
// dismissal for free — and the ones that must not be dismissed (the turn-over
// acknowledgement, the resume prompt) opt out with dismissible={false}.

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Modal({
  onClose,
  dismissible = true,
  // Separate from `dismissible` because some dialogs have a destructive
  // dismiss — discarding an unfinished game, say. Escape is deliberate enough
  // to allow; a stray click on the backdrop is not.
  closeOnBackdrop = true,
  width = 'md',
  bare = false, // skip the panel chrome — for full-bleed announcement screens
  className = '',
  children,
}) {
  const canDismiss = dismissible && typeof onClose === 'function';
  useEscapeKey(canDismiss, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 px-4 py-8 overflow-y-auto"
      onClick={canDismiss && closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        // Without this the backdrop's onClick fires for every click inside.
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${WIDTHS[width]} ${bare ? '' : 'card-pop p-6 sm:p-8'} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
