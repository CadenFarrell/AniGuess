import { describe, it, expect } from 'vitest';
import {
  QUESTION_POINTS, remainingMs, isExpired, elapsedFraction, speedBonus,
  formatPoints, formatSeconds,
} from './deadline';

describe('remainingMs', () => {
  it('counts down to the deadline', () => {
    expect(remainingMs(1000, 400)).toBe(600);
  });

  it('clamps at zero rather than counting up through minus numbers', () => {
    expect(remainingMs(1000, 5000)).toBe(0);
  });

  // An untimed round leaves the deadline null; rendering NaN there would put
  // "NaNs left" on screen.
  it('reads a missing deadline as zero', () => {
    expect(remainingMs(null, 5000)).toBe(0);
    expect(remainingMs(undefined, 5000)).toBe(0);
  });
});

describe('isExpired', () => {
  it('is false before and true at the deadline', () => {
    expect(isExpired(1000, 999)).toBe(false);
    expect(isExpired(1000, 1000)).toBe(true);
    expect(isExpired(1000, 1001)).toBe(true);
  });

  // The distinction remainingMs deliberately does not make: no deadline is not
  // an expired one, or an untimed round would reveal the instant it was dealt.
  it('never expires a round with no deadline', () => {
    expect(isExpired(null, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe('elapsedFraction', () => {
  it('runs 0 to 1 across the window', () => {
    expect(elapsedFraction(100, 1000, 100)).toBe(0);
    expect(elapsedFraction(100, 1000, 600)).toBe(0.5);
    expect(elapsedFraction(100, 1000, 1100)).toBe(1);
  });

  it('clamps past the end and before the start', () => {
    expect(elapsedFraction(100, 1000, 9999)).toBe(1);
    expect(elapsedFraction(100, 1000, 0)).toBe(0);
  });

  it('returns 0 for an absent or zero-length window instead of NaN', () => {
    expect(elapsedFraction(null, 1000, 500)).toBe(0);
    expect(elapsedFraction(100, 0, 500)).toBe(0);
  });
});

describe('speedBonus', () => {
  it('is a full point for an instant answer and nothing at the buzzer', () => {
    expect(speedBonus(0, 20000)).toBe(1);
    expect(speedBonus(20000, 20000)).toBe(0);
  });

  // The exact numbers the setup screen promises, so the copy and the scorer
  // cannot drift.
  it('is linear in between', () => {
    expect(speedBonus(2100, 20000)).toBeCloseTo(0.895, 3);
    expect(speedBonus(14000, 20000)).toBeCloseTo(0.3, 3);
    expect(speedBonus(19800, 20000)).toBeCloseTo(0.01, 3);
  });

  // A submit racing the expiry transaction lands after the deadline; it must
  // cost the base point nothing.
  it('never goes negative past the deadline', () => {
    expect(speedBonus(50000, 20000)).toBe(0);
  });

  it('is zero when there is no window at all', () => {
    expect(speedBonus(1000, 0)).toBe(0);
    expect(speedBonus(1000, null)).toBe(0);
  });

  it('keeps one question under the two-point ceiling', () => {
    expect(QUESTION_POINTS + speedBonus(0, 20000)).toBe(2);
  });
});

describe('formatting', () => {
  it('leaves whole scores whole so an untimed game reads plainly', () => {
    expect(formatPoints(7)).toBe('7');
    expect(formatPoints(0)).toBe('0');
  });

  it('gives fractional scores one decimal', () => {
    expect(formatPoints(12.44)).toBe('12.4');
    expect(formatPoints(1.895)).toBe('1.9');
  });

  it('survives a missing score', () => {
    expect(formatPoints(undefined)).toBe('0');
  });

  it('formats answer times', () => {
    expect(formatSeconds(2100)).toBe('2.1s');
    expect(formatSeconds(-5)).toBe('0.0s');
  });
});
