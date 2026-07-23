import { useState } from 'react';
import { getAssignableAnimeList, pickRandomCharacter } from '../utils/characterPool';

// Online assignment. Unlike the local pass-and-play CharacterAssignment (one
// device passed around), every non-assignee device shows this same screen and
// shares ONE live proposal, persisted to the secret assignments/{playerId} slot
// (readable/writable only by non-assignees, per database.rules.json) so the
// assignee never sees it. Anyone can propose or change the pick; then EVERY
// non-assignee must explicitly approve it. Once all have approved, OnlineGame
// auto-locks it in. Changing the pick wipes approvals (proposeCharacter
// overwrites the slot), forcing everyone to re-approve.
export default function OnlineCharacterAssignment({
  guesser, allPlayers, sharedShowsOnly = true, twoStepRandom = false,
  currentProposal, myPlayerId, onPropose, onToggleApproval, assignmentNumber, totalPlayers,
}) {
  const [browseMode, setBrowseMode] = useState(false);
  const [expandedAnime, setExpandedAnime] = useState(null);

  const filteredAnimeList = getAssignableAnimeList(guesser, allPlayers, sharedShowsOnly);
  const proposed = currentProposal?.character ?? null;
  const approvals = currentProposal?.approvals ?? {};
  const proposedBy = currentProposal?.by
    ? (allPlayers.find((p) => p.id === currentProposal.by)?.name ?? 'Someone')
    : null;

  const needed = allPlayers.filter((p) => p.id !== guesser.id).length;
  const approvedIds = Object.keys(approvals).filter((id) => approvals[id]);
  const approverNames = approvedIds.map((id) => allPlayers.find((p) => p.id === id)?.name).filter(Boolean);
  const iApproved = !!approvals[myPlayerId];

  const proposeRandom = () => {
    const character = pickRandomCharacter(filteredAnimeList, twoStepRandom);
    if (character) onPropose(character);
    setBrowseMode(false);
  };
  const proposePick = (character) => { onPropose(character); setBrowseMode(false); };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <p className="text-white/40 text-center text-base mb-6">
          Assigning characters — {assignmentNumber} of {totalPlayers}
        </p>
        <h2 className="text-3xl font-black text-white text-center mb-1">Pick a character for</h2>
        <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 text-center mb-3">
          {guesser.name}
        </h3>
        <p className="text-white/50 text-center mb-8">
          Propose one together — everyone must approve before it locks in.
        </p>

        {filteredAnimeList.length === 0 ? (
          <div className="text-center">
            <div className="text-6xl mb-5">🤷</div>
            <p className="text-white/60 text-lg">
              {guesser.name} doesn't share any anime titles with the other players. Turn off
              "Shared shows only" in the lobby, or make sure your lists overlap.
            </p>
          </div>
        ) : browseMode ? (
          <>
            <div className="flex items-center gap-4 mb-5">
              <button onClick={() => setBrowseMode(false)} className="text-white/60 hover:text-white transition-colors text-lg">← Back</button>
              <h4 className="text-2xl font-black text-white">{guesser.name}'s Characters</h4>
              {sharedShowsOnly && <span className="text-white/40 text-sm ml-auto">Shared shows only</span>}
            </div>
            {filteredAnimeList.map((anime) => (
              <div key={anime.id} className="mb-4">
                <button
                  onClick={() => setExpandedAnime(expandedAnime === anime.id ? null : anime.id)}
                  className="w-full text-left px-5 py-4 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white font-bold text-lg transition-colors"
                >
                  {expandedAnime === anime.id ? '▼' : '▶'} {anime.title}
                  <span className="text-white/40 font-normal ml-2">({anime.characters.length})</span>
                </button>
                {expandedAnime === anime.id && (
                  <div className="mt-3 space-y-3 pl-2">
                    {anime.characters.map((char) => (
                      <div key={char.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                        {char.imageUrl ? (
                          <img src={char.imageUrl} alt={char.name} loading="lazy" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center text-white/40 font-bold text-xl flex-shrink-0">?</div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-white font-bold text-lg truncate">{char.name}</p>
                          <p className="text-white/50 text-base">{[char.gender, char.role].filter(Boolean).join(' · ')}</p>
                        </div>
                        <button onClick={() => proposePick({ ...char, series: anime.title })} className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors text-base flex-shrink-0">Propose</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            {proposed ? (
              <>
                <div className="bg-white/10 border-2 border-purple-500 rounded-2xl p-6 mb-4 text-center">
                  <p className="text-white/50 text-sm mb-3">Proposed{proposedBy ? ` by ${proposedBy}` : ''}</p>
                  <div className="flex justify-center mb-3">
                    {proposed.imageUrl ? (
                      <img src={proposed.imageUrl} alt={proposed.name} loading="lazy" className="w-32 h-32 rounded-xl object-cover" />
                    ) : (
                      <div className="w-32 h-32 rounded-xl bg-white/10 flex items-center justify-center text-5xl">?</div>
                    )}
                  </div>
                  <h4 className="text-2xl font-black text-white">{proposed.name}</h4>
                  <p className="text-white/60">from {proposed.series}</p>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/70 font-semibold">Approvals</span>
                    <span className="text-white/70 font-semibold">{approvedIds.length} / {needed}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all" style={{ width: `${(approvedIds.length / Math.max(needed, 1)) * 100}%` }} />
                  </div>
                  {approverNames.length > 0 && (
                    <p className="text-white/40 text-sm mt-2">Approved by {approverNames.join(', ')}</p>
                  )}
                </div>

                <button
                  onClick={() => onToggleApproval(!iApproved)}
                  className={`w-full py-5 font-black text-2xl rounded-xl shadow-lg transition-all mb-4 ${
                    iApproved
                      ? 'bg-white/10 border border-green-500/60 text-green-300 hover:bg-white/15'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                  }`}
                >
                  {iApproved ? '✓ You approved — tap to undo' : '✅ Approve this pick'}
                </button>

                <div className="flex gap-4">
                  <button onClick={proposeRandom} className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-lg rounded-xl transition-all">
                    🎲 Re-roll
                  </button>
                  <button onClick={() => setBrowseMode(true)} className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-xl transition-all">
                    🔍 Change
                  </button>
                </div>
                <p className="text-white/30 text-sm text-center mt-3">Changing the pick resets everyone's approval.</p>
              </>
            ) : (
              <>
                <p className="text-white/40 text-center mb-6">No character proposed yet — pick one to start.</p>
                <div className="flex gap-4">
                  <button onClick={proposeRandom} className="flex-1 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xl rounded-xl transition-all">
                    🎲 Pick Random
                  </button>
                  <button onClick={() => setBrowseMode(true)} className="flex-1 py-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xl rounded-xl transition-all">
                    🔍 Pick Manually
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
