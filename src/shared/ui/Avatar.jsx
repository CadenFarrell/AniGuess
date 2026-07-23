import { useState } from 'react';

// Character portrait with a graceful fallback. Every in-game screen had its own
// copy of "render the image, or a grey box with a ? in it", and only
// CharacterReveal bothered to handle the image actually failing to load.

const SIZES = {
  sm: 'h-12 w-12 text-xl rounded-pop-sm',
  md: 'h-16 w-16 text-2xl rounded-pop-sm',
  lg: 'h-32 w-32 text-5xl rounded-pop',
  xl: 'h-64 w-64 text-7xl rounded-pop',
};

export default function Avatar({ src, alt = '', size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);

  // Reset when the character changes — these screens swap the src without
  // remounting, so a single broken image would otherwise poison every
  // subsequent one (setState during render, React's documented pattern).
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setFailed(false);
  }

  const shape = `${SIZES[size]} flex-shrink-0 overflow-hidden border-2 border-ink ${className}`;

  if (!src || failed) {
    return (
      <div className={`${shape} grid place-items-center bg-surface-2 font-black text-white/30`}>
        ?
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${shape} object-cover`}
    />
  );
}
