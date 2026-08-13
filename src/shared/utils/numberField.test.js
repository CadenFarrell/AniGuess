import { describe, it, expect } from 'vitest';
import {
  parseDraft,
  clampValue,
  commitDraft,
  stepValue,
  isDraftOutOfRange,
  sanitizeDraft,
} from './numberField';

describe('parseDraft', () => {
  it('reads a whole number', () => {
    expect(parseDraft('7')).toBe(7);
    expect(parseDraft(' 12 ')).toBe(12);
    expect(parseDraft('-5')).toBe(-5);
  });

  it('keeps leading zeros out of the parsed value', () => {
    expect(parseDraft('007')).toBe(7);
  });

  it('returns null for an empty draft rather than a number', () => {
    // The whole reason this module exists: `parseInt('') || 1` was 1.
    expect(parseDraft('')).toBeNull();
    expect(parseDraft('   ')).toBeNull();
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft(undefined)).toBeNull();
  });

  it('rejects partial numbers instead of salvaging them like parseInt', () => {
    expect(parseDraft('12abc')).toBeNull();
    expect(parseDraft('1.5')).toBeNull();
    expect(parseDraft('-')).toBeNull();
    expect(parseDraft('1e3')).toBeNull();
  });
});

describe('clampValue', () => {
  it('holds both ends', () => {
    expect(clampValue(25, { min: 1, max: 10 })).toBe(10);
    expect(clampValue(-5, { min: 0, max: 99 })).toBe(0);
    expect(clampValue(4, { min: 1, max: 10 })).toBe(4);
  });

  it('treats a missing bound as unbounded', () => {
    expect(clampValue(9999, { min: 0 })).toBe(9999);
    expect(clampValue(-9999, { max: 10 })).toBe(-9999);
  });
});

describe('commitDraft', () => {
  it('clamps a typed value that is out of range', () => {
    expect(commitDraft('25', { min: 1, max: 10, fallback: 3 })).toBe(10);
    expect(commitDraft('-5', { min: 0, max: 99, fallback: 3 })).toBe(0);
  });

  it('returns an in-range value untouched', () => {
    expect(commitDraft('3', { min: 1, max: 10, fallback: 10 })).toBe(3);
    expect(commitDraft('007', { min: 1, max: 10, fallback: 1 })).toBe(7);
  });

  it('falls back to the value editing started from, not to min', () => {
    // Clearing the box and tabbing away is a cancelled edit. Returning `min`
    // here would make backspace a shortcut to the floor.
    expect(commitDraft('', { min: 1, max: 10, fallback: 8 })).toBe(8);
    expect(commitDraft('abc', { min: 1, max: 10, fallback: 8 })).toBe(8);
  });

  it('clamps the fallback too, so a stale saved pref cannot survive a commit', () => {
    expect(commitDraft('', { min: 1, max: 10, fallback: 9999 })).toBe(10);
  });
});

describe('stepValue', () => {
  it('steps in both directions', () => {
    expect(stepValue(3, { min: 1, max: 10, dir: 1 })).toBe(4);
    expect(stepValue(3, { min: 1, max: 10, dir: -1 })).toBe(2);
  });

  it('stops at each bound instead of running past it', () => {
    expect(stepValue(10, { min: 1, max: 10, dir: 1 })).toBe(10);
    expect(stepValue(1, { min: 1, max: 10, dir: -1 })).toBe(1);
  });

  it('honours a step larger than one and still lands on the bound', () => {
    expect(stepValue(60, { min: 30, max: 300, step: 15, dir: 1 })).toBe(75);
    expect(stepValue(295, { min: 30, max: 300, step: 15, dir: 1 })).toBe(300);
  });

  it('walks an already-out-of-range value back inside', () => {
    // A pref saved before these bounds existed. Pressing − should move toward
    // the range, not clamp to it on the first press and lose the direction.
    expect(stepValue(9999, { min: 1, max: 10, dir: -1 })).toBe(10);
  });
});

describe('isDraftOutOfRange', () => {
  it('flags a parsed value outside the bounds', () => {
    expect(isDraftOutOfRange('25', { min: 1, max: 10 })).toBe(true);
    expect(isDraftOutOfRange('-1', { min: 0, max: 99 })).toBe(true);
  });

  it('does not flag an empty draft', () => {
    // Empty is the normal transient between clearing and retyping; tinting it
    // red would flash an error on every edit.
    expect(isDraftOutOfRange('', { min: 1, max: 10 })).toBe(false);
  });

  it('does not flag an in-range value', () => {
    expect(isDraftOutOfRange('5', { min: 1, max: 10 })).toBe(false);
    expect(isDraftOutOfRange('10', { min: 1, max: 10 })).toBe(false);
  });
});

describe('sanitizeDraft', () => {
  it('drops everything that is not a digit', () => {
    expect(sanitizeDraft('1a2b3', { min: 0 })).toBe('123');
    expect(sanitizeDraft('1.5', { min: 0 })).toBe('15');
    expect(sanitizeDraft('', { min: 0 })).toBe('');
  });

  it('keeps a leading minus only when the range allows one', () => {
    expect(sanitizeDraft('-5', { min: -10 })).toBe('-5');
    expect(sanitizeDraft('-5', { min: 0 })).toBe('5');
    expect(sanitizeDraft('-', { min: -10 })).toBe('-');
  });

  it('leaves leading zeros alone while typing', () => {
    // Rewriting the draft mid-edit moves the caret; commitDraft normalizes.
    expect(sanitizeDraft('007', { min: 0 })).toBe('007');
  });
});
