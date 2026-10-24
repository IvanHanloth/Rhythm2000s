// The small window iChat 1.0 (10.2) pops up for a new message: a pinstriped "Message from …" title bar,
// the sender's picture on a white body and a pale blue speech bubble pointing at it. Origin at the centre, as AquaWindow.
// No original buddy picture is available, so the iChat icon stands in.

import { Container, Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { appIcon } from '@/scenes/mac-2000/assets.ts';
import { aquaText, vGradient } from './paint.ts';
import { AquaWindow, TITLE_BAR_HEIGHT } from './window.ts';

export const CHAT_WIDTH = 260;
export const CHAT_HEIGHT = 74;
const AVATAR = 32;
const PADDING = 8;

export interface ChatWindowOptions {
  buddy: string;
  text: string;
}

export class ChatWindow {
  readonly window: AquaWindow;
  /** Bubble centre relative to the window centre */
  readonly bubbleCenter: { x: number; y: number };

  constructor({ buddy, text }: ChatWindowOptions) {
    this.window = new AquaWindow({
      title: `Message from ${buddy}`,
      width: CHAT_WIDTH,
      height: CHAT_HEIGHT,
      content: 'white',
      toolbarButton: false,
      growBox: false,
    });
    const contentHeight = CHAT_HEIGHT - TITLE_BAR_HEIGHT;
    const avatar = appIcon('iChat', AVATAR);
    avatar.position.set(PADDING, (contentHeight - AVATAR) / 2);

    const bubbleX = PADDING + AVATAR + 12;
    const bubbleWidth = CHAT_WIDTH - bubbleX - PADDING;
    const label = aquaText(text, { size: 12, wrapWidth: bubbleWidth - 16 });
    const bubbleHeight = Math.min(contentHeight - 8, Math.max(24, label.height + 10));
    const bubbleY = (contentHeight - bubbleHeight) / 2;
    const bubble = new Graphics()
      // Tail pointing at the picture
      .poly([
        bubbleX + 2,
        bubbleY + bubbleHeight / 2 - 5,
        bubbleX - 7,
        bubbleY + bubbleHeight / 2,
        bubbleX + 2,
        bubbleY + bubbleHeight / 2 + 5,
      ])
      .fill(AQUA.chatBubble.top)
      .stroke({ width: 1, color: AQUA.chatBubble.edge })
      .roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, bubbleHeight / 2)
      .fill(
        vGradient([
          [0, AQUA.chatBubble.top],
          [1, AQUA.chatBubble.bottom],
        ]),
      )
      .stroke({ width: 1, color: AQUA.chatBubble.edge });
    label.anchor.set(0, 0.5);
    label.position.set(bubbleX + 9, bubbleY + bubbleHeight / 2);

    const content = new Container({ label: 'chat-content' });
    content.addChild(avatar, bubble, label);
    this.window.content.addChild(content);

    this.bubbleCenter = {
      x: bubbleX + bubbleWidth / 2 - CHAT_WIDTH / 2,
      y: TITLE_BAR_HEIGHT + bubbleY + bubbleHeight / 2 - CHAT_HEIGHT / 2,
    };
  }

  get view(): Container {
    return this.window.view;
  }

  setActive(active: boolean): void {
    this.window.setActive(active);
  }

  destroy(): void {
    this.window.destroy();
  }
}
