// 关卡开场页：进关卡时先显示「场景 · 第几关」、关卡名、速度、最佳成绩和玩法说明（参照设计画布的「关卡载入」）。
// 第一下空格或点击就收起；这一下照常传给场景，所以按下去就直接开始。

import './screens.css';
import { applyScreenTheme, screenThemeFor } from './screen-theme.ts';

export interface LevelIntroInfo {
  sceneId: string;
  /** 例如「Windows XP 桌面 · 第 2 关」 */
  kicker: string;
  title: string;
  bpm: number;
  /** 这一关用到的部件，例如「错误消息框、警告消息框」 */
  actions: string;
  /** 最佳成绩的一行文字；还没打过时为 null */
  record: string | null;
}

/** 每个场景的玩法说明 */
const HOW_TO: Record<string, string> = {
  'windows-xp':
    '电脑会先按节奏演示一遍：弹出消息框、冒出托盘气泡、打开程序窗口、掉下文件……轮到您时，请按同样的节奏逐个处理。',
  'mac-2000':
    '提示框、Dock 图标、新邮件和文稿窗口会先按节奏出现。轮到您时，请按同样的节奏逐个处理。',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class LevelIntro {
  readonly element = el('section', 'level-intro');

  constructor() {
    this.element.hidden = true;
    this.element.setAttribute('aria-live', 'polite');
    // 收起：第一下空格或点击。监听在捕获阶段，不拦截，事件照常交给场景开始这一局
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.code === 'Space' || event.code === 'Enter') this.hide();
      },
      true,
    );
    window.addEventListener('pointerdown', () => this.hide(), true);
  }

  show(info: LevelIntroInfo): void {
    applyScreenTheme(this.element, screenThemeFor(info.sceneId));
    const header = el('header', 'level-intro-header');
    header.append(
      el('span', 'level-intro-kicker', info.kicker),
      el('h1', 'level-intro-title', info.title),
    );

    const card = el('div', 'screen-window level-intro-card');
    const caption = el('div', 'screen-caption', `${info.title}.lvl`);
    const body = el('div', 'screen-body');
    const facts = el('dl', 'level-intro-facts');
    const rows: [string, string][] = [
      ['速度', `${info.bpm} BPM`],
      ['部件', info.actions],
      ['最佳', info.record ?? '还没有记录'],
    ];
    for (const [term, value] of rows) facts.append(el('dt', '', term), el('dd', '', value));
    body.append(facts);
    card.append(caption, body);

    const tip = el('aside', 'level-intro-tip');
    const turns = el('p', 'level-intro-turns');
    turns.append(
      el('span', 'turn-chip turn-call', 'Follow me'),
      ' 先看　→　',
      el('span', 'turn-chip turn-response', 'Your turn'),
      ' 跟着按',
    );
    tip.append(
      el('strong', '', '玩法说明'),
      el('p', '', HOW_TO[info.sceneId] ?? ''),
      turns,
      el('p', 'level-intro-keys', '按空格键或点击画面开始 · Esc 回到街区'),
    );

    this.element.replaceChildren(header, card, tip);
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
