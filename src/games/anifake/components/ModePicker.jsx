import { MODES } from '../modes';
import { Card } from '../../../shared/ui';

// Which way the round is dealt. Two entries today; reads them off modes.js so
// adding a third is one edit there, the same way AniRank's AxisPicker reads
// axes.js.
export default function ModePicker({ value, onChange }) {
  return (
    <Card title="🎭 Deal" padding="lg" className="mb-6">
      <div className="flex flex-col gap-3">
        {MODES.map((mode) => {
          const selected = mode.id === value;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              aria-pressed={selected}
              className={`btn-pop focus-pop rounded-pop border-2 p-4 text-left
                ${selected ? 'border-pop-teal bg-pop-teal/15' : 'border-white/15 bg-surface'}`}
            >
              <span className="font-display text-lg font-extrabold text-white">
                {mode.label}
              </span>
              <span className="mt-1 block text-base text-white/50">{mode.blurb}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
