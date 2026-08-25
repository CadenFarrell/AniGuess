import { describe, it, expect } from 'vitest';
import { GAME_ICONS, ICON_TAGS, VIEWBOX } from './gameIcons';
import { games } from './registry';

// Every failure this file catches is a SILENT one. GameIcon falls back to the
// game's emoji when it finds no entry, which is the right behaviour for a game
// nobody has drawn yet and indistinguishable from a typo — so "the icon simply
// never appeared" is not something the hub can tell you about.
describe('game icons', () => {
  it('draws every registered game', () => {
    expect(Object.keys(GAME_ICONS).sort()).toEqual(games.map((g) => g.id).sort());
  });

  it('has no entry for a game that does not exist', () => {
    // The half above cannot catch this on its own: a key renamed in both places
    // at once still passes, and an orphan is how an icon goes missing while the
    // count stays right.
    const ids = new Set(games.map((g) => g.id));
    for (const id of Object.keys(GAME_ICONS)) expect(ids).toContain(id);
  });

  it('paints every shape', () => {
    // An unpainted shape is not a blank icon, it is a BLACK one: SVG's default
    // fill is black, which on the ink-on-accent palette looks almost right.
    for (const [id, shapes] of Object.entries(GAME_ICONS)) {
      expect(shapes.length, id).toBeGreaterThan(0);
      for (const shape of shapes) {
        expect(shape.className, `${id}: ${shape.tag}`).toMatch(/(^|\s)(fill|stroke)-/);
      }
    }
  });

  it('never leaves a stroke without a width', () => {
    // stroke-linecap and a colour with no strokeWidth renders a 1-unit hairline
    // that vanishes at tile size rather than erroring.
    for (const [id, shapes] of Object.entries(GAME_ICONS)) {
      for (const shape of shapes) {
        if (/(^|\s)stroke-(?!none)/.test(shape.className)) {
          expect(shape.strokeWidth, `${id}: ${shape.tag}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('only uses tags the renderer knows', () => {
    for (const [id, shapes] of Object.entries(GAME_ICONS)) {
      for (const shape of shapes) {
        expect(ICON_TAGS, `${id}: ${shape.tag}`).toContain(shape.tag);
      }
    }
  });

  it('is drawn square, so the caller can size by height alone', () => {
    const [minX, minY, w, h] = VIEWBOX.split(' ').map(Number);
    expect([minX, minY]).toEqual([0, 0]);
    expect(w).toBe(h);
  });
});
