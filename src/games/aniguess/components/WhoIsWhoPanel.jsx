import { useState } from 'react';
import { Avatar, Button, Card, GhostButton, Modal } from '../../../shared/ui';

// "Who is who?" — re-check the assigned characters you're already entitled to
// know. Everyone sees a character exactly once, on CharacterReveal, and then has
// to carry it for the whole round in order to answer that player's questions.
//
// The two modes have different secrecy shapes, hence `gated`:
//   online (gated=false) — the device is private, so `entries` simply omits the
//     owner and every card can be shown at once.
//   local  (gated=true)  — one shared screen, so every player IS listed but each
//     sits behind their own "look away!" step, the same gate
//     CharacterAssignment.jsx uses. A locked player (they already guessed
//     correctly, so their character is public) skips the gate.
export default function WhoIsWhoPanel({ entries = [], gated = false, className = 'mb-5' }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const selected = entries.find((e) => e.playerId === selectedId) ?? null;

  const close = () => {
    setOpen(false);
    // Reset the step too, so reopening never lands straight back on a card
    // the next player at the table isn't supposed to see.
    setSelectedId(null);
    setRevealed(false);
  };

  const backToPlayers = () => {
    setSelectedId(null);
    setRevealed(false);
  };

  const pickPlayer = (entry) => {
    setSelectedId(entry.playerId);
    setRevealed(entry.locked);
  };

  return (
    <>
      <Button
        variant="neutral"
        fullWidth
        className={className}
        onClick={() => setOpen(true)}
        disabled={entries.length === 0}
      >
        🙈 Who is who?
      </Button>

      {open && (
        <Modal onClose={close}>
          {/* The gate is a full-attention screen — a heading above it would just
              compete with "look away!". */}
          {!(gated && selected && !revealed) && (
            <>
              <h3 className="font-display text-2xl font-extrabold text-white">🙈 Who is who?</h3>
              <p className="mb-5 text-base text-white/50">
                {gated
                  ? 'Tap a player to recheck their character.'
                  : 'Everyone else’s character — never your own.'}
              </p>
            </>
          )}

          {entries.length === 0 && (
            <p className="text-lg text-white/50">Nothing to show yet.</p>
          )}

          {/* Online: the whole roster at once. */}
          {!gated && entries.length > 0 && (
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {entries.map((entry) => (
                <CharacterCard key={entry.playerId} name={entry.name} character={entry.character} />
              ))}
            </div>
          )}

          {/* Local, step 1: pick whose character to recheck. */}
          {gated && !selected && entries.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {entries.map((entry) => (
                <button
                  key={entry.playerId}
                  onClick={() => pickPlayer(entry)}
                  className="focus-pop flex items-center gap-2 rounded-pop-sm border-2 border-white/15
                    bg-surface-2 px-4 py-2 font-display text-base font-extrabold text-white
                    transition-colors hover:bg-white/10"
                >
                  <span>{entry.name}</span>
                  <span>{entry.locked ? '🔓' : '🙈'}</span>
                </button>
              ))}
            </div>
          )}

          {/* Local, step 2: the look-away gate. */}
          {gated && selected && !revealed && (
            <div className="text-center">
              <div className="mb-5 text-7xl">📵</div>
              <h3 className="mb-3 font-display text-3xl font-extrabold text-white">
                {selected.name}, look away!
              </h3>
              <p className="mb-8 text-lg text-white/60">
                Everyone else — here&apos;s who {selected.name} is playing as.
              </p>
              <Button variant="success" size="lg" fullWidth onClick={() => setRevealed(true)}>
                {selected.name} is looking away — Ready! ✅
              </Button>
              <GhostButton className="mt-4" onClick={backToPlayers}>
                ← Back to players
              </GhostButton>
            </div>
          )}

          {/* Local, step 3: the character. */}
          {gated && selected && revealed && (
            <CharacterCard name={selected.name} character={selected.character} />
          )}

          <div className="mt-5 flex gap-3">
            {gated && selected && revealed && (
              <GhostButton onClick={backToPlayers}>← Back to players</GhostButton>
            )}
            <Button variant="secondary" size="lg" className="flex-1" onClick={close}>
              Done — close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

// Same compact shape OnlineAnswererView pins above the answer buttons: enough to
// jog a memory without turning into a second full CharacterReveal.
function CharacterCard({ name, character }) {
  const details = [character.gender, character.role].filter(Boolean).join(' · ');

  return (
    <Card padding="sm" className="flex items-center gap-4">
      <Avatar src={character.imageUrl} alt={character.name} size="md" />
      <div className="min-w-0">
        <p className="font-display text-xs uppercase tracking-widest text-white/40">{name} is</p>
        <p className="truncate font-display text-xl font-extrabold text-white">{character.name}</p>
        <p className="truncate text-sm text-white/50">{character.series}</p>
        {details && <p className="truncate text-xs text-white/30">{details}</p>}
      </div>
    </Card>
  );
}
