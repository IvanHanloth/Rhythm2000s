// Contents of the results window (doc/results.md): rating stamp and comments on the left; score, three tallies and the offset histogram on the right.
// The stamp, judgement chips and score digits are the game's own show and look the same on XP and Mac; group boxes and plain text come from each scene in its native style.
// Top-left at (0, 0).

import { Container, Graphics, Text } from 'pixi.js';
import type { JudgementLevel } from '../rhythm/judge.ts';
import {
  formatScore,
  OFFSET_BIN_MS,
  OFFSET_BINS,
  RANK_LABELS,
  type Rank,
  type ResultSummary,
} from '../rhythm/result-summary.ts';
import { BEAT_GUIDE_COLORS, FONT_FAMILIES, JUDGEMENT_COLORS } from '../theme/tokens.ts';

export interface PanelTextStyle {
  size: number;
  bold?: boolean;
  color?: string;
  wrapWidth?: number;
  lineHeight?: number;
}

/** Widgets each scene supplies in its native style */
export interface ResultsKit {
  text(text: string, style: PanelTextStyle): Text;
  /** Titled group box; inner is the content container, top-left at the box's padding */
  groupBox(title: string, width: number, height: number): { view: Container; inner: Container };
  /** Width and height taken by the group box padding (left + right, top + bottom) */
  groupInset: { x: number; y: number };
  /** Caption text colour */
  muted: string;
  /** Background of the "New record" chip (each OS's selection colour) */
  accent: string;
}

export interface ResultsPanelOptions {
  summary: ResultSummary;
  /** The score beat the previous best */
  newRecord: boolean;
  /** 这一局正文里开过律动组件：得分框左上角显示「Beat Guide」标签（doc/beat-guide.md） */
  assisted?: boolean;
  width: number;
  height: number;
  kit: ResultsKit;
}

const INK = '#1b1b1b';
const LEFT_WIDTH = 230;
const GAP = 14;
const RANK_HEIGHT = 128;
const SCORE_HEIGHT = 104;
/** Show text is rasterised at 3× so it stays crisp when scaled up */
const RESOLUTION = 3;

const RANK_COLORS: Record<Rank, { fill: string; text: string }> = {
  superb: { fill: JUDGEMENT_COLORS.perfect, text: JUDGEMENT_COLORS.onPerfect },
  ok: { fill: JUDGEMENT_COLORS.good, text: JUDGEMENT_COLORS.onGood },
  tryAgain: { fill: JUDGEMENT_COLORS.miss, text: JUDGEMENT_COLORS.onMiss },
};

const LEVELS: { level: JudgementLevel; label: string; fill: string; text: string }[] = [
  {
    level: 'perfect',
    label: 'Perfect!',
    fill: JUDGEMENT_COLORS.perfect,
    text: JUDGEMENT_COLORS.onPerfect,
  },
  { level: 'good', label: 'Good', fill: JUDGEMENT_COLORS.good, text: JUDGEMENT_COLORS.onGood },
  { level: 'miss', label: 'Miss', fill: JUDGEMENT_COLORS.miss, text: JUDGEMENT_COLORS.onMiss },
];

