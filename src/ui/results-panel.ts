// 结算窗口的内容（doc/results.md）：左边评级印章和评语，右边得分、三格计数和按键偏差柱状图。
// 评级印章、判定标签、得分数字是游戏自己的演出，XP 和 Mac 一样；分组框、普通文字由各场景按原版样式传进来。
// 左上角在 (0, 0)。

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
import { FONT_FAMILIES, JUDGEMENT_COLORS } from '../theme/tokens.ts';

export interface PanelTextStyle {
  size: number;
  bold?: boolean;
  color?: string;
  wrapWidth?: number;
  lineHeight?: number;
}

/** 各场景按自己的原版样式提供的部件 */
export interface ResultsKit {
  text(text: string, style: PanelTextStyle): Text;
  /** 带标题的分组框；inner 是放内容的容器，左上角在框的内边距处 */
  groupBox(title: string, width: number, height: number): { view: Container; inner: Container };
  /** 分组框内边距占掉的宽、高（左右合计、上下合计） */
  groupInset: { x: number; y: number };
  /** 说明文字的颜色 */
  muted: string;
  /** 「新纪录」小标签的底色（各系统的选中色） */
  accent: string;
}

export interface ResultsPanelOptions {
  summary: ResultSummary;
  /** 得分超过了以前的最好成绩 */
  newRecord: boolean;
  width: number;
  height: number;
  kit: ResultsKit;
}

const INK = '#1b1b1b';
const LEFT_WIDTH = 230;
const GAP = 14;
const RANK_HEIGHT = 128;
const SCORE_HEIGHT = 104;
/** 演出用的字按 3 倍分辨率栅格化，整体放大后不发虚 */
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
  width,
  height,
  kit,
}: ResultsPanelOptions): Container {
  const panel = new Container({ label: 'results-panel' });
  const rightX = LEFT_WIDTH + GAP;
  const rightWidth = width - rightX;

  // 左：评级
  const rank = kit.groupBox('评级', LEFT_WIDTH, RANK_HEIGHT);
  const stamp = rankStamp(summary.rank);
  // 字多的评级（「再试一次」）印章更宽，缩到框里放得下
  const stampRoom = LEFT_WIDTH - kit.groupInset.x - 8;
  stamp.scale.set(Math.min(1, stampRoom / stamp.width));
  stamp.position.set((LEFT_WIDTH - kit.groupInset.x) / 2, (RANK_HEIGHT - kit.groupInset.y) / 2 + 2);
  rank.inner.addChild(stamp);

  // 左：评语
  const commentsHeight = height - RANK_HEIGHT - GAP;
  const comments = kit.groupBox('评语', LEFT_WIDTH, commentsHeight);
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

  // 右：得分和三格计数
  const score = kit.groupBox('得分', rightWidth, SCORE_HEIGHT);
  score.view.x = rightX;
  const innerWidth = rightWidth - kit.groupInset.x;
  const scoreText = hudText(formatScore(summary.score), 30);
  scoreText.anchor.set(1, 0);
  scoreText.position.set(innerWidth, -6);
  score.inner.addChild(scoreText);
  if (newRecord) {
    const badge = pill(kit.text('新纪录', { size: 11, color: '#ffffff' }), kit.accent, null, 8);
    badge.position.set(innerWidth - scoreText.width - 10 - badge.width, 2);
    score.inner.addChild(badge);
  }
  const tileGap = 10;
  const tileWidth = (innerWidth - tileGap * 2) / 3;
  LEVELS.forEach(({ level, label, fill, text }, i) => {
    const tile = countTile(label, fill, text, summary.counts[level], tileWidth);
    tile.position.set(i * (tileWidth + tileGap), 34);
    score.inner.addChild(tile);
  });

  // 右：按键偏差
  const driftHeight = height - SCORE_HEIGHT - GAP;
  const drift = kit.groupBox('按键偏差', rightWidth, driftHeight);
  drift.view.position.set(rightX, SCORE_HEIGHT + GAP);
  const mean = summary.meanOffsetMs;
  const meanText = kit.text(
    mean === null
      ? '没有命中'
      : `平均：${mean >= 0 ? '晚' : '早'} ${Math.round(Math.abs(mean))} 毫秒`,
    { size: 12 },
  );
  meanText.anchor.set(1, 0);
  meanText.position.set(innerWidth, -18);
  drift.inner.addChild(meanText);

  const chartHeight = driftHeight - kit.groupInset.y - 22;
  drift.inner.addChild(histogram(summary.bins, innerWidth, chartHeight));
  const range = ((OFFSET_BINS - 1) / 2) * OFFSET_BIN_MS;
  const axis = [`← 早 ${range} 毫秒`, '拍点', `晚 ${range} 毫秒 →`].map((label, i) => {
    const text = kit.text(label, { size: 11, color: kit.muted });
    text.anchor.set(i / 2, 0);
    text.position.set((innerWidth * i) / 2, chartHeight + 5);
    return text;
  });
  drift.inner.addChild(...axis);

  panel.addChild(rank.view, comments.view, score.view, drift.view);
  return panel;
}

/** 盖上去的评级印章：粗黑边胶囊、硬投影、斜 5 度。原点在印章中心 */
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

/** 一格计数：白底圆角框，左边判定标签，右边次数 */
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

/** 胶囊形小标签，左上角在 (0, 0) */
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

/** 偏差柱状图：白底凹框，中间虚线是拍点，Perfect 范围内的格子用 Perfect 色 */
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

  // 拍点：中间一条虚线
  for (let y = 3; y < height - 3; y += 6) {
    g.moveTo(width / 2, y).lineTo(width / 2, Math.min(y + 3, height - 3));
  }
  g.stroke({ width: 1, color: '#6f6f6f' });
  view.addChild(g);
  return view;
}
