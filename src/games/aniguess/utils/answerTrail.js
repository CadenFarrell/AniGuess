// The talk-mode stand-in for the question log. A spoken question is never
// recorded — there is no text to record — so the log rows would all be blank,
// but the *answers* still carry the one thing the table wants back: how many
// questions this player has already burned, and how they went.
//
// Deliberately a pure module rather than JSX inside GameScreen: the ordering
// flip below is the kind of thing that silently reverses in a refactor, and the
// vitest config only runs `src/**/*.test.js`, so logic that lives in a .jsx
// file cannot be covered at all.

// rules.js prepends each entry (`[logEntry, ...previous]`), so a log is
// newest-first. A trail is read left-to-right like a sentence, so it is
// oldest-first — reverse a copy, never the caller's array.
export function answerTrail(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map(chipFor)
    .filter(Boolean)
    .reverse();
}

// `tone` names the semantic accent rather than a class, so the component picks
// the colour and this file stays free of Tailwind.
function chipFor(entry) {
  if (!entry) return null;
  switch (entry.type) {
    case 'question':
      // Anything other than a real answer means the entry was written by some
      // path that isn't the Yes/No buttons — drop it rather than render a chip
      // that claims one of the two.
      if (entry.answer !== 'Yes' && entry.answer !== 'No') return null;
      return entry.answer === 'Yes'
        ? { id: entry.id, icon: '✅', label: 'Yes', tone: 'yes' }
        : { id: entry.id, icon: '❌', label: 'No', tone: 'no' };
    case 'guess':
      // A correct guess locks the player's position and ends their round, so
      // it can only ever be the last chip — and in practice the trail is gone
      // by the time anyone could see it. Rendered anyway: `correct` is the
      // entry's own field and branching on it costs nothing.
      return entry.correct
        ? { id: entry.id, icon: '🎯', label: 'Guessed right', tone: 'yes' }
        : { id: entry.id, icon: '🎯❌', label: 'Wrong guess', tone: 'no' };
    case 'timer':
      return { id: entry.id, icon: '⏱️', label: 'Ran out of time', tone: 'warn' };
    default:
      return null;
  }
}
