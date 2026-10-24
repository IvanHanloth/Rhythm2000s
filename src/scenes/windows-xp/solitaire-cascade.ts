// Combo tier 3 on the XP desktop (doc/combo.md "Windows XP details"): the Solitaire win cascade. Cards leave the four
// foundation piles at the top right every other beat, fall to the bottom of the work area to land on the next beat,
// then bounce once per beat, lower each time, drifting sideways until they leave the screen, each with a fading trail.
// Positions come from the beat alone, so the same beat always draws the same picture.

import { Container, Graphics, GraphicsContext, type Text } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { WORK_AREA_HEIGHT, XP_SCREEN_WIDTH } from './components/screen.ts';
import { XP_FONTS, xpText } from './components/xp-text.ts';

/** XP Solitaire's card size (px) */
export const CARD_WIDTH = 71;
export const CARD_HEIGHT = 96;
/** A card leaves the piles every this many beats */
export const LAUNCH_EVERY_BEATS = 2;
/** How long each copy in a card's trail stays, and the stretch at the end over which it fades (beats) */
export const TRAIL_BEATS = 3;
const TRAIL_FADE_BEATS = 1;
/** Trail copies per beat */
const TRAIL_STEPS = 8;
/** First bounce height as a share of the fall, and how much of the height each bounce keeps */
const FIRST_BOUNCE = 0.75;
const BOUNCE_DECAY = 0.72;
/** Sideways speed range (px per beat) */
const MIN_SPEED = 80;
const SPEED_RANGE = 70;
/** Gap between the piles and their distance from the top right corner (px) */
const PILE_GAP = 11;
const PILE_MARGIN = 16;
const PILE_TOP = 12;

const RANKS = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'] as const;
export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
const SUITS: readonly Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export interface CascadeCard {
  index: number;
  rank: (typeof RANKS)[number];
  suit: Suit;
  /** Beat the card leaves its pile */
  launch: number;
  /** Top left at launch (px, virtual screen) */
  x0: number;
  y0: number;
  /** Sideways speed (px per beat; negative is to the left) */
  vx: number;
}

/** Bottom of the fall: the card's top when it sits on the bottom of the work area */
const FLOOR = WORK_AREA_HEIGHT - CARD_HEIGHT;

/** A repeatable 0–1 value for an integer */
function hash01(n: number): number {
  return (Math.imul(n + 1, 2654435761) >>> 0) / 2 ** 32;
}

/** The index-th card of a cascade whose first card leaves at beat `start` */
export function cascadeCard(index: number, start: number): CascadeCard {
  const pile = index % SUITS.length;
  const piles = XP_SCREEN_WIDTH - PILE_MARGIN - SUITS.length * CARD_WIDTH - 3 * PILE_GAP;
  const speed = MIN_SPEED + SPEED_RANGE * hash01(index);
  // Mostly to the left, since the piles sit at the right; now and then one heads right
  const vx = hash01(index + 1000) < 0.2 ? speed : -speed;
  return {
    index,
    rank: RANKS[Math.floor(index / SUITS.length) % RANKS.length]!,
    suit: SUITS[pile]!,
    launch: start + index * LAUNCH_EVERY_BEATS,
    x0: piles + pile * (CARD_WIDTH + PILE_GAP),
    y0: PILE_TOP,
    vx,
  };
}

/** Top left of a card at `beat` (from its launch on): it lands on the bottom on every whole beat after launch */
export function cardPosition(card: CascadeCard, beat: number): { x: number; y: number } {
  const t = Math.max(0, beat - card.launch);
  const bounce = Math.floor(t);
  const p = t - bounce;
  const x = card.x0 + card.vx * t;
  const drop = FLOOR - card.y0;
  if (bounce === 0) return { x, y: card.y0 + drop * p * p };
  const height = drop * FIRST_BOUNCE * BOUNCE_DECAY ** (bounce - 1);
  return { x, y: FLOOR - height * 4 * p * (1 - p) };
}

/** Beat the card is fully off the screen */
export function cardGoneAt(card: CascadeCard): number {
  const distance = card.vx < 0 ? card.x0 + CARD_WIDTH : XP_SCREEN_WIDTH - card.x0;
  return card.launch + distance / Math.abs(card.vx);
}

/** The cards with something on screen at `beat` (the card or its trail), for a cascade started at `start` */
export function liveCards(start: number, beat: number): CascadeCard[] {
  const cards: CascadeCard[] = [];
  const launched = Math.floor((beat - start) / LAUNCH_EVERY_BEATS);
  // No card stays longer than the slowest crossing of the whole screen plus its trail
  const longest = (XP_SCREEN_WIDTH + CARD_WIDTH) / MIN_SPEED + TRAIL_BEATS;
  const oldest = Math.max(0, Math.floor((beat - start - longest) / LAUNCH_EVERY_BEATS));
  for (let index = oldest; index <= launched; index++) {
    const card = cascadeCard(index, start);
    if (beat < cardGoneAt(card) + TRAIL_BEATS) cards.push(card);
  }
  return cards;
}

/** One card on screen: its copies, newest last, sharing one face */
interface CardView {
  card: CascadeCard;
  copies: Container[];
}

