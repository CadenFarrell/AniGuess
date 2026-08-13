import { useState } from 'react';
import { useTierLists } from '../hooks/useTierLists';
import { useCustomPrompts } from '../hooks/useCustomPrompts';
import { resolveSavedAxis } from '../prefs';
import { getAxis } from '../axes';
import { placedIds } from '../tiers';
import {
  Badge, Banner, Button, Card, CardRow, Field, Screen, Select, Wordmark,
} from '../../../shared/ui';

// Pick one of my saved lists and send it to the room.
//
// BUILDING stays offline and solo, which is the whole shape of this feature: a
// tier list is every show on a profile, sorted over an hour, and a room is not
// where that happens. What the room adds is the only part that needs other
// people — seeing whose ordering you actually share. So nothing here edits a
// list; it chooses one that already exists.
//
// Lists are read straight from localStorage rather than from the room, because
// they belong to a person rather than a session. `myPlayerId` IS the profile id
// online (the player record in state/ is the profile), so listsFor takes it
// directly.
export default function TierPublish({ room, onCompare }) {
  const { listsFor, saveError } = useTierLists();
  const { prompts } = useCustomPrompts();
  const [publishing, setPublishing] = useState(false);

  const mine = listsFor(room.myPlayerId);
  const published = room.tierLists ?? {};
  const players = room.players ?? [];
  const activeIds = room.activeIds ?? players.map((p) => p.id);

  // Default to the list already published if there is one, so re-opening this
  // screen shows what the room has rather than resetting to the newest list.
  const [pickedId, setPickedId] = useState(
    () => room.myList?.id ?? mine[0]?.id ?? ''
  );
  const picked = mine.find((l) => l.id === pickedId) ?? null;

  // Everyone still here. A player who left keeps their published list — it is
  // still a real answer to "how do you rank these" — but the room must not wait
  // on them, which is the readiness-gate half of the rule normalizeState states.
  const waitingOn = players.filter(
    (p) => activeIds.includes(p.id) && !published[p.id]
  );
  const readyCount = Object.keys(published).length;
  const canCompare = readyCount >= 2;

  const describe = (list) => {
    const axis = getAxis(resolveSavedAxis(list.axisId, prompts));
    const count = placedIds(list).length;
    return `${list.format === 'ranked' ? 'Ranked' : 'Tiers'} · ${count} placed · ${axis.label}`;
  };

  const publish = async () => {
    if (!picked) return;
    setPublishing(true);
    await room.publishList(picked);
    setPublishing(false);
  };

  return (
    <Screen width="md">
      <Wordmark tone="amber" size="sm" level={2} className="mb-2">
        📊 Compare lists
      </Wordmark>
      <p className="mb-8 text-center text-white/50">
        Everyone sends a list they&rsquo;ve already built, then the room sees where you agree.
      </p>

      {saveError && <Banner tone="danger" className="mb-4">⚠️ {saveError}</Banner>}

      <Card title={`Sent (${readyCount} of ${players.length})`} padding="lg" className="mb-6">
        {players.map((p) => {
          const sent = published[p.id];
          const gone = !activeIds.includes(p.id);
          return (
            <CardRow key={p.id} className={gone ? 'opacity-40' : ''}>
              <span className="min-w-0 flex-1 truncate text-white">
                {p.id === room.hostId && <span title="Host">👑 </span>}
                {p.name}
                {p.id === room.myPlayerId && <span className="text-pop-amber"> (you)</span>}
                {sent && (
                  <span className="ml-2 text-sm text-white/40">
                    {sent.name || 'Untitled list'}
                  </span>
                )}
              </span>
              {gone && <Badge tone="red">Left</Badge>}
              <Badge tone={sent ? 'lime' : 'neutral'}>{sent ? 'Sent ✓' : 'Waiting'}</Badge>
            </CardRow>
          );
        })}
      </Card>

      {mine.length === 0 ? (
        // The one dead end this screen has, so it says the way out rather than
        // showing an empty picker: lists are built in local play, and there is
        // no builder in here to send someone to.
        <Card padding="lg" className="mb-6 text-center">
          <div className="mb-2 text-4xl">📋</div>
          <p className="font-display text-lg font-extrabold text-white">
            You haven&rsquo;t built a list yet
          </p>
          <p className="mt-1 text-white/50">
            Tier lists are built in local play — leave the room, pick AniRank &rarr; Local, and
            choose the tier-list format. Your list is saved to this device, so come back and
            send it whenever you like.
          </p>
        </Card>
      ) : (
        <Card title="📤 Send a list" padding="lg" className="mb-6">
          <Field label="Which list" htmlFor="publish-pick" className="mb-4">
            <Select
              id="publish-pick"
              value={pickedId}
              onChange={(e) => setPickedId(e.target.value)}
              className="w-full"
            >
              {mine.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name || 'Untitled list'} — {describe(l)}
                </option>
              ))}
            </Select>
          </Field>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={publish}
            disabled={!picked || publishing}
          >
            {room.myList ? '🔁 Replace my list' : '📤 Send my list'}
          </Button>

          {room.myList && (
            <p className="mt-3 text-sm text-white/40">
              The room has &ldquo;{room.myList.name || 'Untitled list'}&rdquo;. Sending again
              replaces it.
            </p>
          )}
        </Card>
      )}

      {waitingOn.length > 0 && (
        <Banner tone="info" className="mb-4">
          Waiting on {waitingOn.map((p) => p.name).join(', ')}. You can compare without them.
        </Banner>
      )}

      <Button
        variant="secondary"
        size="xl"
        fullWidth
        onClick={onCompare}
        disabled={!canCompare}
      >
        {canCompare ? '🔍 Compare the room' : '🔍 Need two lists to compare'}
      </Button>
    </Screen>
  );
}
