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
  private readonly lockHint = el('div', 'hub-lock-hint', 'Click to look around');
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
    logo.append(el('span', 'hub-logo-word', 'Rhythm'), el('span', 'hub-logo-badge', '2000s'));
    const menu = el('nav', 'hub-menu');
    menu.setAttribute('aria-label', 'Main menu');
    menu.append(
      button('Start', 'hub-button hub-button-primary', handlers.onStart),
      button('Controls', 'hub-button', () => this.toggleHelp()),
      button('Credits', 'hub-button', () => this.toggleCredits()),
    );
    const latency = el('a', 'hub-button', 'Latency test');
    latency.href = `${import.meta.env.BASE_URL}prototypes/latency/`;
    menu.append(latency);
    this.title.append(
      logo,
      el('p', 'hub-tagline', 'Pop-ups, close boxes, new mail — all on the beat.'),
      menu,
      el('p', 'hub-press', 'Press Enter to start'),
    );

    this.buildCredits();
    const track = el('span', 'hub-loading-track');
    track.append(this.loadingBar);
    this.loading.append(this.loadingText, track);
    this.loading.hidden = true;

    this.help.append(el('div', 'hub-help-title', 'Controls'));
    const keys: [string, string][] = [
      ['W A S D', 'Walk'],
      ['Shift', 'Run'],
      ['Mouse', 'Look around (click the screen first)'],
      ['E', 'Examine things; sit down at a computer'],
      ['Esc', 'Pause; stand up when seated; leave a level for the café'],
    ];
    const list = el('dl', 'hub-keys');
    for (const [key, what] of keys) list.append(el('dt', '', key), el('dd', '', what));
    this.help.append(list);
    this.help.hidden = true;

    this.objective.textContent =
      'Go into the CYBERSPACE CAFÉ and sit at a PC with a yellow marker over it';
    this.hud.append(this.objective, this.place, this.prompt, this.lockHint);

    this.dialog.append(
      this.dialogName,
      this.dialogText,
      el('div', 'hub-dialog-next', 'E  Continue'),
    );

    this.cardPlay = button('Play', 'hub-button hub-button-primary', handlers.onPlayLevel);
    const cardActions = el('div', 'hub-card-actions');
    cardActions.append(this.cardPlay, button('Stand up', 'hub-button', handlers.onStandUp));
    const titlebar = el('div', 'hub-card-titlebar');
    titlebar.append(this.cardTitle);
    this.card.append(titlebar, this.cardBody, cardActions);

    this.pause.append(
      el('div', 'hub-pause-title', 'Paused'),
      button('Resume', 'hub-button hub-button-primary', handlers.onResume),
      button('Quit to title', 'hub-button', handlers.onQuitToTitle),
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
    best.append(el('b', '', 'Best\u2003'), record ?? 'No record yet');
    lines.push(best);
    const keys = el('p', 'hub-card-keys');
    keys.append(
      ...(level.playable ? [el('kbd', '', 'E'), ' Play\u2003'] : []),
      el('kbd', '', 'Esc'),
      ' Stand up',
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
    this.loadingText.textContent = `Loading the high street… ${percent}%`;
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
        'DeepSeek whale girl 3D model: Manny / ningfangtianwai-pixel, ',
        link('AI Girls 3D', 'https://github.com/ningfangtianwai-pixel/ai-girls-3d'),
        ', ',
        link('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'),
        '. Changes: mesh and textures compressed. The DeepSeek whale girl is fan art and not affiliated with DeepSeek.',
      ],
      [
        'High street textures and prop models: ',
        link('Poly Haven', 'https://polyhaven.com/'),
        ' (CC0).',
      ],
      [
        'Windows XP and Mac OS interface artwork and sounds are © Microsoft and Apple. This project is for academic use only.',
      ],
      ['Sources for all other assets are listed in assets/README.md in the repository.'],
    ];
    const list = el('ul', 'hub-credits-list');
    for (const parts of items) {
      const li = el('li', '');
      li.append(...parts);
      list.append(li);
    }
    this.credits.append(
      el('div', 'hub-help-title', 'Credits'),
      el(
        'p',
        '',
        'Rhythm 2000s — a Rhythm Heaven-style rhythm game about everyday computing in the early 2000s.',
      ),
      list,
      button('Close', 'hub-button', () => this.toggleCredits()),
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
