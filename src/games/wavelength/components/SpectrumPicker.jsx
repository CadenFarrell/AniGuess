import { useCallback, useState } from 'react';
import { Button, Card } from '../../../shared/ui';
import { pickSpectra } from '../spectra';
import { useCustomSpectra } from '../hooks/useCustomSpectra';
import SpectrumEditor from './SpectrumEditor';

// The psychic choosing what this round is about. Modelled on anirank's
// AxisPicker: the player's own entries in their own section above a handful of
// suggested built-ins, and the editor reachable from both.
//
// WHAT IS OFFERED HERE NEVER REACHES THE ROOM. Only the chosen spectrum is
// published, with the clue. That is not a saving, it is the mechanism — the
// host starts the round and the host has never seen the psychic's written
// spectra, so the only device that can offer them is this one. Everything
// unchosen simply stays local, and there is nothing for anybody else to learn
// from what was rejected.
//
// Three suggestions rather than every eligible spectrum: the psychic is holding
// the device while everyone else waits, and a wall of options is where that wait
// comes from. 🔄 redraws for anyone who wants more.
//
// `pool` IS WHICH DECK THIS ROUND DEALS FROM — 'shows', 'characters', or null in
// text mode, which deals none. It only ever narrows the *suggestions*: a round
// that places show cards has no use for TRAITOR → LOYAL, and rerolling past the
// half of the registry you cannot clue is what this prop exists to stop. See
// spectra.js's spectrumInPool for why null means no filter at all.
const SUGGESTIONS = 3;

export default function SpectrumPicker({ excludeId = null, pool = null, onPick }) {
  const { spectra, saveSpectrum, deleteSpectrum } = useCustomSpectra();

  // Lazily, and once. pickSpectra calls Math.random, so computing it in the
  // render body would deal a different three on every keystroke elsewhere on
  // the screen — the same reason the round hooks use lazy initializers.
  const [suggested, setSuggested] = useState(
    () => pickSpectra(Math.random, { count: SUGGESTIONS, exclude: excludeId, pool }),
  );
  // null = closed · {} = writing a new one · a stored spectrum = editing it.
  const [editing, setEditing] = useState(null);

  const reroll = useCallback(() => {
    setSuggested((prev) => pickSpectra(Math.random, {
      count: SUGGESTIONS,
      // Excluding only the first keeps the redraw from being able to return the
      // identical three, without pretending a registry this size can offer three
      // genuinely new ones every time.
      exclude: prev[0]?.id ?? excludeId,
      pool,
    }));
  }, [excludeId, pool]);

  // Saving selects what you just wrote, the way AxisPicker's does: writing a
  // spectrum during your own turn as psychic is only ever a way of choosing it.
  const handleSave = (draft) => {
    const saved = saveSpectrum(draft);
    if (saved) onPick(saved);
  };

  return (
    <>
      {/* DELIBERATELY UNFILTERED, unlike the suggestions below. A written
          spectrum carries no pool, because you wrote it and already know what it
          is for — and tagging one would add a field to a stored shape that is
          kept to two strings and one boolean for RTDB's sake. */}
      {spectra.length > 0 && (
        <Card title="Yours" padding="sm" className="mb-4">
          {spectra.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-1">
              <SpectrumButton spectrum={s} onClick={() => onPick(s)} />
              <button
                onClick={() => setEditing(s)}
                aria-label={`Edit ${s.leftLabel} to ${s.rightLabel}`}
                className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                  text-lg text-white/40 hover:text-white"
              >
                ✏️
              </button>
            </div>
          ))}
        </Card>
      )}

      <Card
        title="Suggested"
        padding="sm"
        className="mb-4"
        action={(
          <button
            onClick={reroll}
            aria-label="Suggest three different spectrums"
            className="focus-pop rounded-pop-sm px-2 py-1 text-lg text-white/40 hover:text-white"
          >
            🔄
          </button>
        )}
      >
        {suggested.map((s) => (
          <div key={s.id} className="py-1">
            <SpectrumButton spectrum={s} onClick={() => onPick(s)} />
          </div>
        ))}
      </Card>

      <Button variant="neutral" size="lg" fullWidth onClick={() => setEditing({})}>
        ✏️ Write your own
      </Button>

      {editing && (
        <SpectrumEditor
          // A bare {} is "new": SpectrumEditor keys off `spectrum?.id`, so an
          // object with no id is still treated as a fresh one.
          spectrum={editing.id ? editing : null}
          onSave={handleSave}
          onDelete={deleteSpectrum}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// Shared between yours and the suggestions on purpose, so a spectrum somebody
// wrote reads exactly like a shipped one — the same reason AxisPicker shares
// AxisButton across its two sections.
function SpectrumButton({ spectrum, onClick }) {
  return (
    <button
      onClick={onClick}
      className="focus-pop min-w-0 flex-1 rounded-pop-sm border-2 border-white/15 bg-surface-2 px-4 py-3
        text-left transition-colors hover:border-pop-purple hover:bg-surface w-full"
    >
      <span className="flex items-center gap-2 font-display text-base font-extrabold text-white">
        <span className="min-w-0 flex-1 truncate">{spectrum.leftLabel}</span>
        <span className="flex-shrink-0 text-white/30">→</span>
        <span className="min-w-0 flex-1 truncate text-right">{spectrum.rightLabel}</span>
      </span>
    </button>
  );
}
