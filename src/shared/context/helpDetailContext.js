import { createContext, useContext } from 'react';

// Split from HelpDetailProvider.jsx for the reason profileContext.js gives —
// react-refresh's only-export-components rule flags a hook exported alongside a
// component.
export const HelpDetailContext = createContext(null);

/**
 * Whether the settings screens are showing the long-form reasoning under each
 * option, and the switch that flips it.
 *
 * Falls back to a harmless off rather than throwing, unlike useProfileStore.
 * This is presentation only: a component rendered outside the provider should
 * show its short line and no switch, not take the app down. That matters because
 * the consumers are leaf components scattered across every game's setup screen —
 * exactly the population most likely to end up in a future screen nobody
 * remembered to wrap.
 */
export function useHelpDetail() {
  return useContext(HelpDetailContext) ?? { detail: false, setDetail: null };
}
