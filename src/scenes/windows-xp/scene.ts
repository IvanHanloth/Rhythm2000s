// 场景：Windows XP 桌面（doc/scenes/windows-xp.md）。
// MVP 玩法（doc/prototypes/mvp.md）：电脑按节奏弹出消息框，玩家按同样的节奏把它们关掉。
// XP 界面按原版像素尺寸画在 1024×576 的虚拟屏幕上，整体放大铺满画布；轮次横幅和判定字样按画布坐标画。
// 画面每帧只根据音频时间计算，不累加帧间隔。

import { Container } from 'pixi.js';
import type { FrameInfo, Scene, SceneContext, SceneEntry, TapInfo } from '../../game/scene.ts';
import type { Chart } from '../../rhythm/chart.ts';
import { buildTurnCues, turnCueAt, type TurnCue } from '../../rhythm/turn-cue.ts';
import { BEATS, THEMES } from '../../theme/tokens.ts';
import { clamp01, easeOutBack } from '../../ui/easing.ts';
import { createJudgementView } from '../../ui/judgement-view.ts';
import { TurnBanner } from '../../ui/turn-banner.ts';
import { SCENE_CATALOG } from '../catalog.ts';
import { preloadXpAssets, xpAssets } from './assets.ts';
import { XpDesktop } from './components/desktop.ts';
import { XpMessageBox } from './components/message-box.ts';
import {
  WORK_AREA_HEIGHT,
  XP_SCALE,
  XP_SCREEN_HEIGHT,
  XP_SCREEN_WIDTH,
} from './components/screen.ts';
import { XpTaskbar } from './components/taskbar.ts';
import { isDialogKind, type DialogKind } from './dialog-kinds.ts';
import { PopupSession, type JudgementRecord, type PopupWindowState } from './popup-session.ts';
import { createPopupSounds, type PopupSounds } from './song.ts';

const theme = THEMES.xp;

/** 轮次横幅中心的纵坐标（画布坐标），在最上排消息框之上 */
const BANNER_Y = 38;

/** 一个乐句里各消息框的中心位置（虚拟屏幕坐标），按乐句内序号依次使用 */
const SLOTS = [
  { x: 205, y: 135 },
  { x: 512, y: 112 },
  { x: 822, y: 150 },
  { x: 265, y: 335 },
  { x: 578, y: 312 },
  { x: 842, y: 368 },
];
/** 游戏中消息框正文的最大宽度，超过就换行 */
const POPUP_TEXT_WIDTH = 210;

/** 消息框文案：模仿当年弹窗广告和系统提示的腔调，全部原创 */
const POPUP_TEXTS: Record<DialogKind, { title: string; text: string }[]> = {
  'dialog-info': [
    { title: '恭喜您！', text: '您是本站第 100000 位访客，请点击领取大奖。' },
    { title: '新消息', text: '您有 1 条新的好友请求。' },
    { title: '网络连接', text: '已连接到 Internet。速度：56.0 Kbps' },
    { title: '温馨提示', text: '您的邮箱已满，请及时清理。' },
  ],
  'dialog-warning': [
    { title: '安全警告', text: '发现 3 个可疑文件，建议立即扫描。' },
    { title: '磁盘空间不足', text: '本地磁盘 (C:) 的空间不足。' },
    { title: '电池电量低', text: '电池电量只剩 5%，请接上电源。' },
  ],
  'dialog-error': [
    { title: '应用程序错误', text: '该程序执行了非法操作，即将关闭。' },
    { title: '找不到文件', text: '找不到文件 C:\\WINDOWS\\system32\\fun.dll。' },
    { title: '网页错误', text: '无法显示网页。请检查网络连接。' },
  ],
  'dialog-question': [
    { title: '免费下载', text: '是否下载最新动态屏保？完全免费！' },
    { title: '系统提示', text: '您的电脑运行缓慢，是否立即优化？' },
    { title: '记事本', text: '是否保存对「无标题」的更改？' },
  ],
};

