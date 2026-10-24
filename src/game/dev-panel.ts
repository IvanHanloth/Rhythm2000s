// 开发面板：正式菜单做出来之前，用来切换场景和打开原型页面（ADR 0002）。

import type { SceneEntry } from './scene.ts';

const PROTOTYPES = [{ label: '延迟测试', href: '/prototypes/latency/' }];

export interface DevPanel {
  element: HTMLElement;
  /** 标出当前场景 */
  setActive(id: string): void;
}

export function createDevPanel(
  scenes: readonly SceneEntry[],
  onSelect: (id: string) => void,
): DevPanel {
  const element = document.createElement('nav');
  element.className = 'dev-panel';
  element.setAttribute('aria-label', '开发面板');
  element.title = '开发面板：按 ` 键隐藏 / 显示';

  // 看场景全貌时可以把面板藏起来
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Backquote' && !event.repeat) element.hidden = !element.hidden;
  });

  const buttons = scenes.map((scene) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = scene.label;
    button.dataset.sceneId = scene.id;
    button.addEventListener('click', () => onSelect(scene.id));
    return button;
  });

  const links = PROTOTYPES.map(({ label, href }) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = `原型：${label}`;
    return link;
  });

  element.append(...buttons, ...links);

  return {
    element,
    setActive(id) {
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.sceneId === id));
      }
    },
  };
}
