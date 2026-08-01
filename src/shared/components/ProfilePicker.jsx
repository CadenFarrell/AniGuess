import { useState } from 'react';
import { useProfileStore } from '../context/profileContext';
import { summarizeProfiles } from '../utils/profileStats';
import { Badge, Button, Input, Label, Modal } from '../ui';

// Pick who you are, once, for the whole arcade.
//
// Deliberately a *picker* and not another name box. Profile ids are folded
// names (profileIdFromName), so every screen that asked you to retype your name
// was one typo away from silently minting an empty profile that looked exactly
// like a lost AniList import. Choosing from a list cannot do that.
//
// Editing an anime list is not in here: ListManager renders a full-height page,
// not a dialog, so the hub routes to it instead and this just asks for it.
//
// Two modes over one list, because the underlying question differs:
//
//   'main' — which profile *am I*. Writes activeId, so it is the identity every
//            online room sees. One at a time.
//   'add'  — who else is on the couch. Hands a profile back to a local setup
//            screen's roster via onPick and touches activeId not at all. This is
//            the whole reason ProfileProvider splits ensureProfile from
//            createProfile; 'add' must never displace your main profile.
//
// 'add' also hides delete: it is device-level housekeeping, and offering it
// mid-roster is how you lose a list by accident.
export default function ProfilePicker({
  mode = 'main',
  excludeIds = [],
  onPick,
  onClose,
  onEditList,
}) {
  const {
    profiles, activeId, selectProfile, createProfile, ensureProfile, removeProfile,
  } = useProfileStore();
  const [nameInput, setNameInput] = useState('');
  const [creating, setCreating] = useState(false);

  const adding = mode === 'add';
  const rows = summarizeProfiles(profiles, activeId);
  // summarizeProfiles already sorts the active profile first, so this partition
  // needs no second sort.
  const mainRow = adding ? null : rows.find((r) => r.isActive) ?? null;
  const otherRows = adding ? rows : rows.filter((r) => !r.isActive);

  const handleCreate = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    // ensureProfile in 'add' mode: creating a guest must not make them you.
    const { profile } = adding ? ensureProfile(trimmed) : createProfile(trimmed);
    setNameInput('');
    setCreating(false);
    if (adding) onPick(profile);
    onClose();
  };

  const handleDelete = (row) => {
    const warning = row.characters > 0
      ? `Delete ${row.name}? Their ${row.shows} show${row.shows === 1 ? '' : 's'} and ${row.characters} characters will be gone, and re-importing takes a couple of minutes.`
      : `Delete ${row.name}?`;
    if (window.confirm(warning)) removeProfile(row.id);
  };

  const handleRow = (row) => {
    if (adding) onPick(profiles[row.id]);
    else selectProfile(row.id);
    onClose();
  };

  const renderRow = (row) => {
    // Already seated players stay visible but inert. Hiding them would leave
    // you hunting for a name that is right there on the roster behind the modal.
    const seated = adding && excludeIds.includes(row.id);

    return (
      <div
        key={row.id}
        className={`flex items-center gap-3 rounded-pop border-2 p-3 transition-colors
          ${row.isActive && !adding
            ? 'border-pop-purple bg-pop-purple/15'
            : 'border-white/15 bg-surface'}
          ${seated ? 'opacity-40' : ''}`}
      >
        <button
          onClick={() => handleRow(row)}
          disabled={seated}
          aria-pressed={adding ? undefined : row.isActive}
          // Named explicitly: the ▸ is decorative and the counts below are the
          // kind of detail that makes a screen-reader label worse rather than
          // better.
          aria-label={adding
            ? `Add ${row.name} to this game`
            : `Make ${row.name} your main profile`}
          className="focus-pop min-w-0 flex-1 rounded-pop-sm text-left disabled:cursor-default"
        >
          <span className="block truncate font-display font-extrabold text-white">
            <span aria-hidden="true">{row.isActive && !adding ? '▸ ' : ''}</span>{row.name}
          </span>
          <span className="mt-0.5 block text-sm text-white/40">
            {row.shows} show{row.shows === 1 ? '' : 's'} · {row.characters} characters
          </span>
        </button>

        {seated && <Badge tone="neutral">In game</Badge>}
        {row.characters === 0 && !seated && <Badge tone="amber">⚠️ Empty</Badge>}

        {!adding && (
          <>
            <Button
              variant="neutral"
              size="sm"
              aria-label={`Edit ${row.name}'s anime list`}
              onClick={() => onEditList(row.id)}
            >
              ✏️
            </Button>
            <button
              onClick={() => handleDelete(row)}
              aria-label={`Delete ${row.name}`}
              className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm text-white/40 hover:text-pop-red"
            >
              🗑️
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <Modal onClose={onClose} width="sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-2xl font-extrabold text-white">
          {adding ? '➕ Add a player' : '👤 Your profiles'}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="focus-pop -mr-2 grid h-11 w-11 place-items-center rounded-pop-sm text-xl font-black text-white/40 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* The one sentence that explains the whole model. Without it, "main" and
          "also saved" read as an arbitrary sort order. */}
      <p className="mb-6 text-sm text-white/45">
        {adding
          ? 'Anyone saved on this device. Adding someone here won’t change your main profile.'
          : 'Your main profile is who you are in online games. The rest stay saved on this device for pass-and-play.'}
      </p>

      {rows.length === 0 && !creating && (
        <p className="mb-5 text-center text-white/40">
          No profiles yet. Create one and import your AniList once — every game uses it.
        </p>
      )}

      {mainRow && (
        <div className="mb-5">
          <p className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/35">
            Main profile
          </p>
          {renderRow(mainRow)}
        </div>
      )}

      {otherRows.length > 0 && (
        <div className="mb-5">
          {!adding && (
            <p className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/35">
              Also saved on this device
            </p>
          )}
          <div className="space-y-3">{otherRows.map(renderRow)}</div>
        </div>
      )}

      {creating || rows.length === 0 ? (
        <div>
          <Label htmlFor="new-profile-name">New profile name</Label>
          <Input
            id="new-profile-name"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && handleCreate()}
            placeholder={adding ? 'Player name...' : 'Enter your name...'}
            autoFocus
            className="mb-3 text-lg"
          />
          <div className="flex gap-3">
            {rows.length > 0 && (
              <Button variant="neutral" onClick={() => { setCreating(false); setNameInput(''); }}>
                Cancel
              </Button>
            )}
            <Button
              variant="success"
              className="flex-1"
              onClick={handleCreate}
              disabled={!nameInput.trim()}
            >
              {adding ? 'Add' : 'Create'}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="neutral" fullWidth onClick={() => setCreating(true)}>
          ➕ New profile
        </Button>
      )}
    </Modal>
  );
}
