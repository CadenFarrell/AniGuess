import { AXES, getAxis } from '../axes';
import { Badge, Card } from '../../../shared/ui';

// Picks the round's axis. Used by both local setup and the online lobby, so the
// two can't drift on which modes exist or how they're grouped.
//
// Grouped by kind rather than listed flat, because "is there a right answer" is
// the thing a table is actually choosing between — the individual prompts are a
// detail once that's settled.
const GROUPS = [
  {
    kind: 'opinion',
    title: 'Opinion',
    hint: 'One player is the subject. Everyone ranks as they would — their own board is the answer.',
  },
  {
    kind: 'fact',
    title: 'Facts',
    hint: 'One right answer, from AniList. Needs a profile imported since stats were added.',
  },
];

export default function AxisPicker({ value, onChange, disabled = false, counts }) {
  const selected = getAxis(value);

  return (
    <Card title="🎯 Mode" padding="lg" className="mb-6">
      {GROUPS.map((group) => (
        <div key={group.kind} className="mb-5 last:mb-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-display text-base font-black tracking-wide text-white">
              {group.title}
            </span>
          </div>
          <p className="mb-3 text-sm text-white/50">{group.hint}</p>

          <div className="flex flex-col gap-2">
            {AXES.filter((a) => a.kind === group.kind).map((axis) => {
              const active = axis.id === selected.id;
              // How many cards this axis could actually deal. Undefined until the
              // caller has a roster to count against; 0 is the ordinary result of
              // a fact axis on a profile that predates the stats, and saying so
              // here beats a dead Start button.
              const count = counts?.[axis.id];
              const short = count != null && count < 10;
              return (
                <button
                  key={axis.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => onChange(axis.id)}
                  className={`focus-pop flex w-full items-center gap-3 rounded-pop-sm border-2 px-3 py-2.5
                    text-left transition-colors disabled:opacity-40
                    ${active
                      ? 'border-pop-amber bg-pop-amber/20'
                      : 'border-white/10 bg-surface-2/40 hover:border-white/30'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base font-extrabold text-white">
                      {axis.label}
                    </span>
                    <span className="block truncate text-sm text-white/50">
                      {axis.items === 'characters' ? 'Characters' : 'Shows'}
                    </span>
                  </span>
                  {count != null && (
                    <Badge tone={short ? 'red' : 'neutral'}>{count}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Card>
  );
}
