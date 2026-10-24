// Draws any of the Mac scene's system icons (src/scenes/mac-2000/system-icons.ts) `size` px square, top left at (0, 0):
// the application icons from their files, the rest as vectors.

import { Container } from 'pixi.js';
import { appIcon } from '../assets.ts';
import { MAC_ICONS, type MacIconId, type MacIconSource } from '../system-icons.ts';
import {
  drawAppleLogo,
  drawCautionIcon,
  drawDocumentIcon,
  drawFinderIcon,
  drawFolderIcon,
  drawTrashIcon,
} from './icons.ts';
import { drawSpeakerIcon } from './volume-menu.ts';

export function macSystemIcon(id: MacIconId, size: number): Container {
  const source: MacIconSource = MAC_ICONS[id];
  if ('app' in source) return appIcon(source.app, size);
  switch (source.drawn) {
    case 'finder':
      return drawFinderIcon(size);
    case 'folder':
      return drawFolderIcon(size);
    case 'document':
      return drawDocumentIcon(size);
    case 'trash':
      return drawTrashIcon(size);
    case 'trash-full':
      return drawTrashIcon(size, { full: true });
    case 'caution':
      return drawCautionIcon(size);
    case 'apple': {
      // 20×24 units: centred across the square
      const holder = new Container({ label: 'apple-icon' });
      const logo = drawAppleLogo(size);
      logo.x = (size - (size * 20) / 24) / 2;
      holder.addChild(logo);
      return holder;
    }
    case 'speaker': {
      // About 18×16: centred down the square
      const holder = new Container({ label: 'speaker-icon' });
      const speaker = drawSpeakerIcon();
      speaker.scale.set(size / 18);
      speaker.y = (size - (16 * size) / 18) / 2;
      holder.addChild(speaker);
      return holder;
    }
  }
}
