import { Badge, Card } from '../../../shared/ui';
import SettingHelp from '../../../shared/components/SettingHelp';
import { CLUE_MODE_HELP } from '../help';
import { CLUE_MODES } from '../rules';

// What the psychic gives the table. Reads the list off rules.js and the copy off
// help.js, so a fourth mode is one edit in each and none here — the same shape
// as AniFake's ModePicker over modes.js.
//
// THE TAG IS THE POINT OF THIS CONTROL. These are not three difficulty settings,
// they are three games, and exactly one of them can be played with no anime list
// — which is the single most surprising fact about AniWave and the reason the
// setup screen exists in the shape it does. Saying it on the option itself,
// rather than only in the banner that disappears when you pick a card mode,
// keeps it answerable at the moment somebody is choosing.
//
// Shared by WavelengthSetup and OnlineLobby, so the two cannot drift about what
// the modes are called.
export default function ClueModePicker({ value, onChange }) {
  return (
    <Card title="🔮 The clue" padding="lg" className="mb-6">
      <div className="flex flex-col gap-3">
        {CLUE_MODES.map((id) => {
          const help = CLUE_MODE_HELP[id];
          const selected = id === value;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={selected}
              className={`btn-pop focus-pop rounded-pop border-2 p-4 text-left
                ${selected ? 'border-pop-purple bg-pop-purple/15' : 'border-white/15 bg-surface'}`}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 font-display text-lg font-extrabold text-white">
                  {help.label}
                </span>
                <Badge tone={id === 'text' ? 'lime' : 'neutral'}>{help.tag}</Badge>
              </span>
              {/* Inside the button, so the `more` half opens with the same
                  DetailToggle that governs the settings card below it. */}
              <SettingHelp className="mt-1" more={help.more}>{help.short}</SettingHelp>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
