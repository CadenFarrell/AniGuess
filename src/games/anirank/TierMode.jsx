import { useCallback, useMemo, useState } from 'react';
import TierPicker from './components/TierPicker';
import TierBoard from './components/TierBoard';
import TierCompare from './components/TierCompare';
import { useTierLists } from './hooks/useTierLists';
import { useCustomPrompts } from './hooks/useCustomPrompts';
import { eligibleItems } from './utils/deck';
import { getAxis } from './axes';
import { resolveSavedAxis } from './prefs';
import { newList, reconcileList } from './tiers';
import { Backdrop } from '../../shared/ui';

// The tier-list half of AniRank: a thin view-router, the same shape LocalGame
// is, holding a `view` string and handing the work to dumb screens.
//
// Kept out of LocalGame rather than folded into its switch because the two
// share nothing past the setup screen — no deck, no round, no score — and a
// router that serves both would have to null-guard every branch against the
// other's state.

// The deck builder's two opinion probes. `kind: 'opinion'` is what makes them
// the WHOLE pool: a fact axis drops any item missing its stat, which on a
// profile imported before the stats existed would silently tier a fraction of
// the list (see utils/deck.js).
const SHOWS = { kind: 'opinion', items: 'shows' };
const CHARACTERS = { kind: 'opinion', items: 'characters' };

export default function TierMode({ players, sharedOnly, axis, format, onBack }) {
  const { prompts } = useCustomPrompts();
  const { byProfile, listsFor, saveList, deleteList, duplicateList, saveError } = useTierLists();
  const [view, setView] = useState('picker'); // picker | board | compare
  const [open, setOpen] = useState(null);     // { profileId, listId }

  // Both pools once, not once per list. Every list a player has draws from one
  // of exactly two, and eligibleItems is a full pass over every seated profile's
  // anime list — the same reasoning behind deck.js's opinionPoolCounts.
  const pools = useMemo(() => ({
    shows: eligibleItems(players, { axis: SHOWS, sharedOnly }),
    characters: eligibleItems(players, { axis: CHARACTERS, sharedOnly }),
  }), [players, sharedOnly]);

  // A list draws from the pool its OWN items field names, not the one the setup
  // screen currently has selected. Otherwise opening a saved character list
  // while "Best → Worst" is picked would empty it.
  const cardsFor = useCallback((list) => pools[list.items] ?? pools.shows, [pools]);

  const stored = open ? byProfile[open.profileId]?.[open.listId] : null;
  // Repaired for display here; the write happens on the next edit rather than
  // in a render-time effect. A list nobody touches again is one nobody has lost
  // anything from, and the banner on the board says what went either way.
  const { list, dropped } = useMemo(
    () => (stored ? reconcileList(stored, cardsFor(stored)) : { list: null, dropped: 0 }),
    [stored, cardsFor]
  );

  const total = players.reduce((n, p) => n + listsFor(p.id).length, 0);

  const handleCreate = (profileId, draft) => {
    const created = saveList(profileId, newList({ ...draft, axis: getAxis(axis) }));
    if (created) {
      setOpen({ profileId, listId: created.id });
      setView('board');
    }
  };

  const toPicker = () => { setOpen(null); setView('picker'); };

  const body = () => {
    // A missing list falls back to the picker rather than rendering a blank
    // board — reachable by deleting the open list, and by a stored id that no
    // longer resolves.
    if (view === 'board' && list) {
      return (
        <TierBoard
          list={list}
          cards={cardsFor(list)}
          // The axis the LIST was saved with, not the one setup currently shows.
          // resolveSavedAxis is the same lookup prefs.js does for a remembered
          // id, and it is needed for the identical reason: a custom prompt can
          // only be recovered from the prompts this device has saved.
          axis={getAxis(resolveSavedAxis(list.axisId, prompts))}
          dropped={dropped}
          saveError={saveError}
          canCompare={total >= 2}
          onChange={(next) => saveList(open.profileId, next)}
          onCompare={() => setView('compare')}
          onBack={toPicker}
        />
      );
    }

    if (view === 'compare' && total >= 2) {
      return (
        <TierCompare
          players={players}
          listsFor={listsFor}
          cardsFor={cardsFor}
          onBack={() => setView(open ? 'board' : 'picker')}
        />
      );
    }

    return (
      <TierPicker
        players={players}
        listsFor={listsFor}
        prompts={prompts}
        axis={getAxis(axis)}
        defaultFormat={format === 'ranked' ? 'ranked' : 'tiers'}
        poolCounts={{ shows: pools.shows.length, characters: pools.characters.length }}
        saveError={saveError}
        onOpen={(profileId, listId) => { setOpen({ profileId, listId }); setView('board'); }}
        onCreate={handleCreate}
        onDelete={deleteList}
        onDuplicate={duplicateList}
        onCompare={() => setView('compare')}
        onBack={onBack}
      />
    );
  };

  return (
    <>
      <Backdrop />
      {body()}
    </>
  );
}
