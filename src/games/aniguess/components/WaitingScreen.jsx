import { Screen } from '../../../shared/ui';

// `children` is the escape-hatch slot: a screen that says "waiting on somebody"
// is exactly where the control that stops waiting belongs, and rendering that
// control as a sibling in the router would drop it outside the centred column.
// Optional, so every existing caller renders unchanged.
export default function WaitingScreen({ emoji = '📵', title, subtitle, children }) {
  return (
    <Screen center className="text-center">
      <div className="mb-5 text-7xl">{emoji}</div>
      <h2 className="mb-3 font-display text-3xl font-extrabold text-white">{title}</h2>
      {subtitle && <p className="text-lg text-white/60">{subtitle}</p>}
      {children && <div className="mt-8 w-full max-w-xs">{children}</div>}
    </Screen>
  );
}
