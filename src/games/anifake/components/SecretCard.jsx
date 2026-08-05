import { Avatar, Card } from '../../../shared/ui';

// What one player was dealt. Rendered on its own screen locally (behind the
// pass-the-device gate in SecretReveal) and inline above the clue log online,
// where the device is already private.
//
// The card carries its own character now rather than an index into a shared
// board — there is no board — so this takes one prop and cannot render a torn
// read of two nodes.
//
// Decoy mode never reaches the fake branch: nobody is told they are the fake,
// so the fake sees an ordinary character card and has no idea it differs from
// everyone else's. That is the mode, not an oversight.
export default function SecretCard({ card, compact = false }) {
  if (!card) {
    return (
      <Card padding="lg" className="text-center text-white/50">
        Waiting for the deal…
      </Card>
    );
  }

  if (card.isFake) {
    return (
      <Card padding={compact ? 'sm' : 'lg'} className="border-pop-red text-center">
        <div className={compact ? 'text-3xl' : 'text-6xl'}>🕵️</div>
        <p className="mt-2 font-display text-2xl font-extrabold text-pop-red">
          You are the fake
        </p>

        {/* The fake's entire hand. Absent rather than faked when the character
            carries no genres — see utils/pool.js's hintFor: a made-up hint
            sends them somewhere the clues will never go, which plays as the
            game lying to them rather than as a hard round. */}
        {card.hint ? (
          <div className="mt-4">
            <p className="font-display text-xs font-extrabold uppercase tracking-widest text-white/40">
              Your only hint
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold text-white">
              {card.hint}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-white/40">
            No hint — this character has no genres on file. You&apos;re going in blind.
          </p>
        )}

        <p className="mt-4 text-white/60">
          You don&apos;t know the character. Listen to the clues, bluff one of your own,
          and don&apos;t get voted out.
        </p>
      </Card>
    );
  }

  const character = card.character;
  if (!character) {
    // Only reachable if a decoy-mode deal ran on a pool of one, which
    // rules.minPool gates against. Say so rather than rendering an empty frame.
    return (
      <Card padding="lg" className="text-center text-white/50">
        Your card didn&apos;t load — hold on…
      </Card>
    );
  }

  return (
    <Card padding={compact ? 'sm' : 'lg'} className="border-pop-teal">
      <div className="flex items-center gap-4">
        <Avatar src={character.imageUrl} alt="" size={compact ? 'md' : 'lg'} />
        <div className="min-w-0">
          <p className="font-display text-xs font-extrabold uppercase tracking-widest text-pop-teal">
            Your character
          </p>
          <p className="truncate font-display text-2xl font-extrabold text-white">
            {character.name}
          </p>
          <p className="truncate text-white/50">{character.series}</p>
        </div>
      </div>
    </Card>
  );
}
