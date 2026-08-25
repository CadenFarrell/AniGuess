import { Avatar } from '../../../shared/ui';

// One show or character, wherever a card is shown: in the psychic's hand, as
// the played clue, and again at the reveal.
//
// TITLE FIRST, ART SECOND. Copied from anirank's TierBoard tile, and the reason
// is not taste: only an AniList import ever writes a coverImageUrl, so seed and
// hand-entered profiles carry none at all — a card built around the picture
// renders as a grey box for anyone who has not imported, on the one element the
// whole round is about. The portrait is a thumbnail above the name, never
// instead of it.
//
// Avatar rather than a bare <img> because it is the one primitive that handles
// a MISSING url and a BROKEN one — the second matters here, since a card can
// name an AniList image that has since moved, and RankBoard's raw <img> would
// draw the browser's broken-image glyph in the middle of the screen.
//
// `selectable` turns it into a real <button>. There is no drag anywhere in this
// component and no keyboard special-casing to go with one — the whole gesture
// is a tap, which is a complete keyboard story for free.
export default function ClueCard({
  card, size = 'md', selected = false, onSelect, className = '',
}) {
  if (!card) return null;

  const avatarSize = size === 'lg' ? 'lg' : 'md';
  const body = (
    <>
      <Avatar src={card.imageUrl} alt="" size={avatarSize} className="mx-auto mb-2" />
      <p
        className={`font-display font-extrabold leading-tight text-white ${
          size === 'lg' ? 'text-xl' : 'line-clamp-2 text-sm'
        }`}
      >
        {card.title}
      </p>
      {/* Empty for every show card, which is why it is guarded rather than
          styled away — see rules.normalizeCard on where that empty comes from. */}
      {card.subtitle && (
        <p className={`mt-1 truncate text-white/40 ${size === 'lg' ? 'text-base' : 'text-xs'}`}>
          {card.subtitle}
        </p>
      )}
    </>
  );

  if (!onSelect) {
    return <div className={`text-center ${className}`}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`focus-pop rounded-pop-sm border-2 p-2 text-center transition-colors ${
        selected
          ? 'border-pop-purple bg-pop-purple/15'
          : 'border-white/15 bg-surface-2 hover:border-white/40'
      } ${className}`}
    >
      {body}
    </button>
  );
}
