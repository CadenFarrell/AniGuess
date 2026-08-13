import { useState } from 'react';
import { AXES } from '../axes';
import { MAX_LIST_NAME_LEN } from '../tiers';
import {
  Badge, Banner, Button, Card, CardRow, Field, GhostButton, Input, Modal, Screen, Wordmark,
} from '../../../shared/ui';

// Every tier list saved on this device, grouped by whose it is.
//
// Lists are shown for EVERY axis, not just the one picked at setup. Someone
// looking for "All-time" is looking for it by name, and hiding it because the
// setup screen currently says "Underrated → Overrated" would read as data loss.
// The mode a list was built for is a badge on its row instead.
//
// Building a list for another seated player is picking their name here. That is
// the whole pass-the-device story, and it needs no screen of its own.

const AXIS_LABEL = Object.fromEntries(AXES.map((a) => [a.id, a.label]));

export default function TierPicker({
  players, listsFor, prompts = [], axis, defaultFormat = 'tiers', poolCounts,
  saveError, onOpen, onCreate, onDelete, onDuplicate, onCompare, onBack,
}) {
  const [creatingFor, setCreatingFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const labelOf = (list) =>
    AXIS_LABEL[list.axisId] ?? prompts.find((p) => p.id === list.axisId)?.text ?? 'Custom';

  const total = players.reduce((n, p) => n + listsFor(p.id).length, 0);

  return (
    <>
      <Screen width="md" onBack={onBack} backLabel="← Setup">
        <Wordmark tone="amber" subtitle="Your whole list, sorted once and kept" className="mb-8">
          Tier lists
        </Wordmark>

        {saveError && <Banner tone="danger" className="mb-4">⚠️ {saveError}</Banner>}

        <p className="mb-6 text-center text-base text-white/50">
          {poolCounts.shows} shows · {poolCounts.characters} characters to draw from
          {players.length > 1 && ' (shared by everyone seated)'}
        </p>

        {players.map((player) => {
          const lists = listsFor(player.id);
          return (
            <Card key={player.id} title={player.name} padding="lg" className="mb-4">
              {lists.length === 0 && (
                <p className="mb-3 text-base text-white/40">No lists yet.</p>
              )}

              {lists.map((list) => (
                <CardRow key={list.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(player.id, list.id)}
                    className="focus-pop min-w-0 flex-1 rounded-pop-sm py-1 text-left hover:bg-white/5"
                  >
                    <span className="block truncate font-display text-lg font-extrabold text-white">
                      {list.name || 'Untitled list'}
                    </span>
                    <span className="block truncate text-sm text-white/50">
                      {labelOf(list)} · {list.items === 'characters' ? 'Characters' : 'Shows'}
                    </span>
                  </button>
                  <Badge tone="neutral">{list.format === 'ranked' ? '1–N' : 'Tiers'}</Badge>
                  <Button
                    variant="neutral"
                    size="sm"
                    aria-label={`Duplicate ${list.name}`}
                    onClick={() => onDuplicate(player.id, list.id)}
                  >
                    ⧉
                  </Button>
                  <button
                    onClick={() => setConfirmDelete({ profileId: player.id, list })}
                    aria-label={`Delete ${list.name}`}
                    className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                      text-lg font-black text-pop-red hover:text-white"
                  >
                    ✕
                  </button>
                </CardRow>
              ))}

              <div className="pt-3">
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setCreatingFor(player)}
                >
                  ＋ New list for {player.name}
                </Button>
              </div>
            </Card>
          );
        })}

        {/* Two lists is the minimum for a comparison to exist, and they do not
            have to belong to different people — "me in 2023 vs me now" is the
            same question. */}
        <Button
          variant="primary"
          size="xl"
          fullWidth
          className="mt-4"
          disabled={total < 2}
          onClick={onCompare}
        >
          ⚖️ Compare two lists
        </Button>
        {total < 2 && (
          <p className="mt-3 text-center text-sm text-white/40">
            Save two lists to compare them.
          </p>
        )}
      </Screen>

      {creatingFor && (
        <NewListModal
          player={creatingFor}
          axis={axis}
          defaultFormat={defaultFormat}
          onCreate={(draft) => { onCreate(creatingFor.id, draft); setCreatingFor(null); }}
          onClose={() => setCreatingFor(null)}
        />
      )}

      {/* A tier list is an hour of sorting. It does not get a bare ✕. */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} width="sm">
          <h2 className="mb-3 font-display text-2xl font-black text-white">
            Delete “{confirmDelete.list.name || 'Untitled list'}”?
          </h2>
          <p className="mb-6 text-base text-white/60">This cannot be undone.</p>
          <div className="flex gap-3">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              onClick={() => {
                onDelete(confirmDelete.profileId, confirmDelete.list.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
            <Button variant="neutral" size="lg" fullWidth onClick={() => setConfirmDelete(null)}>
              Keep
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function NewListModal({ player, axis, defaultFormat, onCreate, onClose }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState(defaultFormat);

  return (
    <Modal onClose={onClose} width="sm">
      <h2 className="mb-4 font-display text-2xl font-black text-white">
        New list for {player.name}
      </h2>

      <Field label="Name" htmlFor="tier-list-name" className="mb-4">
        <Input
          id="tier-list-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_LIST_NAME_LEN}
          placeholder="All-time"
          autoFocus
          className="w-full"
        />
      </Field>

      <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-white/50">
        Format
      </p>
      <div className="mb-4 flex flex-col gap-2">
        <FormatButton
          active={format === 'tiers'}
          onClick={() => setFormat('tiers')}
          title="📋 Tiers"
          hint="S to D rows. Everything in a row is equally good — no order inside it."
        />
        <FormatButton
          active={format === 'ranked'}
          onClick={() => setFormat('ranked')}
          title="🔢 Full ranking"
          hint="One strict order, 1 to N. Every card gets its own place."
        />
      </div>

      {/* The mode is fixed at creation because it decides which pool the list
          draws from — shows or characters — and switching it later would empty
          the list. The format, which does not, is switchable on the board. */}
      <p className="mb-6 text-sm text-white/50">
        Ranking <strong className="text-white/80">{axis.label}</strong> over your{' '}
        {axis.items === 'characters' ? 'characters' : 'shows'}. Pick a different mode back on
        the setup screen.
      </p>

      <div className="flex gap-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => onCreate({ name, format })}
        >
          Create
        </Button>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </Modal>
  );
}

function FormatButton({ active, onClick, title, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-pop rounded-pop-sm border-2 px-3 py-2.5 text-left transition-colors
        ${active ? 'border-pop-amber bg-pop-amber/20' : 'border-white/10 bg-surface-2/40 hover:border-white/30'}`}
    >
      <span className="block font-display text-base font-extrabold text-white">{title}</span>
      <span className="block text-sm text-white/50">{hint}</span>
    </button>
  );
}
