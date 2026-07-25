import { describe, it, expect } from 'vitest';
import { rankSuggestions } from './guessSuggest';

const c = (name, series) => ({ name, series, imageUrl: '' });

describe('rankSuggestions', () => {
  it('shows a character listed under two shows once', () => {
    const results = rankSuggestions([
      c('Eren Yeager', 'Attack on Titan'),
      c('Eren Yeager', 'Attack on Titan: Junior High'),
      c('Eren Yeager', 'Attack on Titan: The Final Season'),
    ], 'eren');

    expect(results).toHaveLength(1);
    expect(results[0].series).toBe('Attack on Titan');
  });

  it('still finds a folded character by a second series title', () => {
    // The regression the seriesList collection guards against: "shippuden"
    // only appears on the entry that was deduped away.
    const results = rankSuggestions([
      c('Naruto Uzumaki', 'Naruto'),
      c('Naruto Uzumaki', 'Naruto Shippuden'),
    ], 'shippuden');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Naruto Uzumaki');
  });

  it('folds diacritic variants of the same name into one row', () => {
    const results = rankSuggestions([
      c('Jūjutsu Gojo', 'Season 1'),
      c('Jujutsu Gojo', 'Season 2'),
    ], 'gojo');

    expect(results).toHaveLength(1);
  });

  it('keeps genuinely different names apart', () => {
    const results = rankSuggestions([
      c('Eren Yeager', 'Attack on Titan'),
      c('Erwin Smith', 'Attack on Titan'),
    ], 'er');

    expect(results).toHaveLength(2);
  });

  it('ranks an exact name above a substring match', () => {
    const results = rankSuggestions([
      c('Levi Ackerman', 'Attack on Titan'),
      c('Levi', 'Attack on Titan'),
    ], 'levi');

    expect(results[0].name).toBe('Levi');
  });

  it('puts every name match ahead of every series match', () => {
    const results = rankSuggestions([
      c('Someone Else', 'Naruto'),
      c('Naruto Uzumaki', 'Boruto'),
    ], 'naruto');

    expect(results[0].name).toBe('Naruto Uzumaki');
  });

  it('matches a diacritic series title typed plainly', () => {
    const results = rankSuggestions([c('Yuji', 'Jūjutsu Kaisen')], 'jujutsu');

    expect(results).toHaveLength(1);
  });

  it('respects the limit', () => {
    const chars = Array.from({ length: 20 }, (_, i) => c(`Char ${i}`, 'Show'));

    expect(rankSuggestions(chars, 'char', 5)).toHaveLength(5);
  });

  it('returns nothing for an empty query or no match', () => {
    const chars = [c('Eren Yeager', 'Attack on Titan')];

    expect(rankSuggestions(chars, '')).toEqual([]);
    expect(rankSuggestions(chars, '   ')).toEqual([]);
    expect(rankSuggestions(chars, 'zzzz')).toEqual([]);
  });
});
