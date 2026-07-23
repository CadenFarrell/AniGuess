import { useState } from 'react';
import { getAssignableAnimeList, pickRandomCharacter } from '../utils/characterPool';
import AnimeBrowser from './AnimeBrowser';
import { Avatar, Button, Card, Screen, Wordmark } from '../../../shared/ui';

const NO_SHARED_HELP = 'Turn off "Shared shows only" in the lobby, or make sure your lists overlap.';

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
    <Screen center width="md">
      <p className="mb-6 text-center text-base text-white/40">
        Assigning characters — {assignmentNumber} of {totalPlayers}
      </p>
      <p className="mb-4 text-center font-display text-3xl font-extrabold text-white">
        Pick a character for
      </p>
      <Wordmark tone="pink" size="md" level={2} className="mb-3">
        {guesser.name}
      </Wordmark>
      <p className="mb-8 text-center text-white/50">
        Propose one together — everyone must approve before it locks in.
      </p>

      {filteredAnimeList.length === 0 ? (
        <div className="text-center">
          <div className="mb-5 text-6xl">🤷</div>
          <p className="text-lg text-white/60">
            {guesser.name} doesn&apos;t share any anime titles with the other players.{' '}
            {NO_SHARED_HELP}
          </p>
        </div>
      ) : browseMode ? (
        <AnimeBrowser
          animeList={filteredAnimeList}
          guesserName={guesser.name}
          sharedShowsOnly={sharedShowsOnly}
          actionLabel="Propose"
          onSelect={proposePick}
          onBack={() => setBrowseMode(false)}
          emptyMessage={NO_SHARED_HELP}
        />
      ) : proposed ? (
        <>
          <Card padding="lg" className="mb-4 border-pop-purple text-center">
            <p className="mb-3 text-sm text-white/50">
              Proposed{proposedBy ? ` by ${proposedBy}` : ''}
            </p>
            <div className="mb-3 flex justify-center">
              <Avatar src={proposed.imageUrl} alt={proposed.name} size="lg" />
            </div>
            <h4 className="font-display text-2xl font-extrabold text-white">{proposed.name}</h4>
            <p className="text-white/60">from {proposed.series}</p>
          </Card>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between font-display font-bold text-white/70">
              <span>Approvals</span>
              <span>{approvedIds.length} / {needed}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2">
              <div
                className="h-full bg-pop-lime transition-all"
                style={{ width: `${(approvedIds.length / Math.max(needed, 1)) * 100}%` }}
              />
            </div>
            {approverNames.length > 0 && (
              <p className="mt-2 text-sm text-white/40">Approved by {approverNames.join(', ')}</p>
            )}
          </div>

          <Button
            variant={iApproved ? 'neutral' : 'success'}
            size="xl"
            fullWidth
            className="mb-4"
            onClick={() => onToggleApproval(!iApproved)}
          >
            {iApproved ? '✓ You approved — tap to undo' : '✅ Approve this pick'}
          </Button>

          <div className="flex gap-4">
            <Button variant="info" size="lg" className="flex-1" onClick={proposeRandom}>
              🎲 Re-roll
            </Button>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setBrowseMode(true)}>
              🔍 Change
            </Button>
          </div>
          <p className="mt-3 text-center text-sm text-white/30">
            Changing the pick resets everyone&apos;s approval.
          </p>
        </>
      ) : (
        <>
          <p className="mb-6 text-center text-white/40">
            No character proposed yet — pick one to start.
          </p>
          <div className="flex gap-4">
            <Button variant="info" size="lg" className="flex-1" onClick={proposeRandom}>
              🎲 Pick Random
            </Button>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setBrowseMode(true)}>
              🔍 Pick Manually
            </Button>
          </div>
        </>
      )}
    </Screen>
  );
}
