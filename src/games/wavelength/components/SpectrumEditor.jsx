import { useState } from 'react';
import { Button, Field, Input, Modal } from '../../../shared/ui';
import { MAX_LABEL_LEN, normalizeCustomSpectrum } from '../spectra';

// Writes or edits one spectrum. A port of anirank's PromptEditor, and shorter
// for the reason a spectrum is shorter than a prompt: there is no clause to
// wrap in a sentence, just the two words the dial prints at its ends.
//
// BOTH ENDS ARE REQUIRED, which is the one rule worth stating on screen. Half a
// spectrum names a direction the guessers cannot see — the psychic would be
// clueing toward a blank cap. normalizeCustomSpectrum returns null until both
// are filled, and Save is disabled off exactly that null, so the form cannot
// produce something the dial cannot draw.
export default function SpectrumEditor({ spectrum, onSave, onDelete, onClose }) {
  const editing = Boolean(spectrum?.id);
  const [leftLabel, setLeftLabel] = useState(spectrum?.leftLabel ?? '');
  const [rightLabel, setRightLabel] = useState(spectrum?.rightLabel ?? '');

  const draft = { id: spectrum?.id, leftLabel, rightLabel };
  const normalized = normalizeCustomSpectrum(draft);

  const handleSave = () => {
    if (!normalized) return;
    onSave(draft);
    onClose();
  };

  const handleDelete = () => {
    // window.confirm, matching PromptEditor and ProfilePicker — it is gone from
    // every future round, not just this one.
    if (!window.confirm(`Delete “${spectrum.leftLabel} → ${spectrum.rightLabel}”?`)) return;
    onDelete(spectrum.id);
    onClose();
  };

  return (
    <Modal onClose={onClose} width="md">
      <h2 className="mb-2 font-display text-2xl font-black text-white">
        {editing ? '✏️ Edit spectrum' : '✏️ New spectrum'}
      </h2>
      <p className="mb-6 text-base text-white/50">
        Two ends of one idea. The psychic gets a hidden point somewhere between
        them and has to talk everyone else onto it.
      </p>

      <div className="mb-4 flex items-end gap-3">
        <Field label="Left end" htmlFor="spectrum-left" className="min-w-0 flex-1">
          <Input
            id="spectrum-left"
            value={leftLabel}
            onChange={(e) => setLeftLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            maxLength={MAX_LABEL_LEN}
            placeholder="MID"
            autoFocus
          />
        </Field>
        <span className="pb-3 font-display text-xl font-black text-white/30">→</span>
        <Field label="Right end" htmlFor="spectrum-right" className="min-w-0 flex-1">
          <Input
            id="spectrum-right"
            value={rightLabel}
            onChange={(e) => setRightLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            maxLength={MAX_LABEL_LEN}
            placeholder="PEAK"
          />
        </Field>
      </div>

      {/* Live, and uppercased by the same normalizer that will store it — so
          what is previewed is literally what the dial will print, rather than
          what was typed. */}
      <p className="mb-6 text-center text-base text-white/50">
        {normalized ? (
          <span className="font-display font-extrabold tracking-widest text-white/70">
            ← {normalized.leftLabel} · {normalized.rightLabel} →
          </span>
        ) : (
          'Name both ends to save it.'
        )}
      </p>

      <div className="flex gap-3">
        {editing && (
          <Button
            variant="danger"
            size="lg"
            aria-label={`Delete ${spectrum.leftLabel} to ${spectrum.rightLabel}`}
            onClick={handleDelete}
          >
            🗑️
          </Button>
        )}
        <Button variant="neutral" size="lg" fullWidth onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="lg" fullWidth disabled={!normalized} onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
