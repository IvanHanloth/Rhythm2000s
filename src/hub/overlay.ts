// 大厅画面上叠的 DOM 界面：开始界面、操作提示、对话框、选关卡片、暂停菜单、黑场。
// 这些是菜单类界面，可以用 CSS 过渡（设计系统「动效」一节）；颜色从 src/theme 注入成 CSS 变量。

import './hub.css';
import { FONT_FAMILIES, JUDGEMENT_COLORS, THEMES } from '../theme/tokens.ts';

/** 坐下后卡片上显示的关卡信息 */
export interface LevelInfo {
  sceneId: string;
  /** 场景名，例如「Windows XP 桌面」 */
  label: string;
  /** 曲名、速度等，一行一条 */
  details: string[];
  /** 场景还没有可玩的内容时为 false：卡片照常显示，但不能开始 */
  playable: boolean;
}

export interface OverlayHandlers {
  onStart: () => void;
  onResume: () => void;
  onQuitToTitle: () => void;
  onPlayLevel: () => void;
  onStandUp: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    node.blur();
    onClick();
  });
  return node;
}

function setThemeVariables(root: HTMLElement): void {
  const xp = THEMES.xp;
  const vars: Record<string, string> = {
    '--hub-font-ui': FONT_FAMILIES.ui.join(', '),
    '--hub-font-display': FONT_FAMILIES.display.join(', '),
    '--hub-font-pixel': FONT_FAMILIES.pixel.join(', '),
    '--hub-titlebar': xp.titlebar,
    '--hub-titlebar-hi': xp.titlebarHi,
    '--hub-on-titlebar': xp.onTitlebar,
    '--hub-surface': xp.surface,
    '--hub-surface-raised': xp.surfaceRaised,
    '--hub-ink': xp.ink,
    '--hub-ink-muted': xp.inkMuted,
    '--hub-line': xp.line,
    '--hub-line-soft': xp.lineSoft,
    '--hub-accent': xp.accent,
    '--hub-on-accent': xp.onAccent,
    '--hub-focus': xp.focus,
    '--hub-ctl-close': xp.ctlClose,
    '--hub-perfect': JUDGEMENT_COLORS.perfect,
    '--hub-on-perfect': JUDGEMENT_COLORS.onPerfect,
    '--hub-highlight': xp.highlight,
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}

export class HubOverlay {
  readonly element = el('div', 'hub-ui');
  private readonly title = el('section', 'hub-title');
  private readonly help = el('div', 'hub-help');
  private readonly hud = el('div', 'hub-hud');
  private readonly objective = el('div', 'hub-objective');
  private readonly place = el('div', 'hub-place');
  private readonly prompt = el('div', 'hub-prompt');
  private readonly lockHint = el('div', 'hub-lock-hint', '点击画面转动视角');
  private readonly dialog = el('div', 'hub-dialog');
  private readonly dialogName = el('div', 'hub-dialog-name');
  private readonly dialogText = el('div', 'hub-dialog-text');
  private readonly card = el('section', 'hub-card');
  private readonly cardTitle = el('div', 'hub-card-title');
  private readonly cardBody = el('div', 'hub-card-body');
  private readonly cardPlay: HTMLButtonElement;
  private readonly pause = el('section', 'hub-pause');
  private readonly fade = el('div', 'hub-fade');
  private placeTimer = 0;

  constructor(handlers: OverlayHandlers) {
    setThemeVariables(this.element);

    // 开始界面：标题字 + 菜单
    const logo = el('h1', 'hub-logo');
    logo.append(el('span', 'hub-logo-word', 'rhythm'), el('span', 'hub-logo-badge', '2000s'));
    const menu = el('nav', 'hub-menu');
    menu.setAttribute('aria-label', '主菜单');
    menu.append(
      button('开始游戏', 'hub-button hub-button-primary', handlers.onStart),
      button('操作说明', 'hub-button', () => this.toggleHelp()),
    );
    const latency = el('a', 'hub-button', '延迟测试');
    latency.href = `${import.meta.env.BASE_URL}prototypes/latency/`;
    menu.append(latency);
    this.title.append(
      logo,
      el('p', 'hub-tagline', '弹窗、关窗、收邮件——跟着节拍来。'),
      menu,
      el('p', 'hub-press', '按 Enter 开始'),
    );

    this.help.append(el('div', 'hub-help-title', '操作说明'));
    const keys: [string, string][] = [
      ['W A S D', '移动'],
      ['Shift', '跑'],
      ['鼠标', '转动视角（先点击画面）'],
      ['E', '进门后和人说话、坐到电脑前'],
      ['Esc', '暂停；坐着时起身；关卡里回到网吧'],
    ];
    const list = el('dl', 'hub-keys');
    for (const [key, what] of keys) list.append(el('dt', '', key), el('dd', '', what));
    this.help.append(list);
    this.help.hidden = true;

    this.objective.textContent = '去「TURBO NET CAFE」网吧找一台空着的电脑坐下';
    this.hud.append(this.objective, this.place, this.prompt, this.lockHint);

    this.dialog.append(this.dialogName, this.dialogText, el('div', 'hub-dialog-next', 'E 继续'));

    this.cardPlay = button('开始', 'hub-button hub-button-primary', handlers.onPlayLevel);
    const cardActions = el('div', 'hub-card-actions');
    cardActions.append(this.cardPlay, button('起身', 'hub-button', handlers.onStandUp));
    const titlebar = el('div', 'hub-card-titlebar');
    titlebar.append(this.cardTitle);
    this.card.append(titlebar, this.cardBody, cardActions);

    this.pause.append(
      el('div', 'hub-pause-title', '已暂停'),
      button('继续', 'hub-button hub-button-primary', handlers.onResume),
      button('回到标题', 'hub-button', handlers.onQuitToTitle),
    );

    this.element.append(
      this.title,
      this.help,
      this.hud,
      this.dialog,
      this.card,
      this.pause,
      this.fade,
    );
    this.showTitle(false);
    this.showHud(false);
    this.showDialog(null);
    this.showCard(null);
    this.showPause(false);
  }

  showTitle(visible: boolean): void {
    this.title.hidden = !visible;
    if (!visible) this.help.hidden = true;
  }

  toggleHelp(): void {
    this.help.hidden = !this.help.hidden;
  }

  showHud(visible: boolean): void {
    this.hud.hidden = !visible;
  }

  setPrompt(text: string | null): void {
    this.prompt.hidden = text === null;
    if (text !== null) {
      this.prompt.replaceChildren(el('kbd', '', 'E'), ` ${text}`);
    }
  }

  setLockHint(visible: boolean): void {
    this.lockHint.hidden = !visible;
  }

  /** 进店时在屏幕上方显示店名，几秒后自动消失 */
  announcePlace(name: string): void {
    this.place.textContent = name;
    this.place.classList.add('is-visible');
    window.clearTimeout(this.placeTimer);
    this.placeTimer = window.setTimeout(() => this.place.classList.remove('is-visible'), 2200);
  }

  showDialog(line: { name: string; text: string } | null): void {
    this.dialog.hidden = line === null;
    if (line) {
      this.dialogName.textContent = line.name;
      this.dialogText.textContent = line.text;
    }
  }

  showCard(level: LevelInfo | null): void {
    this.card.hidden = level === null;
    if (!level) return;
    this.cardTitle.textContent = level.label;
    const lines = level.details.map((line) => el('p', '', line));
    const keys = el('p', 'hub-card-keys');
    keys.append(
      ...(level.playable ? [el('kbd', '', 'E'), ' 开始　'] : []),
      el('kbd', '', 'Esc'),
      ' 起身',
    );
    this.cardBody.replaceChildren(...lines, keys);
    this.cardPlay.disabled = !level.playable;
  }

  showPause(visible: boolean): void {
    this.pause.hidden = !visible;
  }

  /** 黑场：opacity 0 → 1 用 durationMs 毫秒 */
  setFade(opaque: boolean, durationMs: number): void {
    this.fade.style.transitionDuration = `${durationMs}ms`;
    this.fade.classList.toggle('is-opaque', opaque);
  }
}
