import { useState } from 'react';
import { Badge, Button, Card, CardRow, GhostButton, Input } from '../../../shared/ui';
import { MAX_LABEL_LEN, normalizeCustomCategory } from '../categories';

/**
 * Write your own clauses, and see the ones you already wrote.
 *
 * The same shape as AniWave's SpectrumEditor and AniRank's prompt editor, and it
 * is a third instance rather than a shared component for the reason those two
 * are separate: a spectrum is two fields with a direction rule, a prompt is a
 * sentence with a name slot, and this is one clause. What they share is the
 * discipline — normalize on the way in, upsert by id, preview what will actually
 * be stored — and that lives in categories.js, which is the part worth sharing.
 *
 * PREVIEWS THE NORMALIZED VALUE, not the raw draft. normalizeCustomCategory
 * trims, collapses whitespace and truncates, so a draft of 60 characters is
 * stored as 48 — showing the draft would promise a clause the game will not
 * play. Calling it here also means the Save button is disabled by exactly the
 * function that would have rejected the write.
 */
export default function CategoryEditor({ categories, onSave, onDelete, noun = 'card' }) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);

  const preview = normalizeCustomCategory({ id: editingId, label: draft });

  const save = () => {
    if (!preview) return;
    onSave(preview);
    setDraft('');
    setEditingId(null);
  };

  return (
    <Card title="✍️ Your own categories" padding="lg" className="mb-6">
      <p className="mb-3 text-sm text-white/50">
        Anything the table can rule on — the app never checks an answer, so a clause
        no anime database could ever know is exactly the point.
      </p>

      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        maxLength={MAX_LABEL_LEN}
        aria-label="A category to add"
        placeholder={`e.g. ${noun === 'show' ? 'Has a terrible dub' : 'Wears a hat'}`}
        className="mb-3"
      />
      {/* ONE ACTION, then whatever qualifies it. This row used to hold a
          Button, a GhostButton and a Badge at three different weights spread by
          justify-between, so the thing to press was the same size as the thing
          that merely counted. The count moves down onto the list it counts. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="md" disabled={!preview} onClick={save}>
          {editingId ? 'Save changes' : '+ Add category'}
        </Button>
        {editingId && (
          <GhostButton onClick={() => { setEditingId(null); setDraft(''); }}>
            Cancel
          </GhostButton>
        )}
      </div>

      {categories.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          {/* The count, not just the list: a table larger than the pool starts
              sharing clauses, and this is the control that fixes it. */}
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-display text-xs font-extrabold uppercase tracking-widest text-white/40">
              Written on this device
            </span>
            <Badge tone="neutral">{categories.length}</Badge>
          </div>
          {categories.map((c) => (
            <CardRow key={c.id}>
              <span className="min-w-0 flex-1 truncate text-base text-white/80">{c.label}</span>
              <button
                onClick={() => { setEditingId(c.id); setDraft(c.label); }}
                aria-label={`Edit “${c.label}”`}
                className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                  text-base hover:text-white"
              >
                ✏️
              </button>
              <button
                onClick={() => { onDelete(c.id); if (editingId === c.id) { setEditingId(null); setDraft(''); } }}
                aria-label={`Delete “${c.label}”`}
                className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                  text-lg font-black text-pop-red hover:text-white"
              >
                ✕
              </button>
            </CardRow>
          ))}
        </div>
      )}
    </Card>
  );
}
