// DOM layers over the hub: title screen, control hints, dialogue, level card, pause menu, fade to black.
// These are menus, so CSS transitions are fine (design system "Motion"); colours come from src/theme as CSS variables.

import type { SceneId } from '@/scenes/catalog.ts';
import './hub.css';
import { cssFontFamily, FONT_FAMILIES, JUDGEMENT_COLORS, THEMES } from '@/theme/tokens.ts';

/** What the card shows once seated at an entry computer: a scene's play computer or its chart editor */
export interface LevelInfo {
  /** Computer id, passed to onPlay */
  id: string;
  sceneId: SceneId;
  /** A play computer shows a best-score line; an editor has none */
  role: 'levels' | 'editor';
  /** The card's button and key hint, e.g. "Play" */
  action: string;
  /** Level name (song title), the card's heading */
  label: string;
  /** Title, tempo and so on, one per line */
  details: string[];
  /** False while the scene has nothing playable: the card shows but cannot start */
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

    // Title screen: logo and menu
    const logo = el('h1', 'hub-logo');
    logo.append(el('span', 'hub-logo-word', 'Rhythm'), el('span', 'hub-logo-badge', '2000s'));
    const menu = el('nav', 'hub-menu');
    menu.setAttribute('aria-label', 'Main menu');
    menu.append(
      button('Start', 'hub-button hub-button-primary', handlers.onStart),
      button('Credits', 'hub-button', () => this.toggleCredits()),
    );
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
      this.credits.hidden = true;
    }
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

  /** Shows the shop name at the top on entering, fading after a few seconds */
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

  /** Level card once seated; record is the best score line, null if never played */
  showCard(level: LevelInfo | null, record: string | null = null): void {
    this.card.hidden = level === null;
    if (!level) return;
    this.cardTitle.textContent = level.label;
    const lines = level.details.map((line) => el('p', '', line));
    if (level.role === 'levels') {
      const best = el('p', 'hub-card-record');
      best.append(el('b', '', 'Best\u2003'), record ?? 'No record yet');
      lines.push(best);
    }
    const keys = el('p', 'hub-card-keys');
    keys.append(
      ...(level.playable ? [el('kbd', '', 'E'), ` ${level.action}\u2003`] : []),
      el('kbd', '', 'Esc'),
      ' Stand up',
    );
    this.cardBody.replaceChildren(...lines, keys);
    this.cardPlay.textContent = level.action;
    this.cardPlay.disabled = !level.playable;
  }

  /** Loading progress (0–1); null hides it */
  setLoading(progress: number | null): void {
    this.loading.hidden = progress === null;
    if (progress === null) return;
    const percent = Math.round(progress * 100);
    this.loadingBar.style.width = `${percent}%`;
    this.loadingText.textContent = `Loading the high street… ${percent}%`;
  }

  toggleCredits(): void {
    this.credits.hidden = !this.credits.hidden;
  }

  /**
   * Makers, asset attribution and legal notice (doc/hub.md). The whale girl model is CC BY 4.0 and must be credited in game with a note of changes (assets/README.md).
   */
  private buildCredits(): void {
    const link = (text: string, href: string) => {
      const a = el('a', '', text);
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      return a;
    };
    const list = (rows: (string | HTMLElement)[][]) => {
      const ul = el('ul', 'hub-credits-list');
      for (const parts of rows) {
        const li = el('li', '');
        li.append(...parts);
        ul.append(li);
      }
      return ul;
    };
    const paragraph = (...parts: (string | HTMLElement)[]) => {
      const p = el('p', '');
      p.append(...parts);
      return p;
    };
    const makers = paragraph(
      'Made by ',
      link('@IvanHanloth', 'https://github.com/IvanHanloth'),
      ' and ',
      link('@Pleasurecruise', 'https://github.com/Pleasurecruise'),
      ' during the HackNotts 26 hackathon. Source code: ',
      link('github.com/IvanHanloth/rhythm2000s', 'https://github.com/IvanHanloth/rhythm2000s'),
      '.',
    );
    const assets: (string | HTMLElement)[][] = [
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
      ['Sources for all other assets are listed in assets/README.md in the repository.'],
    ];
    const legal = [
      'Microsoft, Windows and Windows XP are trademarks or registered trademarks of Microsoft Corporation. Apple, Mac, Mac OS and Aqua are trademarks of Apple Inc., registered in the U.S. and other countries. Rhythm Heaven is a trademark of Nintendo.',
      'The Windows XP and Mac OS interface artwork, icons, sounds and other materials reproduced in this game are the property of Microsoft Corporation and Apple Inc. respectively, and all rights in them remain with their owners. They are used solely for non-commercial academic purposes.',
      'Rhythm 2000s is an independent project and is not affiliated with, sponsored by or endorsed by Microsoft Corporation, Apple Inc. or Nintendo.',
    ];
    this.credits.append(
      el('div', 'hub-credits-title', 'Credits'),
      el(
        'p',
        '',
        'Rhythm 2000s — a Rhythm Heaven-style rhythm game about everyday computing in the early 2000s.',
      ),
      makers,
      el('div', 'hub-credits-heading', 'Assets'),
      list(assets),
      el('div', 'hub-credits-heading', 'Legal notice'),
      ...legal.map((text) => el('p', 'hub-credits-legal', text)),
      button('Close', 'hub-button', () => this.toggleCredits()),
    );
    this.credits.hidden = true;
  }

  showPause(visible: boolean): void {
    this.pause.hidden = !visible;
  }

  /** Fade to black: opacity 0 → 1 over durationMs */
  setFade(opaque: boolean, durationMs: number): void {
    this.fade.style.transitionDuration = `${durationMs}ms`;
    this.fade.classList.toggle('is-opaque', opaque);
  }
}
