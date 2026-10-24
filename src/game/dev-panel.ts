// 开发面板：用来直接切换到街区或某个场景、填写输入校准值、打开原型页面（ADR 0002）。

import { CALIBRATION_LIMIT_MS } from './settings.ts';

const PROTOTYPES = [
  { label: '延迟测试', href: '/prototypes/latency/' },
  { label: 'XP 部件', href: '/prototypes/xp-components/' },
];

export interface DevPanelOptions {
  /** 可以切换到的画面：街区大厅和各个场景 */
  scenes: readonly { id: string; label: string }[];
  onSelectScene(id: string): void;
  /** 当前校准值（毫秒） */
  calibrationMs: number;
  /** 校准值改变；返回实际采用的值（可能被限制在范围内） */
  onCalibrationChange(value: number): number;
}

export interface DevPanel {
  element: HTMLElement;
  /** 标出当前场景 */
  setActive(id: string): void;
}

export function createDevPanel(options: DevPanelOptions): DevPanel {
  const element = document.createElement('nav');
  element.className = 'dev-panel';
  element.setAttribute('aria-label', '开发面板');
  element.title = '开发面板：按 ` 键隐藏 / 显示';

  // 看场景全貌时可以把面板藏起来
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Backquote' && !event.repeat) element.hidden = !element.hidden;
  });

  const buttons = options.scenes.map((scene) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = scene.label;
    button.dataset.sceneId = scene.id;
    button.addEventListener('click', () => {
      // 去掉焦点，避免之后按空格又触发这个按钮
      button.blur();
      options.onSelectScene(scene.id);
    });
    return button;
  });

  const calibration = document.createElement('label');
  calibration.title = '正数表示你习惯按晚。可以填延迟测试原型给出的「建议校准」';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(-CALIBRATION_LIMIT_MS);
  input.max = String(CALIBRATION_LIMIT_MS);
  input.step = '1';
  input.value = String(options.calibrationMs);
  input.addEventListener('change', () => {
    input.value = String(options.onCalibrationChange(Number(input.value)));
  });
  calibration.append('校准', input, 'ms');

  const links = PROTOTYPES.map(({ label, href }) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = `原型：${label}`;
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
