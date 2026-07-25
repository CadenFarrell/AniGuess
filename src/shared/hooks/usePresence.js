import { useCallback, useEffect, useRef } from 'react';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { getFirebaseDb } from '../services/firebase';

// Keeps one "I'm still here" record alive in Realtime Database, and — the part
// no client-side handler can manage — makes sure it flips to offline even when
// the tab is closed, the browser crashes, or the network vanishes. Firebase
// runs the onDisconnect write server-side when the socket drops, which is why
// this doesn't need a beforeunload handler or a heartbeat.
//
// Backend-shaped but game-agnostic: the caller supplies the path, so each room
// hook decides where its presence lives. Pass null when not in a room.
//
// Written with the room hooks' bestEffort spirit — presence is a nicety layered
// on top of the game, so a failed write must never break play.
export function usePresence(path) {
  const pathRef = useRef(path);
  useEffect(() => { pathRef.current = path; }, [path]);

  // Once a player has deliberately left, nothing else may overwrite that record
  // with a plainer "offline" one — the room needs to tell the two apart.
  const leftRef = useRef(false);

  useEffect(() => {
    if (!path) return undefined;
    leftRef.current = false;

    const db = getFirebaseDb();
    const myRef = ref(db, path);
    let cancelled = false;

    // .info/connected fires on every reconnect, and an onDisconnect handler is
    // consumed when it runs — so the registration has to be redone each time.
    const unsubscribe = onValue(ref(db, '.info/connected'), (snap) => {
      if (!snap.val() || cancelled || leftRef.current) return;
      // Arm the disconnect write *before* claiming to be online, so a crash in
      // the gap can't strand a permanently-online record in the room.
      onDisconnect(myRef)
        .set({ online: false, at: serverTimestamp() })
        .then(() => {
          if (cancelled || leftRef.current) return undefined;
          return set(myRef, { online: true });
        })
        .catch(() => { /* best effort — never block play on presence */ });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      // Leaving the room in-app should look the same to everyone else as
      // closing the tab. markLeft() already wrote a richer record if it ran.
      if (!leftRef.current) {
        onDisconnect(myRef).cancel().catch(() => {});
        set(myRef, { online: false, at: serverTimestamp() }).catch(() => {});
      }
    };
  }, [path]);

  // A deliberate exit, as opposed to a dropped connection: recorded so the room
  // can skip the reconnect grace period and say "left" rather than "waiting".
  const markLeft = useCallback(async () => {
    const currentPath = pathRef.current;
    if (!currentPath) return;
    // Set synchronously, before the first await, so the cleanup above sees it
    // even when the caller tears the room down in the very next statement.
    leftRef.current = true;

    const myRef = ref(getFirebaseDb(), currentPath);
    try {
      await onDisconnect(myRef).cancel();
    } catch { /* best effort */ }
    try {
      await set(myRef, { online: false, left: true, at: serverTimestamp() });
    } catch { /* best effort */ }
  }, []);

  return markLeft;
}