export function createResultsPanel({
  summary,
  newRecord,
  assisted = false,
  width,
  height,
  kit,
}: ResultsPanelOptions): Container {
  const panel = new Container({ label: 'results-panel' });
  const rightX = LEFT_WIDTH + GAP;
  const rightWidth = width - rightX;

  // Left: rating
  const rank = kit.groupBox('Rating', LEFT_WIDTH, RANK_HEIGHT);
  const stamp = rankStamp(summary.rank);
  // Wordy ratings ("Try again") get a wider stamp, shrunk to fit the box
  const stampRoom = LEFT_WIDTH - kit.groupInset.x - 8;
  stamp.scale.set(Math.min(1, stampRoom / stamp.width));
  stamp.position.set((LEFT_WIDTH - kit.groupInset.x) / 2, (RANK_HEIGHT - kit.groupInset.y) / 2 + 2);
  rank.inner.addChild(stamp);

  // Left: comments
  const commentsHeight = height - RANK_HEIGHT - GAP;
  const comments = kit.groupBox('Comments', LEFT_WIDTH, commentsHeight);
  comments.view.y = RANK_HEIGHT + GAP;
  let y = 0;
  for (const line of summary.comments) {
    const bullet = kit.text('•', { size: 12 });
    bullet.position.set(0, y);
    const text = kit.text(line, {
      size: 12,
      wrapWidth: LEFT_WIDTH - kit.groupInset.x - 14,
      lineHeight: 18,
    });
    text.position.set(12, y);
    comments.inner.addChild(bullet, text);
    y += Math.ceil(text.height) + 6;
  }

  // Right: score and the three tallies
  const score = kit.groupBox('Score', rightWidth, SCORE_HEIGHT);
  score.view.x = rightX;
  const innerWidth = rightWidth - kit.groupInset.x;
  const scoreText = hudText(formatScore(summary.score), 30);
  scoreText.anchor.set(1, 0);
  scoreText.position.set(innerWidth, -6);
  score.inner.addChild(scoreText);
  if (newRecord) {
    const badge = pill(kit.text('New record', { size: 11, color: '#ffffff' }), kit.accent, null, 8);
    badge.position.set(innerWidth - scoreText.width - 10 - badge.width, 2);
    score.inner.addChild(badge);
  }
  if (assisted) {
    // 用了辅助：放在得分框左上角，和右边的得分、New record 分开
    const tag = pill(
      kit.text('Beat Guide', { size: 11, color: JUDGEMENT_COLORS.onPerfect }),
      BEAT_GUIDE_COLORS.press,
      INK,
      8,
    );
    tag.position.set(0, 2);
    score.inner.addChild(tag);
  }
  const tileGap = 10;
  const tileWidth = (innerWidth - tileGap * 2) / 3;
  LEVELS.forEach(({ level, label, fill, text }, i) => {
    const tile = countTile(label, fill, text, summary.counts[level], tileWidth);
    tile.position.set(i * (tileWidth + tileGap), 34);
    score.inner.addChild(tile);
  });

  // Right: timing
  const driftHeight = height - SCORE_HEIGHT - GAP;
  const drift = kit.groupBox('Timing', rightWidth, driftHeight);
  drift.view.position.set(rightX, SCORE_HEIGHT + GAP);
  const mean = summary.meanOffsetMs;
  const meanText = kit.text(
    mean === null
      ? 'No hits'
      : `Average: ${Math.round(Math.abs(mean))} ms ${mean >= 0 ? 'late' : 'early'}`,
    { size: 12 },
  );
  meanText.anchor.set(1, 0);
  meanText.position.set(innerWidth, -18);
  drift.inner.addChild(meanText);

  const chartHeight = driftHeight - kit.groupInset.y - 22;
  drift.inner.addChild(histogram(summary.bins, innerWidth, chartHeight));
  const range = ((OFFSET_BINS - 1) / 2) * OFFSET_BIN_MS;
  const axis = [`← ${range} ms early`, 'On beat', `${range} ms late →`].map((label, i) => {
    const text = kit.text(label, { size: 11, color: kit.muted });
    text.anchor.set(i / 2, 0);
    text.position.set((innerWidth * i) / 2, chartHeight + 5);
    return text;
  });
  drift.inner.addChild(...axis);

  panel.addChild(rank.view, comments.view, score.view, drift.view);
  return panel;
}

