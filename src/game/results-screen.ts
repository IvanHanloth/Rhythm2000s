// 结算页（参照设计画布的「结算」）：评级、评语、得分和新纪录、判定计数、按键偏差分布。
// 底部三个按钮：重试（R / 空格）、选关（Esc，回到街区）、下一关（Enter / N）。
// 这是菜单类界面，入场动画用 CSS 和 requestAnimationFrame，不需要跟音频时钟对齐。

import { formatScore, HISTOGRAM_BINS, RATING_LABELS, type RoundSummary } from './round-summary.ts';
import './screens.css';
import { applyScreenTheme, screenThemeFor } from './screen-theme.ts';

export interface ResultsInfo {
  sceneId: string;
  title: string;
  summary: RoundSummary;
  /** 这一局刷新了最佳成绩 */
  newRecord: boolean;
  /** 下一关的名字；没有下一关时为 null */
  nextTitle: string | null;
}

export interface ResultsHandlers {
  onRetry: () => void;
  onSelect: () => void;
  onNext: () => void;
}

/** 刚显示时的这段时间里不接受按键，免得打完最后一下顺手按出「重试」 */
const INPUT_DELAY_MS = 700;
const COUNT_UP_MS = 900;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', `screen-button ${className}`, label);
  node.type = 'button';
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    node.blur();
    onClick();
  });
  return node;
}

export class ResultsScreen {
  readonly element = el('section', 'results-screen');
  private readonly handlers: ResultsHandlers;
  private shownAt = 0;
  private hasNext = false;
  private countUp = 0;

  constructor(handlers: ResultsHandlers) {
    this.handlers = handlers;
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-label', '结算');
    window.addEventListener('keydown', this.onKeyDown);
  }

  get visible(): boolean {
    return !this.element.hidden;
  }

  show(info: ResultsInfo): void {
    const { summary } = info;
    applyScreenTheme(this.element, screenThemeFor(info.sceneId));
    this.hasNext = info.nextTitle !== null;

    const win = el('div', 'screen-window results-window');
    win.append(el('div', 'screen-caption', `结算 — ${info.title}`));
    const body = el('div', 'screen-body results-body');

    // 左：评级 + 评语
    const left = el('div', 'results-column results-left');
    const ratingGroup = el('section', 'screen-group results-rating');
    ratingGroup.append(
      el('h2', '', '评级'),
      el('span', `rating-badge rating-${summary.rating}`, RATING_LABELS[summary.rating]),
    );
    const commentGroup = el('section', 'screen-group results-comments');
    const list = el('ul', '');
    for (const comment of summary.comments) list.append(el('li', '', comment));
    commentGroup.append(el('h2', '', '评语'), list);
    left.append(ratingGroup, commentGroup);

    // 右：得分 + 计数 + 偏差
    const right = el('div', 'results-column results-right');
    const scoreGroup = el('section', 'screen-group');
    const scoreHead = el('div', 'results-score-head');
    const scoreValue = el('span', 'results-score', formatScore(0));
    const scoreRight = el('span', 'results-score-wrap');
    if (info.newRecord) scoreRight.append(el('span', 'results-new-record', '新纪录'));
    scoreRight.append(scoreValue);
    scoreHead.append(el('h2', '', '得分'), scoreRight);
    const tiles = el('div', 'results-tiles');
    for (const level of ['perfect', 'good', 'miss'] as const) {
      const tile = el('div', 'results-tile');
      const label = level === 'perfect' ? 'Perfect!' : level === 'good' ? 'Good' : 'Miss';
      tile.append(
        el('span', `judgement-chip judgement-${level}`, label),
        el('span', 'results-count', String(summary.counts[level])),
      );
      tiles.append(tile);
    }
    scoreGroup.append(scoreHead, tiles);

    const offsetGroup = el('section', 'screen-group results-offsets');
    const offsetHead = el('div', 'results-offset-head');
    const average = summary.averageOffsetMs;
    const averageText =
      average === null
        ? '没有命中'
        : Math.abs(average) < 1
          ? '平均：正好在拍点上'
          : `平均：${average > 0 ? '晚' : '早'} ${Math.round(Math.abs(average))} 毫秒`;
    offsetHead.append(el('h2', '', '按键偏差'), el('span', '', averageText));
    const chart = el('div', 'results-histogram');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', `按键偏差分布，${averageText}`);
    const peak = Math.max(1, ...summary.histogram);
    summary.histogram.forEach((count, i) => {
      const bar = el('span', 'results-bar');
      // 中间 5 格（±50 毫秒以内）大致是 Perfect，用 Perfect 色；两边用 Good 色
      const center = Math.floor(HISTOGRAM_BINS / 2);
      bar.classList.add(
        count === 0 ? 'is-empty' : Math.abs(i - center) <= 2 ? 'is-perfect' : 'is-good',
      );
      bar.style.setProperty('--h', `${Math.max(3, (count / peak) * 100)}%`);
      bar.style.setProperty('--delay', `${i * 40}ms`);
      chart.append(bar);
    });
    const axis = el('div', 'results-axis');
    axis.append(
      el('span', '', '← 早 100 毫秒'),
      el('span', '', '拍点'),
      el('span', '', '晚 100 毫秒 →'),
    );
    offsetGroup.append(offsetHead, chart, axis);
    right.append(scoreGroup, offsetGroup);

    const columns = el('div', 'results-columns');
    columns.append(left, right);

    const footer = el('div', 'results-footer');
    const keys = this.hasNext ? 'R 重试 · Esc 选关 · Enter 下一关' : 'R 重试 · Esc 选关';
    footer.append(
      el('span', 'results-keys', keys),
      button('重试', '', this.handlers.onRetry),
      button('选关', '', this.handlers.onSelect),
    );
    if (info.nextTitle) {
      const next = button('下一关', 'is-primary', this.handlers.onNext);
      next.title = `下一关：${info.nextTitle}`;
      footer.append(next);
    }
    body.append(columns, footer);
    win.append(body);
    this.element.replaceChildren(win);
    this.element.hidden = false;
    this.shownAt = performance.now();
    this.animateScore(scoreValue, summary.score);
  }

  hide(): void {
    this.element.hidden = true;
    cancelAnimationFrame(this.countUp);
  }

  /** 得分从 0 滚到最终值，像老游戏的计分 */
  private animateScore(target: HTMLElement, score: number): void {
    cancelAnimationFrame(this.countUp);
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / COUNT_UP_MS);
      target.textContent = formatScore(score * (1 - (1 - k) ** 3));
      if (k < 1) this.countUp = requestAnimationFrame(step);
    };
    this.countUp = requestAnimationFrame(step);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.visible || event.repeat) return;
    if (performance.now() - this.shownAt < INPUT_DELAY_MS) return;
    // Esc 交给全局的「回到街区」
    if (event.code === 'KeyR' || event.code === 'Space') {
      event.preventDefault();
      this.handlers.onRetry();
    } else if (this.hasNext && (event.code === 'Enter' || event.code === 'KeyN')) {
      event.preventDefault();
      this.handlers.onNext();
    }
  };
}
