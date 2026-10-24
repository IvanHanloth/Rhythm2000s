// Scene: a Mac desktop from around 2000 (doc/scenes/mac-2000.md), the early Aqua of US English Mac OS X 10.0–10.2.
// Levels are picked in a Finder window. The interface is drawn at original pixel size on a 1024×576 virtual
// screen scaled 1.25× to the canvas; the turn banner and judgement labels use canvas coordinates.

import { Container, Graphics, Sprite } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../game/layout.ts';
import type { SceneContext, SceneEntry } from '../../game/scene.ts';
import type { Chart } from '../../rhythm/chart.ts';
import { AQUA } from '../../theme/aqua.ts';
import { THEMES } from '../../theme/tokens.ts';
import { SCENE_CATALOG } from '../catalog.ts';
import { LevelScene, type ResultsWindowOptions } from '../shared/level-scene.ts';
import { macAssets, preloadMacAssets } from './assets.ts';
import { AquaAlert } from './components/alert.ts';
import { Dock, DOCK_HEIGHT, type DockItem } from './components/dock.ts';
import { drawCautionIcon } from './components/icons.ts';
import { MenuBar } from './components/menu-bar.ts';
import { MacLevelSelect } from './level-select.ts';
import { MacResultsWindow } from './results-window.ts';
import { MacSession } from './session.ts';
import { createMacSongSounds, type MacSongSounds } from './song.ts';
import { MacTargetsView } from './targets-view.ts';
import { MacVirtualMouse } from './virtual-mouse.ts';

const SCREEN_SCALE = 1.25;
const SCREEN_WIDTH = DESIGN_WIDTH / SCREEN_SCALE;
const SCREEN_HEIGHT = DESIGN_HEIGHT / SCREEN_SCALE;

/** Turn banner centre (canvas coordinates): below the menu bar, above the top row of alerts */
const BANNER_Y = 62;

const MENUS = ['File', 'Edit', 'View', 'Go', 'Window', 'Help'];

/** Finder and Mail are always running; the other eight bounce for dock-bounce (BOUNCE_DOCK_INDICES in targets-view.ts) */
const DOCK_ITEMS: DockItem[] = [
  { icon: 'finder', running: true },
  { icon: 'Mail', running: true },
  { icon: 'iChat' },
  { icon: 'Safari' },
  { icon: 'iTunes' },
  { icon: 'iPhoto' },
  { icon: 'iCal' },
  { icon: 'QuickTime Player' },
  { icon: 'Sherlock' },
  { icon: 'System Preferences' },
];

/** Vertical centres on the virtual screen: alerts, and the results window between menu bar and Dock */
const DIALOG_Y = 250;
const RESULTS_Y = 266;

class Mac2000Scene extends LevelScene<MacSession> {
  protected readonly levelList: MacLevelSelect;
  private readonly sounds: MacSongSounds;
  private readonly menuBar = new MenuBar({ width: SCREEN_WIDTH, appName: 'Finder', menus: MENUS });
  private readonly dock = new Dock(DOCK_ITEMS);
  private readonly windowLayer = new Container({ label: 'windows' });
  private readonly dialogLayer = new Container({ label: 'dialogs' });
  /** Files thrown in the Trash, above the Dock */
  private readonly fileLayer = new Container({ label: 'files' });
  /** The Apple menu, above the menu bar */
  private readonly menuLayer = new Container({ label: 'menus' });
  /** The virtual mouse, on top of the Mac interface */
  private readonly pointerLayer = new Container({ label: 'pointer' });
  private targetsView: MacTargetsView | null = null;
  private virtualMouse: MacVirtualMouse | null = null;

  constructor(context: SceneContext) {
    super(context, { id: mac2000Scene.id, theme: THEMES.aqua, bannerY: BANNER_Y });
    this.sounds = createMacSongSounds(context.clock.context, macAssets().sounds);
    this.dock.view.position.set(
      Math.round((SCREEN_WIDTH - this.dock.width) / 2),
      SCREEN_HEIGHT - DOCK_HEIGHT,
    );
    this.levelList = new MacLevelSelect({
      charts: this.charts,
      onStart: (index) => this.openLevel(index),
      onBack: () => context.leave(),
    });

    this.screen.scale.set(SCREEN_SCALE);
    this.screen.addChild(
      createWallpaper(),
      this.levelList.view,
      this.windowLayer,
      this.dialogLayer,
      this.dock.view,
      this.fileLayer,
      this.menuBar.view,
      this.menuLayer,
      this.pointerLayer,
    );

    if (this.charts.length === 0) this.showNoCharts();
    this.openRequestedLevel();
  }

