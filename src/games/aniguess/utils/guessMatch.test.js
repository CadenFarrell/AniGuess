import { describe, it, expect } from 'vitest';
import { isCorrectGuess } from './guessMatch';

const spike = { name: 'Spike Spiegel' };
const withNicks = { name: 'Edward Elric', nicknames: ['Fullmetal', 'Ed'] };

describe('isCorrectGuess', () => {
  it('accepts the exact name, ignoring case and padding', () => {
    expect(isCorrectGuess(spike, 'Spike Spiegel')).toBe(true);
    expect(isCorrectGuess(spike, '  spike spiegel  ')).toBe(true);
    expect(isCorrectGuess(spike, 'SPIKE SPIEGEL')).toBe(true);
  });

  it('accepts a partial name, because players say the first name out loud', () => {
    expect(isCorrectGuess(spike, 'spike')).toBe(true);
    expect(isCorrectGuess(spike, 'spiegel')).toBe(true);
  });

  it('requires three characters before a fragment counts, so single letters cannot fish', () => {
    expect(isCorrectGuess(spike, 'sp')).toBe(false);
    expect(isCorrectGuess(spike, 'spi')).toBe(true);
  });

  it('rejects an empty or whitespace-only guess', () => {
    expect(isCorrectGuess(spike, '')).toBe(false);
    expect(isCorrectGuess(spike, '   ')).toBe(false);
  });

  it('rejects a different character', () => {
    expect(isCorrectGuess(spike, 'faye valentine')).toBe(false);
  });

  it('accepts a nickname the same way it accepts the name', () => {
    expect(isCorrectGuess(withNicks, 'Fullmetal')).toBe(true);
    expect(isCorrectGuess(withNicks, 'fullmet')).toBe(true);
  });

  it('applies the three-character floor to nicknames too', () => {
    expect(isCorrectGuess(withNicks, 'Ed')).toBe(true); // exact match, floor does not apply
    expect(isCorrectGuess({ name: 'Someone', nicknames: ['Edward'] }, 'ed')).toBe(false);
  });

  it('handles a character with no nicknames at all', () => {
    expect(isCorrectGuess(spike, 'nope')).toBe(false);
    expect(isCorrectGuess({ name: 'Spike', nicknames: [] }, 'nope')).toBe(false);
  });
});
