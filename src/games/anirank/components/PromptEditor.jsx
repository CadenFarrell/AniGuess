import { useState } from 'react';
import {
  MAX_END_LABEL_LEN, MAX_PROMPT_LEN, customAxis, normalizeCustomPrompt, promptFor,
} from '../axes';
import { Button, Field, Input, Modal } from '../../../shared/ui';

// Writes or edits one custom prompt. Used from AxisPicker, so both the local
// setup screen and the online lobby get it without either owning it.
//
// The player types a CLAUSE, not a sentence — "most likely to steal your food" —
// and the axis wraps it in the same "as THEY would" framing every built-in
// opinion mode uses. That is the one thing about this form that is not
// self-evident, which is why the sentence is rendered live below the field: get
// it wrong and you see "Rank these shows by Rank these best to worst, as Caden
// would" while you are still typing, rather than in front of everyone mid-round.
export default function PromptEditor({ prompt, onSave, onDelete, onClose }) {
  const editing = Boolean(prompt?.id);
  const [text, setText] = useState(prompt?.text ?? '');
  const [items, setItems] = useState(prompt?.items ?? 'shows');
  // Blank means "use the default" — normalizeCustomPrompt resolves them to
  // MOST/LEAST — so the built-in ends are never shown as if the player typed
  // them. The placeholders say what blank will get you.
  const [topLabel, setTopLabel] = useState(prompt?.topLabel ?? '');
  const [bottomLabel, setBottomLabel] = useState(prompt?.bottomLabel ?? '');

  const draft = { id: prompt?.id, text, items, topLabel, bottomLabel };
  const normalized = normalizeCustomPrompt(draft);
  const noun = items === 'characters' ? 'characters' : 'shows';

  const handleSave = () => {
    if (!normalized) return;
    onSave(draft);
    onClose();
  };

  const handleDelete = () => {
    // window.confirm, matching ListManager and ProfilePicker — the prompt is
    // gone from every future round, not just this one.
    if (!window.confirm(`Delete “${prompt.text}”?`)) return;
    onDelete(prompt.id);
    onClose();
  };

  return (
    <Modal onClose={onClose} width="md">
      <h2 className="mb-6 font-display text-2xl font-black text-white">
        {editing ? '✏️ Edit prompt' : '✏️ New prompt'}
      </h2>

      <Field label="Prompt" htmlFor="prompt-text" className="mb-2">
        <Input
          id="prompt-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          maxLength={MAX_PROMPT_LEN}
          placeholder="most likely to steal your food"
          autoFocus
        />
      </Field>
      <p className="mb-6 text-base text-white/50">
        {normalized ? (
          <>
            {/* "they" rather than a sample name: the subject rotates every
                round, and naming one player here reads like a setting. */}
            Reads: <em className="text-white/70">{promptFor(customAxis(normalized))}</em>
          </>
        ) : (
          <>Finish the sentence &ldquo;rank these {noun} by&hellip;&rdquo;</>
        )}
      </p>

      <Field label="Rank" className="mb-6">
        <div className="flex gap-3">
          {['shows', 'characters'].map((kind) => (
            <Button
              key={kind}
              variant={items === kind ? 'secondary' : 'neutral'}
              size="md"
              fullWidth
              aria-pressed={items === kind}
              onClick={() => setItems(kind)}
            >
              {kind === 'shows' ? 'Shows' : 'Characters'}
            </Button>
          ))}
        </div>
      </Field>

      {/* Optional, because a prompt phrased as "most X" already tells you which
          end is which — but the board renders these verbatim at the top and
          bottom of the ten slots, so a prompt that needs its own words gets them. */}
      <div className="mb-6 flex gap-3">
        <Field label="#1 label" htmlFor="prompt-top" className="min-w-0 flex-1">
          <Input
            id="prompt-top"
            value={topLabel}
            onChange={(e) => setTopLabel(e.target.value)}
            maxLength={MAX_END_LABEL_LEN}
            placeholder="MOST"
          />
        </Field>
        <Field label="#10 label" htmlFor="prompt-bottom" className="min-w-0 flex-1">
          <Input
            id="prompt-bottom"
            value={bottomLabel}
            onChange={(e) => setBottomLabel(e.target.value)}
            maxLength={MAX_END_LABEL_LEN}
            placeholder="LEAST"
          />
        </Field>
      </div>

      <div className="flex gap-3">
        {editing && (
          <Button
            variant="danger"
            size="lg"
            aria-label={`Delete ${prompt.text}`}
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
