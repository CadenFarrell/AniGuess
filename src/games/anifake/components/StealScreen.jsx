import { useMemo, useState } from 'react';
import { MAX_STEAL_LEN } from '../rules';
import { rankSuggestions } from '../../../shared/utils/guessSuggest';
import {
  Avatar, Backdrop, Button, Card, Combobox, GhostButton, Screen, Wordmark,
} from '../../../shared/ui';

// A caught fake's one shot: name the secret and take a point back. Blind mode
// only — in decoy mode they were dealt a character of their own and have
// nothing to steal, so this phase never runs.
//
// Searched off a dropdown rather than typed blind. `options` is every character
// on every player's list in the round, NOT the pool the secret was drawn from:
// a superset under either sharedOnly setting, so the answer is always in here,
// while the narrowed candidate set stays hidden. It is still a genuinely harder
// shot than tapping one of sixteen — a few hundred names is not a board.
//
// The pick is what submits, not the text: `picked.name` is the canonical stored
// spelling, so rules.stealIsCorrect's fold has something clean to match and the
// results screen quotes a real name back.
export default function StealScreen({ fakeName = '', isMine, options = [], onSteal }) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState(null);
  // Set once a search comes up empty, and never unset: without it the fake can
  // be wedged forever. Both routers leave this phase only when `state.steal`
  // exists, so a name that is unreachable in `options` — an online player who
  // left mid-round takes their characters with them — would strand the round
  // with no way out. Free text is the fire exit, not the front door.
  const [freehand, setFreehand] = useState(false);

  const suggestions = useMemo(() => rankSuggestions(options, text), [options, text]);
  const typed = text.trim();
  // A pick always wins over the raw text, so editing after picking (which
  // clears `picked`) can't submit yesterday's choice.
  const guess = picked?.name ?? (freehand ? typed : '');
  const noMatches = typed.length >= 2 && suggestions.length === 0;

  if (!isMine) {
    return (
      <>
        <Backdrop />
        <Screen center>
          <Wordmark tone="teal" size="md" level={2} className="mb-8">🎣 Caught!</Wordmark>
          <Card padding="lg" className="mb-8 w-full border-pop-teal text-center">
            <div className="text-6xl">🎣</div>
            <p className="mt-4 font-display text-3xl font-extrabold text-white">
              The table caught {fakeName}
            </p>
            <p className="mt-2 text-lg text-pop-teal">They were the fake.</p>
            <p className="mt-4 text-white/60">
              One guess at the character is all they get. Nail it and they take a point back.
            </p>
          </Card>
          {/* The round is paused on one person — say so, rather than leaving a
              static card up that reads as a screen nobody has to act on. */}
          <p className="animate-pulse text-center text-lg text-white/50">
            ⏳ Waiting on {fakeName}&apos;s one guess…
          </p>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Backdrop />
      <Screen center>
        <Wordmark tone="teal" size="md" level={2} className="mb-6">🎣 Caught!</Wordmark>

        <Card padding="lg" className="mb-6 w-full border-pop-teal text-center">
          <div className="text-6xl">🎣</div>
          <p className="mt-4 font-display text-3xl font-extrabold text-white">
            The vote landed on you, {fakeName}
          </p>
          <p className="mt-2 text-lg text-white/60">
            One guess to take a point back. Miss it and you get nothing.
          </p>
        </Card>

        <p className="mb-3 text-center text-lg text-white/60">
          Who was everyone talking about?
        </p>

        <Card padding="lg" className="mb-6 w-full">
          <Combobox
            value={text}
            onChange={(val) => { setText(val); setPicked(null); }}
            suggestions={suggestions}
            onSelect={(option) => { setText(option.name); setPicked(option); }}
            onSubmit={() => { if (guess) onSteal(guess); }}
            optionKey={(option) => option.id}
            renderOption={(option) => (
              <>
                <Avatar src={option.imageUrl} alt="" size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{option.name}</p>
                  <p className="truncate text-xs text-white/40">{option.series}</p>
                </div>
              </>
            )}
            placeholder="Search a character…"
            maxLength={MAX_STEAL_LEN}
            ariaLabel="The character you think they were describing"
            autoFocus
          />
          <p className="mt-3 text-base text-white/40">
            {freehand
              ? 'Typing it yourself — capitals and accents don’t matter.'
              : 'Search by character or show, then pick from the list.'}
          </p>
          {noMatches && !freehand && (
            <GhostButton className="mt-3" onClick={() => setFreehand(true)}>
              Can&apos;t find them? Type it instead
            </GhostButton>
          )}
        </Card>

        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!guess}
          onClick={() => onSteal(guess)}
        >
          {guess ? `🎯 Lock in ${guess}` : 'Pick a character'}
        </Button>
      </Screen>
    </>
  );
}
