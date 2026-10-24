// 桌面上的文件（Finder 桌面图标）：48 像素文稿图标（白纸中间叠程序小图标）或蓝色文件夹，
// 下面是白色带阴影的文件名。dock-trash 动作和 Mac 部件展示页共用。

import { Container } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { appIcon, type AppIconName } from '@/scenes/mac-2000/assets.ts';
import { drawDocumentIcon, drawFolderIcon } from './icons.ts';
import { aquaText } from './paint.ts';

export const FILE_ICON_SIZE = 48;

/** 桌面上的文件：48 像素图标，下面是白色带阴影的文件名。原点在图标中心 */
export function createDesktopFile(label: string, app: AppIconName | 'folder'): Container {
  const view = new Container({ label: `file-${label}` });
  const half = FILE_ICON_SIZE / 2;
  if (app === 'folder') {
    const folder = drawFolderIcon(FILE_ICON_SIZE);
    folder.position.set(-half, -half);
    view.addChild(folder);
  } else {
    // 文稿：白纸中间叠程序小图标
    const page = drawDocumentIcon(FILE_ICON_SIZE);
    page.position.set(-half, -half);
    const badge = appIcon(app, 24);
    badge.position.set(-12, -8);
    view.addChild(page, badge);
  }
  const textY = half + 2;
  const shadow = aquaText(label, { size: 12, bold: true, color: AQUA.desktopLabel.shadow });
  shadow.anchor.set(0.5, 0);
  shadow.position.set(1, textY + 1);
  shadow.alpha = 0.6;
  const text = aquaText(label, { size: 12, bold: true, color: AQUA.desktopLabel.text });
  text.anchor.set(0.5, 0);
  text.position.set(0, textY);
  view.addChild(shadow, text);
  return view;
}