/** The rating stamp: thick black-edged capsule, hard shadow, tilted 5°. Origin at its centre */
function rankStamp(rank: Rank): Container {
  const { fill, text } = RANK_COLORS[rank];
  const label = new Text({
    text: RANK_LABELS[rank],
    resolution: RESOLUTION,
    style: { fontFamily: FONT_FAMILIES.display, fontSize: 44, fontWeight: '800', fill: text },
  });
  const width = Math.ceil(label.width) + 52;
  const height = 66;
  const stamp = new Container({ label: `rank-${rank}` });
  const shape = new Graphics()
    .roundRect(-width / 2 + 5, -height / 2 + 5, width, height, height / 2)
    .fill(INK)
    .roundRect(-width / 2, -height / 2, width, height, height / 2)
    .fill(fill)
    .stroke({ width: 4, color: INK, alignment: 1 });
  label.anchor.set(0.5);
  label.position.set(0, 2);
  stamp.addChild(shape, label);
  stamp.rotation = (-5 * Math.PI) / 180;
  return stamp;
}

/** One tally: white rounded box, judgement chip on the left, count on the right */
function countTile(label: string, fill: string, text: string, count: number, width: number) {
  const tile = new Container({ label: `count-${label}` });
  const height = 36;
  const back = new Graphics()
    .roundRect(0, 0, width, height, 5)
    .fill('#ffffff')
    .stroke({ width: 1, color: '#b9b9b9', alignment: 1 });
  const tag = pill(
    new Text({
      text: label,
      resolution: RESOLUTION,
      style: { fontFamily: FONT_FAMILIES.display, fontSize: 13, fontWeight: '800', fill: text },
    }),
    fill,
    INK,
    8,
  );
  tag.position.set(8, (height - tag.height) / 2);
  const number = hudText(String(count), 22);
  number.anchor.set(1, 0.5);
  number.position.set(width - 10, height / 2);
  tile.addChild(back, tag, number);
  return tile;
}

/** Capsule chip, top-left at (0, 0) */
function pill(text: Text, fill: string, border: string | null, paddingX: number): Container {
  const view = new Container();
  const width = Math.ceil(text.width) + paddingX * 2;
  const height = Math.ceil(text.height) + 2;
  const shape = new Graphics().roundRect(0, 0, width, height, height / 2).fill(fill);
  if (border) shape.stroke({ width: 2, color: border, alignment: 1 });
  text.anchor.set(0.5);
  text.position.set(width / 2, height / 2);
  view.addChild(shape, text);
  return view;
}

function hudText(text: string, size: number): Text {
  return new Text({
    text,
    resolution: RESOLUTION,
    style: { fontFamily: FONT_FAMILIES.pixel, fontSize: size, fontWeight: '500', fill: INK },
  });
}

/** Offset histogram: white sunken box, a dashed line on the beat, bins inside the Perfect range in the Perfect colour */
function histogram(bins: readonly number[], width: number, height: number): Container {
  const view = new Container({ label: 'histogram' });
  const g = new Graphics()
    .roundRect(0, 0, width, height, 4)
    .fill('#ffffff')
    .stroke({ width: 1, color: '#9a9a9a', alignment: 1 })
    .rect(0, height - 1, width, 1)
    .fill('#6f6f6f');

  const padding = 6;
  const gap = 4;
  const barWidth = (width - padding * 2 - gap * (bins.length - 1)) / bins.length;
  const max = Math.max(1, ...bins);
  const maxBar = height - 10;
  const half = (bins.length - 1) / 2;
  bins.forEach((count, i) => {
    const x = padding + i * (barWidth + gap);
    const barHeight = count === 0 ? 2 : Math.max(4, (count / max) * maxBar);
    const inPerfect = Math.abs(i - half) * OFFSET_BIN_MS <= 40;
    const color =
      count === 0 ? '#c8c8c8' : inPerfect ? JUDGEMENT_COLORS.perfect : JUDGEMENT_COLORS.good;
    g.roundRect(x, height - 1 - barHeight, barWidth, barHeight, Math.min(3, barWidth / 2)).fill(
      color,
    );
  });

  // On the beat: a dashed line down the middle
  for (let y = 3; y < height - 3; y += 6) {
    g.moveTo(width / 2, y).lineTo(width / 2, Math.min(y + 3, height - 3));
  }
  g.stroke({ width: 1, color: '#6f6f6f' });
  view.addChild(g);
  return view;
}