export class SolitaireCascade {
  readonly view = new Container({ label: 'solitaire-cascade' });
  private readonly faces = new Map<Suit, GraphicsContext>();
  private readonly cards = new Map<number, CardView>();

  constructor() {
    for (const suit of SUITS) this.faces.set(suit, drawFace(suit));
  }

  /** Draws the cascade started at `start` as it is at `beat` */
  update(start: number, beat: number): void {
    const live = liveCards(start, beat);
    const keep = new Set(live.map((card) => card.index));
    for (const [index, view] of this.cards) {
      if (keep.has(index)) continue;
      for (const copy of view.copies) copy.destroy({ children: true });
      this.cards.delete(index);
    }
    for (const card of live) {
      let view = this.cards.get(card.index);
      if (!view) {
        view = { card, copies: [] };
        this.cards.set(card.index, view);
      }
      this.place(view, beat);
    }
  }

  clear(): void {
    for (const view of this.cards.values()) {
      for (const copy of view.copies) copy.destroy({ children: true });
    }
    this.cards.clear();
  }

  destroy(): void {
    this.clear();
    for (const face of this.faces.values()) face.destroy();
    this.view.destroy({ children: true });
  }

  /** Lays out the card's trail: a copy every 1/TRAIL_STEPS beat since launch, the last TRAIL_BEATS of them, and the card itself */
  private place(view: CardView, beat: number): void {
    const { card } = view;
    const gone = cardGoneAt(card);
    const now = Math.min(beat, gone);
    const first = Math.max(0, Math.ceil((beat - TRAIL_BEATS - card.launch) * TRAIL_STEPS));
    const last = Math.floor((now - card.launch) * TRAIL_STEPS);
    const times: number[] = [];
    for (let step = first; step <= last; step++) times.push(card.launch + step / TRAIL_STEPS);
    if (beat < gone) times.push(beat);

    while (view.copies.length < times.length) {
      const copy = this.createCopy(card);
      view.copies.push(copy);
    }
    view.copies.forEach((copy, i) => {
      const time = times[i];
      copy.visible = time !== undefined;
      if (time === undefined) return;
      const { x, y } = cardPosition(card, time);
      copy.position.set(x, y);
      const age = beat - time;
      copy.alpha = Math.min(1, (TRAIL_BEATS - age) / TRAIL_FADE_BEATS);
    });
  }

  private createCopy(card: CascadeCard): Container {
    const copy = new Container();
    copy.addChild(new Graphics(this.faces.get(card.suit)!));
    const c = LUNA.combo.card;
    const color = card.suit === 'hearts' || card.suit === 'diamonds' ? c.red : c.black;
    const rank: Text = xpText(card.rank, {
      fontFamily: XP_FONTS.ui,
      fontSize: 13,
      fontWeight: 'bold',
      fill: color,
    });
    rank.anchor.set(0.5, 0);
    rank.position.set(9, 3);
    copy.addChild(rank);
    // Copies in time order: each new one goes on top of the older ones
    this.view.addChild(copy);
    return copy;
  }
}

/** A card face without its rank: white with a black edge, a small suit under the rank and a big one in the middle */
function drawFace(suit: Suit): GraphicsContext {
  const c = LUNA.combo.card;
  const color = suit === 'hearts' || suit === 'diamonds' ? c.red : c.black;
  const g = new GraphicsContext()
    .roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 4)
    .fill(c.face)
    .stroke({ width: 1, color: c.edge, alignment: 1 });
  drawSuit(g, suit, 9, 24, 5, color);
  drawSuit(g, suit, CARD_WIDTH / 2, CARD_HEIGHT / 2, 14, color);
  return g;
}

/** A suit symbol centred on (x, y), `size` px from the centre to its edges */
function drawSuit(
  g: GraphicsContext,
  suit: Suit,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const s = size;
  switch (suit) {
    case 'diamonds':
      g.poly([x, y - s, x + s * 0.75, y, x, y + s, x - s * 0.75, y]).fill(color);
      return;
    case 'hearts':
      g.circle(x - s * 0.48, y - s * 0.35, s * 0.52)
        .circle(x + s * 0.48, y - s * 0.35, s * 0.52)
        .poly([x - s * 0.98, y - s * 0.2, x + s * 0.98, y - s * 0.2, x, y + s])
        .fill(color);
      return;
    case 'spades':
      g.circle(x - s * 0.48, y + s * 0.15, s * 0.52)
        .circle(x + s * 0.48, y + s * 0.15, s * 0.52)
        .poly([x - s * 0.98, y, x + s * 0.98, y, x, y - s])
        .poly([x, y + s * 0.2, x + s * 0.35, y + s, x - s * 0.35, y + s])
        .fill(color);
      return;
    case 'clubs':
      g.circle(x, y - s * 0.45, s * 0.45)
        .circle(x - s * 0.5, y + s * 0.15, s * 0.45)
        .circle(x + s * 0.5, y + s * 0.15, s * 0.45)
        .poly([x, y, x + s * 0.35, y + s, x - s * 0.35, y + s])
        .fill(color);
      return;
  }
}