/** Miss 后标题栏闪烁：每隔多少拍切换一次活动 / 非活动，闪多久（拍） */
const FLASH_STEP_BEATS = 0.125;
const FLASH_BEATS = 0.75;
/** 消息框、判定字样淡出的时长（拍） */
const FADE_BEATS = 0.25;
/** 结果出来后多久才接受「再来一次」的输入（毫秒），避免连按误触 */
const RESULT_INPUT_DELAY_MS = 600;

/** unavailable：没有可用的谱面，只显示提示，不接受开始 */
type State = 'ready' | 'starting' | 'playing' | 'result' | 'unavailable';

interface ActiveJudgement {
  record: JudgementRecord;
  view: Container;
}

class WindowsXpScene implements Scene {
  readonly view = new Container({ label: 'windows-xp' });
  private readonly context: SceneContext;
  /** 本场景使用的谱面；没有加载到可用谱面时为 null */
  private readonly chart: Chart | null;
  private readonly turnCues: TurnCue[];
  /** Follow me / Your turn 横幅：示范用凸起的按钮色，跟打用强调色 */
  private readonly turnBanner = new TurnBanner({
    call: { fill: theme.surfaceRaised, text: theme.ink, line: theme.line },
    response: { fill: theme.accent, text: theme.onAccent, line: theme.highlight },
  });
  private readonly sounds: PopupSounds;
  /** 虚拟 XP 屏幕：放大 XP_SCALE 倍铺满画布 */
  private readonly screen = new Container({ label: 'xp-screen' });
  private readonly desktop = new XpDesktop();
  private readonly taskbar = new XpTaskbar();
  private readonly windowLayer = new Container({ label: 'windows' });
  private readonly dialogLayer = new Container({ label: 'dialogs' });
  private readonly judgementLayer = new Container({ label: 'judgements' });
  /** 场景自己的音效出口（结果的 tada）；一局里的声音走 PopupSession 的出口 */
  private readonly output: GainNode;

  private state: State = 'ready';
  private session: PopupSession | null = null;
  private popups: XpMessageBox[] = [];
  private judgementViews: ActiveJudgement[] = [];
  private shownJudgements = 0;
  private dialog: XpMessageBox | null = null;
  private resultShownAt = 0;
  private destroyed = false;

