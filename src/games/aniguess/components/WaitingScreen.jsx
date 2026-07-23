import { Screen } from '../../../shared/ui';

export default function WaitingScreen({ emoji = '📵', title, subtitle }) {
  return (
    <Screen center className="text-center">
      <div className="mb-5 text-7xl">{emoji}</div>
      <h2 className="mb-3 font-display text-3xl font-extrabold text-white">{title}</h2>
      {subtitle && <p className="text-lg text-white/60">{subtitle}</p>}
    </Screen>
  );
}