  protected override updateDesktop(audioTime: number): void {
    // The menu bar clock is decoration showing local time, unrelated to the rhythm
    this.menuBar.update(new Date());
    if (this.levelList.view.visible) this.levelList.update(audioTime);
  }

  protected createSession(chart: Chart): MacSession {
    return new MacSession(this.context, chart, this.sounds);
  }

  protected buildRound(session: MacSession): void {
    const targetsView = new MacTargetsView(session, {
      windowLayer: this.windowLayer,
      judgementLayer: this.judgementLayer,
      dock: this.dock,
      menuBar: this.menuBar,
      fileLayer: this.fileLayer,
      menuLayer: this.menuLayer,
      screenScale: SCREEN_SCALE,
    });
    this.targetsView = targetsView;
    this.virtualMouse = new MacVirtualMouse(
      session,
      (_, event) => targetsView.clickPoints(event),
      (event, beat) => targetsView.dragProgress(event, beat),
    );
    this.pointerLayer.addChild(this.virtualMouse.view);
  }

  protected clearRound(): void {
    this.targetsView?.destroy();
    this.targetsView = null;
    this.virtualMouse?.destroy();
    this.virtualMouse = null;
  }

  protected renderRound(_session: MacSession, beat: number, audioTime: number): void {
    this.targetsView!.update(audioTime);
    this.virtualMouse!.update(beat);
  }

  protected openResults(options: ResultsWindowOptions): MacResultsWindow {
    const results = new MacResultsWindow(options);
    results.view.position.set(SCREEN_WIDTH / 2, RESULTS_Y);
    this.dialogLayer.addChild(results.view);
    return results;
  }

  protected setListVisible(visible: boolean): void {
    this.levelList.view.visible = visible;
    this.levelList.setActive(visible);
  }

  protected resultSound(): AudioBuffer {
    return this.sounds.result;
  }

  private showNoCharts(): void {
    const dialog = new AquaAlert({
      width: 400,
      icon: drawCautionIcon(64),
      message: 'No charts are available.',
      informative:
        'The charts could not be loaded. See the browser console for details. Chart files belong in the public/charts/ folder.',
      buttons: [{ label: 'OK', isDefault: true }],
    });
    const button = dialog.buttons[0]!;
    button.view.eventMode = 'static';
    button.view.on('pointerdown', () => (button.view.alpha = 0.75));
    button.view.on('pointerout', () => (button.view.alpha = 1));
    button.view.on('pointertap', () => this.closeModal());
    dialog.view.position.set(SCREEN_WIDTH / 2, DIALOG_Y);
    this.dialogLayer.addChild(dialog.view);
    this.showModal(dialog);
  }
}

/** Wallpaper scaled to cover the screen, cropped slightly top and bottom */
function createWallpaper(): Container {
  const wallpaper = new Container({ label: 'wallpaper' });
  const texture = macAssets().wallpaper;
  const sprite = new Sprite(texture);
  const scale = Math.max(SCREEN_WIDTH / texture.width, SCREEN_HEIGHT / texture.height);
  sprite.scale.set(scale);
  sprite.position.set(
    (SCREEN_WIDTH - texture.width * scale) / 2,
    (SCREEN_HEIGHT - texture.height * scale) / 2,
  );
  wallpaper.addChild(
    new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(AQUA.desktop),
    sprite,
  );
  return wallpaper;
}

export const mac2000Scene: SceneEntry = {
  id: 'mac-2000',
  label: SCENE_CATALOG['mac-2000'].label,
  preload: async (audio) => {
    await preloadMacAssets(audio);
  },
  create: (context) => new Mac2000Scene(context),
};
