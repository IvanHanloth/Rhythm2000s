// 大厅画面上叠的 DOM 界面：开始界面、操作提示、对话框、选关卡片、暂停菜单、黑场。
// 这些是菜单类界面，可以用 CSS 过渡（设计系统「动效」一节）；颜色从 src/theme 注入成 CSS 变量。

import './hub.css';
import { cssFontFamily, FONT_FAMILIES, JUDGEMENT_COLORS, THEMES } from '../theme/tokens.ts';

/** 坐下后卡片上显示的关卡信息（一关就是一首谱面） */
export interface LevelInfo {
  /** 关卡 id（谱面 id） */
  id: string;
  sceneId: string;
  /** 关卡名（曲名），卡片的标题 */
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
    '--hub-font-ui': cssFontFamily(FONT_FAMILIES.ui),
    '--hub-font-display': cssFontFamily(FONT_FAMILIES.display),
    '--hub-font-pixel': cssFontFamily(FONT_FAMILIES.pixel),
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
  private readonly credits = el('section', 'hub-credits');
  private readonly loading = el('div', 'hub-loading');
  private readonly loadingBar = el('span', 'hub-loading-fill');
  private readonly loadingText = el('span', 'hub-loading-text');
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
      button('制作人员', 'hub-button', () => this.toggleCredits()),
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

    this.buildCredits();
    const track = el('span', 'hub-loading-track');
    track.append(this.loadingBar);
    this.loading.append(this.loadingText, track);
    this.loading.hidden = true;

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

    this.objective.textContent = '去 CYBERSPACE CAFÉ 网吧，找一台头顶有黄色标记的电脑坐下';
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
      this.credits,
      this.loading,
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
    if (!visible) {
      this.help.hidden = true;
      this.credits.hidden = true;
    }
  }

  toggleHelp(): void {
    this.help.hidden = !this.help.hidden;
    if (!this.help.hidden) this.credits.hidden = true;
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

  /** 坐下后的关卡卡片；record 是最佳成绩的一行文字，还没打过时为 null */
  showCard(level: LevelInfo | null, record: string | null = null): void {
    this.card.hidden = level === null;
    if (!level) return;
    this.cardTitle.textContent = level.label;
    const lines = level.details.map((line) => el('p', '', line));
    const best = el('p', 'hub-card-record');
    best.append(el('b', '', '最佳　'), record ?? '还没有记录');
    lines.push(best);
    const keys = el('p', 'hub-card-keys');
    keys.append(
      ...(level.playable ? [el('kbd', '', 'E'), ' 开始　'] : []),
      el('kbd', '', 'Esc'),
      ' 起身',
    );
    this.cardBody.replaceChildren(...lines, keys);
    this.cardPlay.disabled = !level.playable;
  }

  /** 加载进度（0～1）；null 时收起 */
  setLoading(progress: number | null): void {
    this.loading.hidden = progress === null;
    if (progress === null) return;
    const percent = Math.round(progress * 100);
    this.loadingBar.style.width = `${percent}%`;
    this.loadingText.textContent = `正在载入街区…… ${percent}%`;
  }

  toggleCredits(): void {
    this.credits.hidden = !this.credits.hidden;
    if (!this.credits.hidden) this.help.hidden = true;
  }

  /**
   * 制作人员与素材署名。鲸鱼娘模型是 CC BY 4.0，必须在游戏里署名并注明修改（assets/README.md）。
   */
  private buildCredits(): void {
    const link = (text: string, href: string) => {
      const a = el('a', '', text);
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      return a;
    };
    const items: (string | HTMLElement)[][] = [
      [
        '鲸鱼娘 3D 模型：Manny / ningfangtianwai-pixel，',
        link('AI Girls 3D', 'https://github.com/ningfangtianwai-pixel/ai-girls-3d'),
        '，',
        link('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'),
        '。修改：压缩了网格和贴图。DeepSeek 鲸鱼娘是同人形象，与官方无关。',
      ],
      ['街区的贴图和道具模型：', link('Poly Haven', 'https://polyhaven.com/'), '（CC0）。'],
      ['Windows XP、Mac OS 的界面素材和音效版权归 Microsoft、Apple 所有，本项目仅作学术用途。'],
      ['其余素材的来源见仓库里的 assets/README.md。'],
    ];
    const list = el('ul', 'hub-credits-list');
    for (const parts of items) {
      const li = el('li', '');
      li.append(...parts);
      list.append(li);
    }
    this.credits.append(
      el('div', 'hub-help-title', '制作人员'),
      el('p', '', 'rhythm2000s —— 一款《节奏天国》式的节奏游戏，题材是 21 世纪初的电脑日常。'),
      list,
      button('关闭', 'hub-button', () => this.toggleCredits()),
    );
    this.credits.hidden = true;
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
