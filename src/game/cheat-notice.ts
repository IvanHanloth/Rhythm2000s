// The cheat code's notice and badge (doc/cheat-code.md): DOM over both the street and the game canvas, like the level intro.
// The notice shows for a few seconds when the code is typed; the badge with the 10p coin stays while the cheat is on.

import './cheat.css';
import { renderBuffer } from '@/audio/synth.ts';
import { CHEAT_COLORS, cssFontFamily, FONT_FAMILIES } from '@/theme/tokens.ts';

/** How long the notice stays up (ms); a menu-style notice, not on the beat */
const NOTICE_MS = 5200;
const VOLUME = 0.5;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function coin(): HTMLElement {
  return el('span', 'cheat-coin', '10p');
}

/** The pick-up: two quick square-wave notes, B5 then E6 */
function coinSound(audio: BaseAudioContext): AudioBuffer {
  const split = 0.075;
  let phase = 0;
  const dt = 1 / audio.sampleRate;
  return renderBuffer(audio, 0.45, (t) => {
    const frequency = t < split ? 987.8 : 1318.5;
    phase += 2 * Math.PI * frequency * dt;
    const envelope = t < split ? 1 : Math.exp(-(t - split) / 0.12);
    return 0.3 * envelope * Math.sign(Math.sin(phase));
  });
}

/** The coin going in: a few metal clinks down the slot, then a dull thud */
function dropSound(audio: BaseAudioContext): AudioBuffer {
  const clinks = [0, 0.07, 0.12];
  return renderBuffer(audio, 0.5, (t) => {
    let value = 0;
    for (const at of clinks) {
      if (t < at) continue;
      const local = t - at;
      value += 0.25 * Math.exp(-local / 0.02) * Math.sin(2 * Math.PI * 3100 * local);
    }
    if (t >= 0.22) {
      const local = t - 0.22;
      value += 0.5 * Math.exp(-local / 0.06) * Math.sin(2 * Math.PI * 110 * local);
    }
    return value;
  });
}

export class CheatNotice {
  readonly element = el('div', 'cheat-layer');
  private readonly badge = el('div', 'cheat-badge');
  private readonly notice = el('div', 'cheat-notice');
  private readonly noticeTitle = el('div', 'cheat-notice-title');
  private readonly noticeBody = el('div', 'cheat-notice-body');
  private readonly audio: AudioContext;
  private sounds: { coin: AudioBuffer; drop: AudioBuffer } | null = null;
  private timer = 0;

  constructor(audio: AudioContext) {
    this.audio = audio;
    const vars: Record<string, string> = {
      '--cheat-font': cssFontFamily(FONT_FAMILIES.ui),
      '--cheat-coin': CHEAT_COLORS.coin,
      '--cheat-coin-edge': CHEAT_COLORS.coinEdge,
      '--cheat-on-coin': CHEAT_COLORS.onCoin,
      '--cheat-back': CHEAT_COLORS.back,
      '--cheat-on-back': CHEAT_COLORS.onBack,
    };
    for (const [name, value] of Object.entries(vars)) this.element.style.setProperty(name, value);

    this.badge.append(coin(), el('span', 'cheat-badge-text', 'Invincible · Scores not saved'));
    this.badge.hidden = true;
    const head = el('div', 'cheat-notice-head');
    head.append(coin(), this.noticeTitle);
    this.notice.append(head, this.noticeBody);
    this.notice.hidden = true;
    this.notice.setAttribute('role', 'status');
    this.element.append(this.badge, this.notice);
  }

  /** The badge shows while the cheat is on */
  setActive(active: boolean): void {
    this.badge.hidden = !active;
  }

  /** The code was typed: `turnedOn` is false when the cheat was already on */
  announce(turnedOn: boolean): void {
    if (turnedOn) {
      this.show('Cheat code accepted', [
        'You got a 10p coin.',
        'Invincible: every press is Perfect, and nothing you play is saved.',
        'Put the coin in an arcade machine at FUNLAND to stop cheating.',
      ]);
      this.play('coin');
    } else {
      this.show("You've already got the 10p coin", [
        'Put it in an arcade machine at FUNLAND to stop cheating.',
      ]);
    }
  }

  /** The coin went into an arcade machine */
  playDrop(): void {
    this.play('drop');
  }

  private show(title: string, lines: string[]): void {
    this.noticeTitle.textContent = title;
    this.noticeBody.replaceChildren(...lines.map((line) => el('p', '', line)));
    this.notice.hidden = false;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.notice.hidden = true;
    }, NOTICE_MS);
  }

  private play(name: 'coin' | 'drop'): void {
    this.sounds ??= { coin: coinSound(this.audio), drop: dropSound(this.audio) };
    void this.audio.resume();
    const source = this.audio.createBufferSource();
    const gain = this.audio.createGain();
    gain.gain.value = VOLUME;
    source.buffer = this.sounds[name];
    source.connect(gain).connect(this.audio.destination);
    source.start();
  }
}
