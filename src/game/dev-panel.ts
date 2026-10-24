// Dev panel: jump straight to the street or a scene, set input calibration, open prototype pages (ADR 0002).

import { CALIBRATION_LIMIT_MS } from './settings.ts';

const PROTOTYPES = [
  { label: 'Latency test', href: '/prototypes/latency/' },
  { label: 'XP widgets', href: '/prototypes/xp-components/' },
];

export interface DevPanelOptions {
  /** Places to switch to: the street hub and each scene */
  scenes: readonly { id: string; label: string }[];
  onSelectScene(id: string): void;
  /** Current calibration (ms) */
  calibrationMs: number;
  /** Calibration changed; returns the value actually used (may be clamped) */
  onCalibrationChange(value: number): number;
}

export interface DevPanel {
  element: HTMLElement;
  setActive(id: string): void;
}

export function createDevPanel(options: DevPanelOptions): DevPanel {
  const element = document.createElement('nav');
  element.className = 'dev-panel';
  element.setAttribute('aria-label', 'Dev panel');
  element.title = 'Dev panel: press ` to hide / show';

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Backquote' && !event.repeat) element.hidden = !element.hidden;
  });

  const buttons = options.scenes.map((scene) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = scene.label;
    button.dataset.sceneId = scene.id;
    button.addEventListener('click', () => {
      // Drop focus so a later Space press doesn't trigger this button again
      button.blur();
      options.onSelectScene(scene.id);
    });
    return button;
  });

  const calibration = document.createElement('label');
  calibration.title = 'Positive means you tend to press late. You can enter the "suggested calibration" from the latency test';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(-CALIBRATION_LIMIT_MS);
  input.max = String(CALIBRATION_LIMIT_MS);
  input.step = '1';
  input.value = String(options.calibrationMs);
  input.addEventListener('change', () => {
    input.value = String(options.onCalibrationChange(Number(input.value)));
  });
  calibration.append('Calibration', input, 'ms');

  const links = PROTOTYPES.map(({ label, href }) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = `Prototype: ${label}`;
    return link;
  });

  element.append(...buttons, calibration, ...links);

  return {
    element,
    setActive(id) {
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.sceneId === id));
      }
    },
  };
}