  constructor(context: SceneContext) {
    this.context = context;
    // 目前只用第一首属于本场景的谱面；以后有选曲界面再改
    this.chart = context.charts.find((chart) => chart.scene === windowsXpScene.id) ?? null;
    this.turnCues = this.chart ? buildTurnCues(this.chart) : [];
    const audio = context.clock.context;
    this.sounds = createPopupSounds(audio, xpAssets().sounds);
    this.output = audio.createGain();
    this.output.gain.value = 0.8;
    this.output.connect(audio.destination);

    this.screen.scale.set(XP_SCALE);
    this.taskbar.view.y = XP_SCREEN_HEIGHT - this.taskbar.view.height;
    this.screen.addChild(this.desktop.view, this.windowLayer, this.dialogLayer, this.taskbar.view);
    this.turnBanner.view.position.set((XP_SCREEN_WIDTH * XP_SCALE) / 2, BANNER_Y);
    this.view.addChild(this.screen, this.judgementLayer, this.turnBanner.view);

    if (this.chart) {
      this.showDialog({
        kind: 'dialog-info',
        title: this.chart.title,
        text: '电脑会先按节奏弹出一串消息框。\n看到「Your turn」时，请按同样的节奏把它们逐个关掉。\n\n按空格键或点击画面开始。',
        button: '开始',
      });
    } else {
      this.state = 'unavailable';
      this.showDialog({
        kind: 'dialog-error',
        title: '没有可用的谱面',
        text: '谱面没有加载成功，原因见浏览器控制台。\n谱面文件放在 public/charts/ 目录下。',
        button: '确定',
      });
    }
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  update({ audioTime }: FrameInfo): void {
    // 任务栏时钟只是装饰，显示本机时间，不参与节奏
    this.taskbar.setClock(new Date());

    const session = this.session;
    if (this.state !== 'playing' || !session) return;

    session.update(audioTime);
    const beat = session.beatAt(audioTime);
    this.renderPopups(session, beat);
    this.renderJudgements(session, beat);
    this.renderTurnBanner(beat);

    if (audioTime >= session.endTime) this.finish(session);
  }

  onTap({ audioTime }: TapInfo): void {
    switch (this.state) {
      case 'ready':
        void this.start();
        break;
      case 'playing':
        this.session?.tap(audioTime);
        break;
      case 'result':
        if (performance.now() - this.resultShownAt >= RESULT_INPUT_DELAY_MS) void this.start();
        break;
      case 'starting':
      case 'unavailable':
        break;
    }
  }

  destroy(): void {
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearRound();
    this.hideDialog();
    this.output.disconnect();
    this.view.destroy({ children: true });
  }

  // ---------- 流程 ----------

  private async start(): Promise<void> {
    const chart = this.chart;
    if (!chart) return;
    this.state = 'starting';
    await this.context.clock.resume();
    // 等待音频恢复期间可能已经离开场景
    if (this.destroyed || this.state !== 'starting') return;

    this.clearRound();
    this.hideDialog();
    this.session = new PopupSession(this.context, chart, this.sounds);
    this.popups = this.session.windows.map((w) => this.createPopup(w));
    this.state = 'playing';
  }

  private finish(session: PopupSession): void {
    const { perfect, good, miss } = session.counts();
    this.clearRound();
    this.state = 'result';
    this.resultShownAt = performance.now();
    this.showDialog({
      kind: 'dialog-info',
      title: '大扫除完成',
      text: `Perfect ${perfect}　　Good ${good}　　Miss ${miss}\n\n按空格键或点击画面，再来一次。`,
      button: '再来一次',
    });
    this.playNow(this.sounds.result);
  }

  /** 切到后台时浏览器会降频，计时不再可靠，直接中止这一局 */
  private readonly onVisibilityChange = () => {
    if (!document.hidden || this.state !== 'playing') return;
    this.clearRound();
    this.state = 'ready';
    this.showDialog({
      kind: 'dialog-warning',
      title: '已暂停',
      text: '页面切到了后台，这一局已中止。\n\n按空格键或点击画面重新开始。',
      button: '开始',
    });
  };

  private clearRound(): void {
    this.session?.stop();
    this.session = null;
    for (const popup of this.popups) popup.destroy();
    this.popups = [];
    for (const { view } of this.judgementViews) view.destroy({ children: true });
    this.turnBanner.show(null);
    this.judgementViews = [];
    this.shownJudgements = 0;
  }

  private showDialog(options: {
    kind: DialogKind;
    title: string;
    text: string;
    button: string;
  }): void {
    this.hideDialog();
    this.dialog = new XpMessageBox({
      kind: options.kind,
      title: options.title,
      text: options.text,
      buttons: [options.button],
      maxTextWidth: 320,
    });
    this.dialog.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
    this.dialogLayer.addChild(this.dialog.view);
  }

  private hideDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
  }

  private playNow(buffer: AudioBuffer): void {
    const source = this.context.clock.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.start();
  }

  // ---------- 画面 ----------

  private createPopup(state: PopupWindowState): XpMessageBox {
    const { phrase, index, action } = state.call;
    const kind: DialogKind = isDialogKind(action) ? action : 'dialog-info';
    const texts = POPUP_TEXTS[kind];
    const text = texts[(phrase * 3 + index) % texts.length]!;
    const popup = new XpMessageBox({ kind, ...text, maxTextWidth: POPUP_TEXT_WIDTH });
    const slot = SLOTS[index % SLOTS.length]!;
    popup.view.position.set(slot.x, slot.y);
    popup.view.visible = false;
    this.windowLayer.addChild(popup.view);
    return popup;
  }

