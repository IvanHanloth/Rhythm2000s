// A file on the desktop (Finder desktop icon): a 48 px document icon (white page with a small application icon)
// or a blue folder, over a white shadowed name. Shared by dock-trash and the Mac widget gallery.

import { Container } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { appIcon, type AppIconName } from '@/scenes/mac-2000/assets.ts';
import { drawDocumentIcon, drawFolderIcon } from './icons.ts';
import { aquaText } from './paint.ts';

export const FILE_ICON_SIZE = 48;

/** A desktop file: 48 px icon over a white shadowed name. Origin at the icon centre */
export function createDesktopFile(label: string, app: AppIconName | 'folder'): Container {
  const view = new Container({ label: `file-${label}` });
  const half = FILE_ICON_SIZE / 2;
  if (app === 'folder') {
    const folder = drawFolderIcon(FILE_ICON_SIZE);
    folder.position.set(-half, -half);
    view.addChild(folder);
  } else {
    // Document: a white page with a small application icon on it
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
