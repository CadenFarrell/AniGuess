import { normalizeCharacter } from '../../../shared/utils/character';
import { Avatar, Button, Card, Screen, Wordmark } from '../../../shared/ui';

export default function CharacterReveal({ character, guesserName, onStartQuestioning, isLastPlayer, online = false }) {
  // Normalize defensively — a character just edited via ListManager mid-session
  // may still have the raw (unnormalized) shape until the profile is reloaded.
  const c = normalizeCharacter(character);

  const facts = [
    { emoji: '📺', label: 'Series', value: c.series },
    { emoji: '🎭', label: 'Role', value: c.role },
    { emoji: '👤', label: 'Gender', value: c.gender },
    { emoji: '💇', label: 'Hair Color', value: c.hairColor },
    { emoji: '⚡', label: 'Ability', value: c.ability },
    { emoji: '📖', label: 'Description', value: c.description },
    { emoji: '🎬', label: 'Genre', value: c.genres.join(', ') },
  ].filter((f) => f.value);

  return (
    <Screen center width="md">
      <Wordmark tone="pink" size="md" level={2} className="mb-8">
        🎭 Character Reveal
      </Wordmark>

      <div className="mb-5 flex justify-center">
        <Avatar src={c.imageUrl} alt={c.name} size="xl" />
      </div>

      <h3 className="mb-6 text-center font-display text-3xl font-extrabold text-white">{c.name}</h3>

      <Card padding="lg" className="mb-8 space-y-3 text-left">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-start gap-4 text-white">
            <span className="flex-shrink-0 text-2xl">{fact.emoji}</span>
            <div>
              <span className="font-display text-xs uppercase tracking-widest text-white/40">
                {fact.label}
              </span>
              <p className="text-lg text-white/80">{fact.value}</p>
            </div>
          </div>
        ))}
      </Card>

      <p className="mb-8 text-center text-lg italic text-white/50">
        {online ? (
          <>Memorize this — it&apos;s <strong className="text-white">{guesserName}</strong>&apos;s character.</>
        ) : (
          <>Memorize this, then pass the device to <strong className="text-white">{guesserName}</strong></>
        )}
      </p>

      <Button variant="primary" size="xl" fullWidth onClick={onStartQuestioning}>
        {isLastPlayer ? '🎮 Start Game!' : '➡️ Next Player'}
      </Button>
    </Screen>
  );
}
