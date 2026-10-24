// The XP combo effects' motion (doc/combo.md "Windows XP details"): it follows the beat and repeats exactly.

import { describe, expect, it } from 'vite-plus/test';
import { WORK_AREA_HEIGHT, XP_SCREEN_WIDTH } from './components/screen.ts';
import { BAR_COUNT, barLevel, peakLevel } from './media-visualizer.ts';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardGoneAt,
  cardPosition,
  cascadeCard,
  LAUNCH_EVERY_BEATS,
  liveCards,
  TRAIL_BEATS,
} from './solitaire-cascade.ts';

const FLOOR = WORK_AREA_HEIGHT - CARD_HEIGHT;

describe('Solitaire win cascade', () => {
  it('deals the four Kings first, then the Queens, from the four piles at the top right', () => {
    const cards = [0, 1, 2, 3, 4].map((i) => cascadeCard(i, 10));
    expect(cards.map((c) => c.rank)).toEqual(['K', 'K', 'K', 'K', 'Q']);
    expect(new Set(cards.slice(0, 4).map((c) => c.suit)).size).toBe(4);
    expect(cards.map((c) => c.launch)).toEqual([10, 12, 14, 16, 18]);
    for (const card of cards) {
      expect(card.x0).toBeGreaterThan(XP_SCREEN_WIDTH / 2);
      expect(card.x0 + CARD_WIDTH).toBeLessThanOrEqual(XP_SCREEN_WIDTH);
    }
  });

  it('lands on the bottom of the work area on every beat after launch, each bounce lower', () => {
    const card = cascadeCard(0, 0);
    expect(cardPosition(card, 0).y).toBe(card.y0);
    for (const beat of [1, 2, 3, 4]) expect(cardPosition(card, beat).y).toBeCloseTo(FLOOR);
    const peaks = [1.5, 2.5, 3.5].map((beat) => FLOOR - cardPosition(card, beat).y);
    expect(peaks[0]!).toBeGreaterThan(peaks[1]!);
    expect(peaks[1]!).toBeGreaterThan(peaks[2]!);
    // Never below the bottom
    for (let beat = 0; beat < 6; beat += 0.05) {
      expect(cardPosition(card, beat).y).toBeLessThanOrEqual(FLOOR + 1e-9);
    }
  });

  it('drifts sideways at a steady speed and is dropped once off screen with its trail gone', () => {
    const card = cascadeCard(0, 0);
    const gone = cardGoneAt(card);
    const x = cardPosition(card, gone).x;
    expect(card.vx < 0 ? x + CARD_WIDTH : x - XP_SCREEN_WIDTH).toBeCloseTo(0);
    expect(liveCards(0, gone + TRAIL_BEATS - 0.01).some((c) => c.index === 0)).toBe(true);
    expect(liveCards(0, gone + TRAIL_BEATS + 0.01).some((c) => c.index === 0)).toBe(false);
  });

  it('has no card before it starts, and one more every LAUNCH_EVERY_BEATS', () => {
    expect(liveCards(8, 7.9)).toEqual([]);
    expect(liveCards(8, 8).map((c) => c.index)).toEqual([0]);
    expect(liveCards(8, 8 + LAUNCH_EVERY_BEATS).map((c) => c.index)).toEqual([0, 1]);
  });
});

describe('Media Player visualization', () => {
  it('bars jump on the beat and fall back before the next, the same each time', () => {
    for (let bar = 0; bar < BAR_COUNT; bar++) {
      expect(barLevel(bar, 4)).toBeGreaterThan(barLevel(bar, 4.45));
      expect(barLevel(bar, 4.99)).toBeLessThan(0.05);
      expect(barLevel(bar, 4)).toBe(barLevel(bar, 4));
      expect(barLevel(bar, 4)).toBeLessThanOrEqual(1);
    }
  });

  it('a peak cap is never below its bar and falls more slowly', () => {
    for (let beat = 3; beat < 5; beat += 0.1) {
      for (let bar = 0; bar < BAR_COUNT; bar++) {
        expect(peakLevel(bar, beat)).toBeGreaterThanOrEqual(barLevel(bar, beat));
      }
    }
    expect(peakLevel(0, 4.4)).toBeGreaterThan(barLevel(0, 4.4));
  });
});
