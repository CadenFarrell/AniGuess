import { useState } from 'react';
import { Avatar, Button, GhostButton } from '../../../shared/ui';

// Expandable anime list for hand-picking a character. Local assignment and
// online assignment had near-identical copies of this — the only real
// difference was the action button's label ("Pick" vs "Propose").
export default function AnimeBrowser({
  animeList,
  guesserName,
  sharedShowsOnly,
  actionLabel,
  onSelect,
  onBack,
  emptyMessage,
}) {
  const [expandedAnime, setExpandedAnime] = useState(null);

  return (
    <>
      <div className="mb-5 flex items-center gap-4">
        <GhostButton onClick={onBack}>← Back</GhostButton>
        <h4 className="font-display text-2xl font-extrabold text-white">
          {guesserName}&apos;s Characters
        </h4>
        {sharedShowsOnly && (
          <span className="ml-auto text-sm text-white/40">Shared shows only</span>
        )}
      </div>

      {animeList.length === 0 && (
        <p className="py-10 text-center text-lg text-white/50">{emptyMessage}</p>
      )}

      {animeList.map((anime) => (
        <div key={anime.id} className="mb-4">
          <button
            onClick={() => setExpandedAnime(expandedAnime === anime.id ? null : anime.id)}
            className="btn-pop focus-pop w-full border-white/15 bg-surface px-5 py-4 text-left text-lg text-white"
          >
            {expandedAnime === anime.id ? '▼' : '▶'} {anime.title}
            <span className="ml-2 font-sans font-normal text-white/40">
              ({anime.characters.length})
            </span>
          </button>

          {expandedAnime === anime.id && (
            <div className="mt-3 space-y-3 pl-2">
              {anime.characters.map((char) => (
                <div key={char.id} className="card-pop flex items-center gap-4 p-4">
                  <Avatar src={char.imageUrl} alt={char.name} size="md" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-display text-lg font-extrabold text-white">
                      {char.name}
                    </p>
                    <p className="text-base text-white/50">
                      {[char.gender, char.role].filter(Boolean).join(' · ')}
                    </p>
                    {char.ability && (
                      <p className="truncate text-sm text-white/30">{char.ability}</p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => onSelect({ ...char, series: anime.title })}
                  >
                    {actionLabel}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
