import { countCharacters } from '../utils/profileStats';

// Who you are, parked in the corner of the hub.
//
// This used to be a full-width card between the wordmark and the game list,
// which framed picking a profile as a setup step you had to clear before the
// arcade would let you in. It is not — it's an identity you set once and then
// forget, so it belongs in the chrome, next to where every other app puts an
// account control.
//
// Mirrors HubButton's `fixed top-3 … z-40` geometry on the opposite corner. The
// hub deliberately renders no HubButton, and the top-right slot the online
// shells use for the room code only exists once a game has replaced the hub
// entirely, so nothing can collide with this.
export default function ProfileButton({ profile, onOpen }) {
  // No profile yet: this is the one control on the screen that has to be found,
  // so it gets the primary accent rather than the muted chrome treatment.
  if (!profile) {
    return (
      <button
        onClick={onOpen}
        className="focus-pop fixed top-3 right-3 z-40 flex items-center gap-2 rounded-pop-sm
          border-2 border-ink bg-pop-pink px-3 py-1.5 font-display text-sm font-bold text-ink
          transition-transform hover:-translate-y-0.5"
      >
        <span aria-hidden="true">👤</span>
        Set profile
      </button>
    );
  }

  // The counts live in the picker — the pill only has room for the one fact
  // that changes what you should do next, which is "this list is empty".
  const empty = countCharacters(profile) === 0;

  return (
    <button
      onClick={onOpen}
      aria-label={`Profile: ${profile.name}. Change profile`}
      className="focus-pop fixed top-3 right-3 z-40 flex items-center gap-2 rounded-pop-sm
        bg-black/40 px-3 py-1.5 font-display text-sm font-bold text-white/60 backdrop-blur-sm
        transition-colors hover:bg-black/60 hover:text-white"
    >
      <span aria-hidden="true">👤</span>
      {/* Capped so a long name can never reach the centred wordmark on a phone. */}
      <span className="max-w-[40vw] truncate sm:max-w-[12rem]">{profile.name}</span>
      {empty && <span aria-label="Anime list is empty" className="text-pop-amber">⚠️</span>}
    </button>
  );
}
