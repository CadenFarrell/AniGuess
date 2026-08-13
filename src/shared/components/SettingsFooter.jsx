import { GhostButton } from '../ui';
import { arePrefsDefault } from '../utils/gamePrefs';

/**
 * The bottom row of a game's ⚙️ Settings card: what happens to these options,
 * plus the escape hatch for the ones already remembered.
 *
 * The sentence renders unconditionally, and that is the whole point of it. These
 * options save when Start is pressed and at no other moment — leaving the screen
 * by the "🏠 Hub" button discards the change, and on a screen where Start is still
 * gated by the roster or the pool they cannot be saved at all. Nothing said so,
 * and the first person to use the feature hit exactly that: set something, went
 * back to the hub, came in again, found it off.
 *
 * Which is why the text cannot share the reset link's condition. All-defaults IS
 * the confused player's view — a hint that hides there explains nothing to the
 * only person who needs it.
 *
 * The link itself stays conditional: someone who has never changed a setting is
 * not offered a control that undoes nothing. It keys off the *live* values rather
 * than what is stored, so it appears the moment something is changed, before any
 * Start has written anything.
 *
 * It resets every option the game persists, including a mode picked outside the
 * settings card it sits in. Scoping it to its own card would leave a remembered
 * mode with no way to clear it, which is worse than the small surprise — hence
 * "Reset to defaults" rather than "Reset these".
 */
export default function SettingsFooter({ values, defaults, onReset }) {
  return (
    // Wraps rather than shrinking: on a narrow screen the sentence takes the
    // width it needs and the link drops beneath it, instead of the two squeezing
    // into an unreadable column each.
    <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-sm text-white/30">
        Remembered for next time — saved when you press Start.
      </p>
      {!arePrefsDefault(values, defaults) && (
        <GhostButton onClick={onReset}>↺ Reset to defaults</GhostButton>
      )}
    </div>
  );
}
