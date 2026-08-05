import { Button, Card } from '../ui';

// "Playing online as X" — the header of both games' RoomSetup.
//
// Online is single-identity: whoever the hub's main profile is, is who the room
// sees. Both RoomSetups had hand-rolled the same card to say so, drifting only
// in accent colour and in which stat they cared about, so it lives here now.
//
// `stat` is passed pre-formatted rather than computed here: AniGuess counts
// characters and AniTune counts shows, and neither number means anything in the
// other game.
const TONES = {
  purple: 'text-pop-purple',
  blue: 'text-pop-blue',
  amber: 'text-pop-amber',
  teal: 'text-pop-teal',
};

export default function OnlineIdentityCard({ profile, stat, tone = 'purple', onSwitch, onImport }) {
  return (
    <Card className="mb-6 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-white/40">Playing online as</p>
        <p className="truncate font-display text-lg font-extrabold text-white">{profile.name}</p>
        <p className="text-sm text-white/40">{stat}</p>
        {/* Player ids come from the profile name, so a room rejects a second
            person using the same one — make switching easy. */}
        <button
          onClick={onSwitch}
          className={`focus-pop mt-1 rounded-pop-sm text-sm hover:text-white ${TONES[tone] ?? TONES.purple}`}
        >
          Not you? Switch profile
        </button>
      </div>
      <Button variant="neutral" size="sm" className="flex-shrink-0" onClick={onImport}>
        🔗 Import from AniList
      </Button>
    </Card>
  );
}
