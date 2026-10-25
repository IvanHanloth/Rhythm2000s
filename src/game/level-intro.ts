// Level intro: shown before a level with "scene · level N", title, tempo, difficulty, best score and how to play (after the "level loading" design board).
// The first Space or click dismisses it; that press still reaches the scene, so it starts the round straight away.

import './screens.css';
import type { SceneId } from '@/scenes/catalog.ts';
import { applyScreenTheme, screenThemeFor } from './screen-theme.ts';

export interface LevelIntroInfo {
  sceneId: SceneId;
  /** e.g. "Windows XP · Level 2" */
  kicker: string;
  title: string;
  /** The tempo the level plays at: the chart's times the difficulty's speed */
  bpm: number;
  /** e.g. "Hard (×1.2)" */
  difficulty: string;
  /** Widgets used in this level, e.g. "Error box, Warning box" */
  actions: string;
  /** Best score line; null if never played */
  record: string | null;
}

const HOW_TO: Record<SceneId, string> = {
  'windows-xp':
    'The computer plays it first: pop-ups, tray balloons, program windows, falling files… When it is your turn, handle each one in the same rhythm.',
  'mac-2000':
    'Alerts, Dock icons, new mail and document windows appear in rhythm first. When it is your turn, handle each one in the same rhythm.',
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
    // Dismiss on the first Space or click. Listens in the capture phase without stopping the event, so the scene still gets it
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
      ['Tempo', `${info.bpm} BPM`],
      ['Difficulty', info.difficulty],
      ['Widgets', info.actions],
      ['Best', info.record ?? 'Not played yet'],
    ];
    for (const [term, value] of rows) facts.append(el('dt', '', term), el('dd', '', value));
    body.append(facts);
    card.append(caption, body);

    const tip = el('aside', 'level-intro-tip');
    const turns = el('p', 'level-intro-turns');
    turns.append(
      el('span', 'turn-chip turn-call', 'Follow me'),
      ' watch  →  ',
      el('span', 'turn-chip turn-response', 'Your turn'),
      ' play it back',
    );
    tip.append(
      el('strong', '', 'How to play'),
      el('p', '', HOW_TO[info.sceneId]),
      turns,
      el('p', 'level-intro-keys', 'Press Space or click to start · Esc to go back'),
    );

    this.element.replaceChildren(header, card, tip);
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