  private renderPopups(session: PopupSession, beat: number): void {
    const focus = this.focusedWindow(session, beat);

    session.windows.forEach((state, i) => {
      const popup = this.popups[i]!;
      const view = popup.view;
      const appearBeat = state.call.beat - BEATS.windowOpen;
      let visible = beat >= appearBeat;
      let scale = 1;
      let alpha = 1;
      let active = i === focus;

      if (visible && state.closedAt !== null) {
        // 关闭：从玩家输入那一刻开始缩小淡出
        const p = (beat - session.beatAt(state.closedAt)) / BEATS.windowClose;
        visible = p < 1;
        scale = 1 - 0.2 * clamp01(p);
        alpha = 1 - clamp01(p);
      } else if (visible && state.missedAt !== null) {
        // Miss：像原版点到模态框外面那样，标题栏闪几下；留到这一小节结束再淡出
        const sinceMiss = beat - session.beatAt(state.missedAt);
        if (sinceMiss < FLASH_BEATS) active = Math.floor(sinceMiss / FLASH_STEP_BEATS) % 2 === 0;
        const phraseEnd = session.chart.phrases[state.call.phrase]!.end;
        const p = (beat - phraseEnd) / FADE_BEATS;
        visible = p < 1;
        alpha = 1 - clamp01(p);
      } else if (visible) {
        // 弹出：在示范拍点那一刻刚好弹到最大
        scale = easeOutBack((beat - appearBeat) / BEATS.windowOpen);
      }

      view.visible = visible;
      if (!visible) return;
      view.scale.set(Math.max(0.01, scale));
      view.alpha = alpha;
      popup.setActive(active);
    });
  }

  /**
   * 活动窗口：示范小节里是最新弹出的那个；空档和跟打小节里是下一个该关的那个。
   * 其余消息框用非活动标题栏，让玩家看懂下一个目标。
   */
  private focusedWindow(session: PopupSession, beat: number): number {
    const phraseIndex = session.chart.phrases.findIndex((p) => beat >= p.callStart && beat < p.end);
    if (phraseIndex < 0) return -1;
    const phrase = session.chart.phrases[phraseIndex]!;
    const windows = session.windows
      .map((state, i) => ({ state, i }))
      .filter(({ state }) => state.call.phrase === phraseIndex);

    if (beat < phrase.callEnd) {
      return windows.filter(({ state }) => state.call.beat <= beat).at(-1)?.i ?? -1;
    }
    return windows.find(({ state }) => state.closedAt === null && state.missedAt === null)?.i ?? -1;
  }

  /** 轮次横幅：切换时挤压回弹一次 */
  private renderTurnBanner(beat: number): void {
    const cue = turnCueAt(this.turnCues, beat);
    if (!cue) {
      this.turnBanner.show(null);
      return;
    }
    this.turnBanner.show(cue.turn, 1 - clamp01((beat - cue.start) / BEATS.squash));
  }

  private renderJudgements(session: PopupSession, beat: number): void {
    // 新出现的判定，放在对应消息框的上方（换算成画布坐标）
    for (; this.shownJudgements < session.judgements.length; this.shownJudgements++) {
      const record = session.judgements[this.shownJudgements]!;
      const view = createJudgementView(record.level);
      const popup = this.popups[record.target]!;
      const slot = SLOTS[session.windows[record.target]!.call.index % SLOTS.length]!;
      view.position.set(slot.x * XP_SCALE, (slot.y - popup.height / 2) * XP_SCALE - 20);
      this.judgementLayer.addChild(view);
      this.judgementViews.push({ record, view });
    }

    // 挤压回弹 → 停留 → 淡出
    this.judgementViews = this.judgementViews.filter(({ record, view }) => {
      const since = beat - session.beatAt(record.shownAt);
      if (since >= BEATS.judgementHold + FADE_BEATS) {
        view.destroy({ children: true });
        return false;
      }
      const squash = 1 - clamp01(since / BEATS.squash);
      view.scale.set(1 + 0.25 * squash, 1 - 0.25 * squash);
      view.alpha = 1 - clamp01((since - BEATS.judgementHold) / FADE_BEATS);
      return true;
    });
  }
}

export const windowsXpScene: SceneEntry = {
  id: 'windows-xp',
  label: SCENE_CATALOG['windows-xp'].label,
  preload: async (audio) => {
    await preloadXpAssets(audio);
  },
  create: (context) => new WindowsXpScene(context),
};
