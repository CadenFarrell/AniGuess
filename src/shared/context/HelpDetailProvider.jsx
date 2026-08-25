import { useCallback, useMemo, useState } from 'react';
import { storage } from '../services/storage';
import { HelpDetailContext } from './helpDetailContext';

// Whether every settings card shows the long-form reasoning under each option.
//
// One key rather than a slot in `aniarcade_game_prefs`: that map is
// `{ [gameId]: {...} }` and each game's DEFAULT_PREFS *is* its schema (mergePrefs
// drops anything not in it), so there is nowhere in it for a value that belongs
// to no game. It is deliberately arcade-wide — somebody who has read the AniFake
// explanations does not want to dismiss the AniRank ones separately.
//
// A current-name key, unlike PROFILES_KEY, because it is new. Not added to
// resetKeys.js's PRESERVED_KEYS: a crash reset clearing a cosmetic preference is
// the right outcome, and the default it falls back to is the quiet one.
const DETAIL_KEY = 'aniarcade_setting_detail';

// Off by default, which is the whole point of the feature — the short line is
// what a returning player should meet. Someone who has never touched the switch
// gets the tidy screen; the reasoning is one tap away and stays where they leave
// it.
export default function HelpDetailProvider({ children }) {
  // Read once at mount. Nothing else in the app writes this key, so there is no
  // second copy to drift and no reason to re-read.
  const [detail, setDetailState] = useState(() => storage.getItem(DETAIL_KEY) === true);

  const setDetail = useCallback((next) => {
    setDetailState(next);
    storage.setItem(DETAIL_KEY, next);
  }, []);

  const value = useMemo(() => ({ detail, setDetail }), [detail, setDetail]);

  return <HelpDetailContext.Provider value={value}>{children}</HelpDetailContext.Provider>;
}
