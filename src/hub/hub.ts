// The street hub (doc/hub.md, ADR 0005): title screen and level select.
// The title camera pans along the street → "Start" drops it behind the character → walk into the café and sit at a computer → the level.
// The hub judges no rhythm, so it moves by requestAnimationFrame time (with a capped step), not the audio clock (ADR 0005).

import type { CheatMode } from '@/game/cheat.ts';
import type { SaveData } from '@/game/save-progress.ts';
import type { SaveSlots } from '@/game/save-slots.ts';
import type { SceneId } from '@/scenes/catalog.ts';
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  DefaultLoadingManager,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  PCFSoftShadowMap,
  PMREMGenerator,
  Vector2,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { STREET_COLORS as C } from '@/theme/street.ts';
import { pushOut, type Point } from './collision.ts';
import { cutawayPhase } from './cutaway.ts';
import {
  clampPitch,
  dampAngle,
  headingOf,
  lerpAngle,
  moveDirection,
  nearestSpot,
  orbitOffset,
} from './motion.ts';
import { currentObjective, OBJECTIVE_TEXT } from './objectives.ts';
import { HubOverlay, type LevelInfo } from './overlay.ts';
import type { FinishedLevels } from './save-menu.ts';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createDreamGradePass, createDreamSky, DreamMotes } from './dream.ts';
import { HubSounds } from './sounds.ts';
import { WhaleAvatar } from './whale-model.ts';
import {
  buildWorld,
  type GameSpot,
  type HubSpot,
  type LevelSpot,
  type ReadSpot,
  type ScreenImage,
  type World,
} from './world.ts';

export type { LevelInfo } from './overlay.ts';

/** Device pixel ratio cap: high-DPI screens don't render at full resolution, to save some work */
const MAX_PIXEL_RATIO = 1.5;
/** Sun elevation and azimuth (degrees): morning light slanting into the street from the south-east */
const SUN_ELEVATION = 38;
const SUN_AZIMUTH = 150;
/** Half-size of the shadow area around the character (m) */
const SHADOW_RANGE = 22;
/** Longest frame step (s), so returning to the tab doesn't jump the character far */
const MAX_FRAME_SECONDS = 0.05;

const WALK_SPEED = 3.0;
const RUN_SPEED = 5.6;
/** Character radius on the ground (m) */
const PLAYER_RADIUS = 0.32;
/** Camera target height above the feet */
const EYE_HEIGHT = 1.45;
/** Camera distance from its target */
const BOOM_LENGTH = 3.6;
/** Gap the camera keeps in front of a wall it hits */
const BOOM_MARGIN = 0.25;
const MOUSE_YAW = 0.0026;
const MOUSE_PITCH = 0.0022;

const INTRO_SECONDS = 1.6;
const SIT_SECONDS = 0.9;
const STAND_SECONDS = 0.7;
const LAUNCH_SECONDS = 0.8;
const FADE_MS = 600;

/** chair-swivel's wide shot: up, back and to the right of the seat (m), looking down at the chair (provisional) */
const CUTAWAY_WIDE = new Vector3(1.25, 2.35, 1.9);
const CUTAWAY_LOOK_HEIGHT = 0.95;
/** The level as drawn on the 3D monitor: the CRT is 4:3, so the 16:9 level gets bars above and below */
const MONITOR_IMAGE = { width: 1024, height: 768 };

/** The level on the 3D monitor, letterboxed into the CRT's 4:3 */
function monitorTexture(desktop: HTMLCanvasElement): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = MONITOR_IMAGE.width;
  canvas.height = MONITOR_IMAGE.height;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('No 2D context for the monitor image');
  g.fillStyle = C.monitorLetterbox;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const height = (canvas.width * desktop.height) / desktop.width;
  g.drawImage(desktop, 0, (canvas.height - height) / 2, canvas.width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** What each scene's computer looks like */
const MACHINE_LOOKS: Record<SceneId, { screen: ScreenImage; imac?: boolean }> = {
  'windows-xp': { screen: 'xp-bliss' },
  'mac-2000': { screen: 'mac-aqua-blue', imac: true },
};

/**
 * title: title screen; intro: camera drops behind the character; roam: walking; paused: menu after the pointer is released;
 * dialog: reading a notice or talking; booklet: reading the café's guide booklet; sitting / seated / standing: sitting down, seated at the level card, getting up;
 * launching: the camera pushes into the screen and the level starts.
 */
type State =
  | 'title'
  | 'intro'
  | 'roam'
  | 'paused'
  | 'dialog'
  | 'booklet'
  | 'sitting'
  | 'seated'
  | 'standing'
  /** Stepping onto the dance machine's pad, the camera moving in behind (doc/dance-machine.md) */
  | 'mounting'
  | 'launching';

interface Pose {
  position: Vector3;
  look: Vector3;
}

interface CameraTween {
  from: Pose;
  /** Recomputed every frame, so the camera can land on a moving target */
  to: () => Pose;
  start: number;
  duration: number;
  done: () => void;
}

/** chair-swivel's cutaway in progress: the computer it happens at and how to put everything back */
interface Cutaway {
  spot: LevelSpot;
  restore: () => void;
}

export interface HubOptions {
  /** Entry computers in the café (per scene a play computer, a chart editor and a showcase computer), seated by cafe-layout.ts */
  levels: readonly LevelInfo[];
  /** "Start" once seated: enter the level */
  onPlay(levelId: string): void;
  /** E at the arcade's dance machine: open its 2D game (doc/dance-machine.md) */
  onPlayDance(): void;
  /** The level's best score line; null if never played */
  recordOf(levelId: string): string | null;
  /** Plays the startup sound on sitting down; the hub is silent without it */
  audio?: AudioContext;
  /** The cheat code (doc/cheat-code.md): while it is on, the arcade machines take the 10p coin to end it */
  cheat: CheatMode;
  /** The coin went into an arcade machine (plays its sound) */
  onCoinInserted(): void;
  /**
   * The save slots (doc/save-slots.md), picked on the title screen. The current save holds the objectives' progress
   * (doc/hub.md#objectives)
   */
  saves: SaveSlots;
  /** How many of the device's levels a save has finished, for the Load Game list */
  finishedLevels(save: Readonly<SaveData>): FinishedLevels;
}

function smoothstep(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

export class Hub {
  readonly element = document.createElement('div');
  private readonly options: HubOptions;
  /** The computers' cards; replaced when charts are imported or deleted (setLevels) */
  private levels: readonly LevelInfo[];
  private readonly renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  /** Sunlight: casts shadows and follows the character every frame */
  private readonly sun = new DirectionalLight(C.sun, 3.4);
  /** Direction of the sun (unit vector), shared by sky and sunlight */
  private readonly sunDirection = new Vector3().setFromSphericalCoords(
    1,
    MathUtils.degToRad(90 - SUN_ELEVATION),
    MathUtils.degToRad(SUN_AZIMUTH),
  );
  private readonly motes = new DreamMotes();
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(62, 16 / 9, 0.05, 220);
  private readonly cameraLook = new Vector3();
  private readonly raycaster = new Raycaster();
  private readonly world: World;
  private readonly player = new WhaleAvatar();
  private readonly overlay: HubOverlay;
  private readonly sounds: HubSounds | null;
  private readonly keys = new Set<string>();

  private state: State = 'title';
  private visible = false;
  private frameId = 0;
  private lastFrame = 0;
  /** The hub's own clock (s), only for camera paths and small animations */
  private time = 0;

  private position: Point;
  private height = 0;
  private heading: number;
  private walkPhase = 0;
  private walkAmount = 0;
  private yaw: number;
  private pitch = 0.22;
  private boom = BOOM_LENGTH;
  private tween: CameraTween | null = null;

  private focus: HubSpot | null = null;
  private zone: string | null = null;
  private dialogQueue: { name: string; text: string }[] = [];
  private seat: { spot: LevelSpot; from: Point; fromHeading: number; start: number } | null = null;
  /** On the dance machine: from stepping onto its pad until the street shows again after the game */
  private dance: { spot: GameSpot; from: Point; fromHeading: number; start: number } | null = null;
  /** True when we release the pointer ourselves, so no pause menu */
  private releasingPointer = false;
  /** chair-swivel's cutaway is drawing the café (doc/cross-dimension.md) */
  private cutaway: Cutaway | null = null;
  /** The café has been rendered once for the cutaway, so its shaders and textures are ready */
  private cutawayWarm = false;

  constructor(options: HubOptions) {
    this.options = options;
    this.levels = options.levels;
    // A prompt already showing at an arcade machine follows the coin coming and going
    options.cheat.onChange(() => {
      if (this.state === 'roam' && this.focus) this.overlay.setPrompt(this.promptFor(this.focus));
    });
    this.element.className = 'hub';
    this.element.hidden = true;
    this.element.append(this.renderer.domElement);

    this.world = buildWorld(
      options.levels.map((level) => ({
        levelId: level.id,
        sceneId: level.sceneId,
        role: level.role,
        ...MACHINE_LOOKS[level.sceneId],
      })),
    );
    this.world.root.updateMatrixWorld(true);
    this.scene.add(this.world.root, this.player.root);
    this.setUpLighting();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Only things brighter than 1 bloom: emissives tuned for it (crossing beacons, LED board, neon signs,
    // level markers, brightness 4–6) get a soft dreamy glow, while the sky and sunlit white walls (up to about 1.5
    // linear) stay under the threshold so the frame doesn't wash out
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.5, 0.5, 2.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(createDreamGradePass());
    this.scene.add(this.motes.points);

    const { spawn } = this.world;
    this.position = { x: spawn.x, z: spawn.z };
    this.heading = spawn.heading;
    this.yaw = spawn.heading + Math.PI;
    this.placePlayer();

    this.overlay = new HubOverlay(
      {
        onStart: () => this.start(),
        onResume: () => this.resume(),
        onQuitToTitle: () => this.quitToTitle(),
        onPlayLevel: () => this.launch(),
        onStandUp: () => this.standUp(),
        onCloseBooklet: () => this.closeBooklet(),
      },
      { saves: options.saves, finishedLevels: (save) => options.finishedLevels(save) },
    );
    this.element.append(this.overlay.element);
    this.overlay.showTitle(true);
    this.updateObjective();
    this.sounds = options.audio ? new HubSounds(options.audio) : null;
    this.trackLoading();

    new ResizeObserver(() => this.resize()).observe(this.element);
    this.listen();
  }

  /** Shows the hub; returning from a level puts the character back in their seat */
  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.element.hidden = false;
    this.resize();
    this.updateObjective();
    if (this.state === 'launching' && this.seat) {
      this.state = 'seated';
      this.applyPose(this.seatedPose(this.seat.spot));
      this.overlay.showCard(this.levelOf(this.seat.spot), this.recordOf(this.seat.spot));
    }
    if (this.dance) this.leavePad(this.dance.spot);
    this.overlay.setFade(false, FADE_MS);
    this.lastFrame = performance.now();
    this.frameId = requestAnimationFrame(this.loop);
  }

  /** Hides the hub and stops rendering, when a level starts */
  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.element.hidden = true;
    cancelAnimationFrame(this.frameId);
    this.keys.clear();
    if (document.pointerLockElement === this.renderer.domElement) this.releasePointer();
  }

  // ---------- chair-swivel's cutaway (doc/cross-dimension.md) ----------

  /**
   * A round with chair-swivel is starting while a level hides the hub: render the café once, invisibly, so the first
   * spin doesn't stall on the beat compiling shaders and uploading textures.
   */
  prepareCutaway(levelId: string): void {
    if (this.cutawayWarm || this.visible || this.cutaway) return;
    this.element.style.visibility = 'hidden';
    this.renderCutaway(levelId, 0.5, null);
    this.endCutaway();
    this.element.style.visibility = '';
    this.cutawayWarm = true;
  }

  /**
   * One frame of the cutaway at the computer of `levelId`, `progress` (0–1) of the way through. The level calls it
   * every frame from the audio clock; the hub's own loop stays stopped. The first frame seats the character there
   * (even if the level was opened from a URL) and puts `desktop`, the level as it looked, on the monitor.
   */
  renderCutaway(levelId: string, progress: number, desktop: HTMLCanvasElement | null): void {
    if (this.visible) throw new Error('The cutaway only runs while a level hides the hub');
    this.cutaway ??= this.enterCutaway(this.levelSpot(levelId), desktop);
    const { spot } = this.cutaway;
    const { path, spin } = cutawayPhase(progress);
    const stops = [this.monitorPose(spot), this.seatedPose(spot), this.cutawayWidePose(spot)];
    const leg = Math.min(Math.floor(path), stops.length - 2);
    const from = stops[leg]!;
    const to = stops[leg + 1]!;
    const k = path - leg;
    this.applyPose({
      position: from.position.clone().lerp(to.position, k),
      look: from.look.clone().lerp(to.look, k),
    });
    this.player.root.rotation.y = spot.seat.heading + spin;
    spot.chair.rotation.y = spin;
    this.hidePlayerWhenClose();
    this.followSun(this.player.root.position);
    this.composer.render(0);
  }

  /** Back to the level: everything the cutaway moved goes back, and the hub hides again */
  endCutaway(): void {
    this.cutaway?.restore();
    this.cutaway = null;
  }

  private levelSpot(levelId: string): LevelSpot {
    const spot = this.world.spots.find(
      (s): s is LevelSpot => s.kind === 'level' && s.levelId === levelId,
    );
    if (!spot) throw new Error(`No café computer for ${levelId}`);
    return spot;
  }

  private enterCutaway(spot: LevelSpot, desktop: HTMLCanvasElement | null): Cutaway {
    const saved = {
      position: { ...this.position },
      height: this.height,
      heading: this.heading,
      sitting: this.player.isSitting,
      pose: { position: this.camera.position.clone(), look: this.cameraLook.clone() },
      hidden: this.element.hidden,
    };
    const material = spot.screenMaterial;
    const wallpaper: Texture | null = material.emissiveMap;
    const texture = desktop ? monitorTexture(desktop) : null;
    if (texture) material.emissiveMap = texture;

    this.position = { x: spot.seat.x, z: spot.seat.z };
    this.height = 0;
    this.heading = spot.seat.heading;
    this.placePlayer();
    this.player.sit(true);
    this.element.hidden = false;
    this.element.classList.add('is-cutaway');
    this.resize();

    return {
      spot,
      restore: () => {
        spot.chair.rotation.y = 0;
        material.emissiveMap = wallpaper;
        texture?.dispose();
        this.position = saved.position;
        this.height = saved.height;
        this.heading = saved.heading;
        this.placePlayer();
        this.player.sit(saved.sitting);
        this.player.root.visible = true;
        this.applyPose(saved.pose);
        this.element.hidden = saved.hidden;
        this.element.classList.remove('is-cutaway');
      },
    };
  }

  // ---------- Flow ----------

  private start(): void {
    if (this.state !== 'title') return;
    this.state = 'intro';
    this.overlay.showTitle(false);
    this.updateObjective();
    this.overlay.showHud(true);
    this.overlay.setPrompt(null);
    this.yaw = this.heading + Math.PI;
    this.pitch = 0.22;
    this.lockPointer();
    this.tweenCamera(
      () => this.followPose(0),
      INTRO_SECONDS,
      () => {
        this.state = 'roam';
      },
    );
  }

  private quitToTitle(): void {
    this.state = 'title';
    this.tween = null;
    this.overlay.showPause(false);
    this.overlay.showHud(false);
    this.overlay.showTitle(true);
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'roam';
    this.overlay.showPause(false);
    this.lockPointer();
  }

  private interact(spot: HubSpot): void {
    if (spot.kind === 'read') {
      this.state = 'dialog';
      this.dialogQueue = this.readLines(spot).map((text) => ({ name: spot.name, text }));
      this.overlay.setPrompt(null);
      this.nextDialogLine();
      return;
    }
    if (spot.kind === 'guide') {
      this.openBooklet();
      return;
    }
    if (spot.kind === 'game') {
      this.mountPad(spot);
      return;
    }
    this.sit(spot);
  }

  /** The guide booklet (doc/hub.md#guide-booklet): the pointer is freed so the leaflet can be scrolled and closed */
  private openBooklet(): void {
    this.state = 'booklet';
    this.overlay.setPrompt(null);
    this.overlay.setLockHint(false);
    this.releasePointer();
    this.overlay.showBooklet(true);
    this.options.saves.requireCurrent().markBookletRead();
    this.updateObjective();
  }

  /** The top-left objective: the booklet, then a song, then none (doc/hub.md#objectives) */
  private updateObjective(): void {
    // On the title screen there may be no save yet; the objectives only show once one is loaded
    const save = this.options.saves.current;
    if (!save) {
      this.overlay.setObjective(null);
      return;
    }
    const objective = currentObjective(save.bookletRead, save.finished.length > 0);
    this.overlay.setObjective(objective ? OBJECTIVE_TEXT[objective] : null);
  }

  private closeBooklet(): void {
    if (this.state !== 'booklet') return;
    this.state = 'roam';
    this.overlay.showBooklet(false);
    if (this.focus) this.overlay.setPrompt(this.promptFor(this.focus));
    // Closing is a key press or click, so the pointer can be locked again straight away
    this.lockPointer();
    this.overlay.setLockHint(document.pointerLockElement !== this.renderer.domElement);
  }

  /** What a spot says; an arcade machine takes the cheat code's coin when the player has it (doc/cheat-code.md) */
  private readLines(spot: ReadSpot): string[] {
    if (!spot.coinSlot || !this.options.cheat.insertCoin()) return spot.lines;
    this.options.onCoinInserted();
    return [
      'You drop the 10p into the slot. It rattles down inside the machine.',
      'Cheat mode is off. Scores count again.',
    ];
  }

  private nextDialogLine(): void {
    const line = this.dialogQueue.shift() ?? null;
    this.overlay.showDialog(line);
    if (!line) this.state = 'roam';
  }

  private sit(spot: LevelSpot): void {
    this.state = 'sitting';
    this.overlay.setPrompt(null);
    this.overlay.setLockHint(false);
    this.releasePointer();
    this.seat = { spot, from: { ...this.position }, fromHeading: this.heading, start: this.time };
    const level = this.levelOf(spot);
    if (level) this.sounds?.playStartup(level.sceneId);
    this.tweenCamera(
      () => this.seatedPose(spot),
      SIT_SECONDS,
      () => {
        this.state = 'seated';
        this.overlay.showCard(this.levelOf(spot), this.recordOf(spot));
      },
    );
  }

  /**
   * The dance machine's way in from 3D to 2D (doc/dance-machine.md): the character steps onto the pad facing the
   * screen while the camera comes round behind, then the camera pushes into the screen as the view fades and the game
   * opens.
   */
  private mountPad(spot: GameSpot): void {
    this.state = 'mounting';
    this.overlay.setPrompt(null);
    this.overlay.setLockHint(false);
    this.releasePointer();
    this.dance = { spot, from: { ...this.position }, fromHeading: this.heading, start: this.time };
    this.tweenCamera(
      () => this.padPose(spot),
      SIT_SECONDS,
      () => {
        this.state = 'launching';
        this.overlay.setFade(true, LAUNCH_SECONDS * 1000);
        this.tweenCamera(
          () => this.cabinetScreenPose(spot),
          LAUNCH_SECONDS,
          () => this.options.onPlayDance(),
        );
      },
    );
  }

  /** Stepping onto the pad: the character walks from where they stood to its centre and turns to the screen */
  private stepOntoPad(): void {
    const dance = this.dance;
    if (!dance) return;
    const k = smoothstep((this.time - dance.start) / (SIT_SECONDS * 0.7));
    const { x, z, heading } = dance.spot.stand;
    this.position = {
      x: dance.from.x + (x - dance.from.x) * k,
      z: dance.from.z + (z - dance.from.z) * k,
    };
    this.heading = lerpAngle(dance.fromHeading, heading, k);
    this.height = 0;
    this.walkPhase += 0.12 * (1 - k);
    this.player.pose(this.walkPhase, 0.6 * (1 - k));
    this.placePlayer();
  }

  /** Back from the game: standing on the pad, the camera behind, walking again */
  private leavePad(spot: GameSpot): void {
    this.dance = null;
    this.tween = null;
    this.state = 'roam';
    this.position = { x: spot.stand.x, z: spot.stand.z };
    this.heading = spot.stand.heading;
    this.yaw = this.heading + Math.PI;
    this.pitch = 0.22;
    this.placePlayer();
    this.applyPose(this.followPose(0));
    // Hiding the street released the pointer
    this.overlay.setLockHint(document.pointerLockElement !== this.renderer.domElement);
  }

  private standUp(): void {
    if (this.state !== 'seated' || !this.seat) return;
    const { spot } = this.seat;
    this.state = 'standing';
    this.overlay.showCard(null);
    this.player.sit(false);
    // Get up from the chair and step half a pace back into the aisle
    this.position = pushOut(
      { x: spot.seat.x, z: spot.seat.z + 0.55 },
      PLAYER_RADIUS,
      this.world.colliders,
    );
    this.heading = spot.seat.heading;
    this.yaw = this.heading + Math.PI;
    this.pitch = 0.22;
    this.placePlayer();
    this.tweenCamera(
      () => this.followPose(0),
      STAND_SECONDS,
      () => {
        this.state = 'roam';
        this.seat = null;
        this.overlay.setLockHint(document.pointerLockElement !== this.renderer.domElement);
      },
    );
  }

  private launch(): void {
    const seat = this.seat;
    if (this.state !== 'seated' || !seat || !this.levelOf(seat.spot)?.playable) return;
    this.state = 'launching';
    this.overlay.showCard(null);
    this.overlay.setFade(true, LAUNCH_SECONDS * 1000);
    const spot = seat.spot;
    this.tweenCamera(
      () => this.monitorPose(spot),
      LAUNCH_SECONDS,
      () => this.options.onPlay(seat.spot.levelId),
    );
  }

  /**
   * New card contents after charts were imported, saved or deleted (doc/chart-import-export.md). The computers stay
   * (a play computer, an editor and a showcase computer per scene), so `levels` must have the same ids as at construction.
   */
  setLevels(levels: readonly LevelInfo[]): void {
    const ids = (list: readonly LevelInfo[]) => list.map((level) => level.id).join(',');
    if (ids(levels) !== ids(this.levels)) {
      throw new Error(`Hub levels changed from [${ids(this.levels)}] to [${ids(levels)}]`);
    }
    this.levels = levels;
  }

  private levelOf(spot: LevelSpot): LevelInfo | null {
    return this.levels.find((level) => level.id === spot.levelId) ?? null;
  }

  private recordOf(spot: LevelSpot): string | null {
    return this.options.recordOf(spot.levelId);
  }

  // ---------- Input ----------

  private listen(): void {
    const canvas = this.renderer.domElement;

    window.addEventListener('keydown', (event) => {
      if (!this.visible) return;
      // Typing a save name isn't walking or a menu key
      if (event.target instanceof HTMLInputElement) return;
      this.keys.add(event.code);
      if (event.repeat) return;
      switch (event.code) {
        case 'Enter':
        case 'Space':
          // A focused button already takes Enter and Space itself
          if (event.target instanceof HTMLButtonElement) break;
          if (this.state === 'title' && !this.overlay.titleWindowOpen) {
            event.preventDefault();
            this.overlay.pickTitleDefault();
          }
          break;
        case 'KeyE':
          if (this.state === 'roam' && this.focus) this.interact(this.focus);
          else if (this.state === 'dialog') this.nextDialogLine();
          else if (this.state === 'booklet') this.closeBooklet();
          else if (this.state === 'seated') this.launch();
          break;
        case 'Escape':
          if (this.state === 'title') this.overlay.closeTitleWindow();
          else if (this.state === 'seated') this.standUp();
          else if (this.state === 'booklet') this.closeBooklet();
          else if (this.state === 'dialog') {
            this.dialogQueue = [];
            this.nextDialogLine();
          }
          break;
      }
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (this.state === 'roam' && document.pointerLockElement !== canvas) this.lockPointer();
    });

    document.addEventListener('mousemove', (event) => {
      if (document.pointerLockElement !== canvas || this.state !== 'roam') return;
      this.yaw -= event.movementX * MOUSE_YAW;
      this.pitch = clampPitch(this.pitch + event.movementY * MOUSE_PITCH);
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      this.overlay.setLockHint(!locked && (this.state === 'roam' || this.state === 'intro'));
      if (locked) return;
      if (this.releasingPointer) {
        this.releasingPointer = false;
        return;
      }
      // The player released the pointer with Esc
      if (this.visible && this.state === 'roam') {
        this.state = 'paused';
        this.keys.clear();
        this.overlay.setLockHint(false);
        this.overlay.showPause(true);
      }
    });
  }

  private lockPointer(): void {
    const canvas = this.renderer.domElement;
    if (document.pointerLockElement === canvas) return;
    // Some browsers return a promise that rejects (e.g. requesting right after a release); the "click to play" hint stays
    void Promise.resolve(canvas.requestPointerLock()).catch(() => undefined);
  }

  private releasePointer(): void {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    this.releasingPointer = true;
    document.exitPointerLock();
  }

  // ---------- Every frame ----------

  private readonly loop = (now: number) => {
    if (!this.visible) return;
    this.frameId = requestAnimationFrame(this.loop);
    const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.update(dt);
    this.followSun(this.state === 'title' ? this.cameraLook : this.player.root.position);
    this.motes.update(
      this.time,
      this.state === 'title' ? this.cameraLook : this.player.root.position,
    );
    this.composer.render(dt);
  };

  private update(dt: number): void {
    this.world.update(this.time);
    this.player.animate(this.time);

    switch (this.state) {
      case 'title':
        this.player.pose(0, 0);
        this.applyPose(this.titlePose(this.time));
        break;
      case 'roam':
        this.walk(dt);
        this.applyPose(this.followPose(dt));
        break;
      case 'sitting':
        this.settleIntoSeat();
        break;
      case 'mounting':
        this.stepOntoPad();
        break;
      case 'seated':
        this.player.type(this.time);
        break;
      case 'intro':
      case 'paused':
      case 'dialog':
      case 'booklet':
      case 'standing':
      case 'launching':
        this.walkAmount = 0;
        this.player.pose(this.walkPhase, 0);
        if (this.state === 'paused' || this.state === 'dialog' || this.state === 'booklet') {
          this.applyPose(this.followPose(dt));
        }
        break;
    }

    const tween = this.tween;
    if (tween) {
      const k = smoothstep((this.time - tween.start) / tween.duration);
      const to = tween.to();
      this.applyPose({
        position: tween.from.position.clone().lerp(to.position, k),
        look: tween.from.look.clone().lerp(to.look, k),
      });
      if (k >= 1) {
        this.tween = null;
        tween.done();
      }
    }
    this.hidePlayerWhenClose();
  }

  /** Hides the character when the camera is too close, so the back of the head doesn't fill the screen */
  private hidePlayerWhenClose(): void {
    this.player.root.visible =
      this.camera.position.distanceTo(this.player.root.position.clone().setY(this.height + 1.2)) >
      0.7;
  }

  private walk(dt: number): void {
    const direction = moveDirection(
      {
        forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
        back: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
        left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
        right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      },
      this.yaw,
    );
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = running ? RUN_SPEED : WALK_SPEED;
    let targetAmount = 0;
    if (direction) {
      this.position = pushOut(
        {
          x: this.position.x + direction.x * speed * dt,
          z: this.position.z + direction.z * speed * dt,
        },
        PLAYER_RADIUS,
        this.world.colliders,
      );
      this.heading = dampAngle(this.heading, headingOf(direction), 12, dt);
      this.walkPhase += speed * dt * 2.4;
      targetAmount = running ? 1.4 : 1;
    }
    this.walkAmount += (targetAmount - this.walkAmount) * (1 - Math.exp(-10 * dt));
    const ground = this.world.groundHeight(this.position.x, this.position.z);
    this.height += (ground - this.height) * (1 - Math.exp(-18 * dt));
    this.placePlayer();
    this.player.pose(this.walkPhase, this.walkAmount);

    const focus = nearestSpot(this.position, this.world.spots);
    if (focus !== this.focus) {
      this.focus = focus;
      this.overlay.setPrompt(focus ? this.promptFor(focus) : null);
    }

    const zone =
      this.world.zones.find(
        (z) =>
          this.position.x > z.minX &&
          this.position.x < z.maxX &&
          this.position.z > z.minZ &&
          this.position.z < z.maxZ,
      )?.name ?? null;
    if (zone !== this.zone) {
      this.zone = zone;
      if (zone) this.overlay.announcePlace(zone);
    }
  }

  private promptFor(spot: HubSpot): string {
    if (spot.kind === 'read' && spot.coinSlot && this.options.cheat.active) {
      return `Insert 10p · ${spot.name}`;
    }
    if (spot.kind === 'read') return `${spot.verb} · ${spot.name}`;
    if (spot.kind === 'guide') return `Read · ${spot.name}`;
    if (spot.kind === 'game') return `Play · ${spot.name}`;
    const level = this.levelOf(spot);
    return `Sit down · ${level?.label ?? spot.levelId}`;
  }

  /** Sitting down: the character moves from where they stood onto the chair and turns to the screen */
  private settleIntoSeat(): void {
    const seat = this.seat;
    if (!seat) return;
    const k = smoothstep((this.time - seat.start) / (SIT_SECONDS * 0.6));
    const { x, z, heading } = seat.spot.seat;
    this.position = {
      x: seat.from.x + (x - seat.from.x) * k,
      z: seat.from.z + (z - seat.from.z) * k,
    };
    this.heading = lerpAngle(seat.fromHeading, heading, k);
    this.height = 0;
    this.player.sit(k > 0.5);
    if (k <= 0.5) this.player.pose(this.walkPhase + k * 6, 0.6);
    this.placePlayer();
  }

  private placePlayer(): void {
    this.player.root.position.set(this.position.x, this.height, this.position.z);
    this.player.root.rotation.y = this.heading;
  }

  // ---------- Camera ----------

  private applyPose({ position, look }: Pose): void {
    this.camera.position.copy(position);
    this.cameraLook.copy(look);
    this.camera.lookAt(look);
  }

  private tweenCamera(to: () => Pose, duration: number, done: () => void): void {
    this.tween = {
      from: { position: this.camera.position.clone(), look: this.cameraLook.clone() },
      to,
      start: this.time,
      duration,
      done,
    };
  }

  /** Title screen: the camera pans slowly along the street, looking at the north shopfronts */
  private titlePose(t: number): Pose {
    const x = Math.sin(t * 0.045) * 19;
    return {
      position: new Vector3(x, 2.2 + Math.sin(t * 0.11) * 0.3, 1.5),
      look: new Vector3(x * 0.9 + 3, 3.2, -8),
    };
  }

  /** Third person: behind the character, pulling in when it hits a wall */
  private followPose(dt: number): Pose {
    const look = new Vector3(this.position.x, this.height + EYE_HEIGHT, this.position.z);
    const offset = orbitOffset(this.yaw, this.pitch, 1);
    const direction = new Vector3(offset.x, offset.y, offset.z).normalize();
    this.raycaster.set(look, direction);
    this.raycaster.far = BOOM_LENGTH + BOOM_MARGIN;
    const hit = this.raycaster.intersectObjects(this.world.blockers, false)[0];
    const reach = hit ? Math.max(0.3, hit.distance - BOOM_MARGIN) : BOOM_LENGTH;
    // Pull in at once so it never goes through a wall; ease back out so it doesn't jitter
    this.boom =
      reach < this.boom || dt === 0
        ? reach
        : this.boom + (reach - this.boom) * (1 - Math.exp(-5 * dt));
    const position = look.clone().addScaledVector(direction, this.boom);
    position.y = Math.max(position.y, this.height + 0.25);
    return { position, look };
  }

  /** Seated: over the right shoulder, the screen on the left of the frame and the level card on the right */
  private seatedPose(spot: LevelSpot): Pose {
    const { x, z } = spot.seat;
    return {
      position: new Vector3(x + 0.55, 1.78, z + 0.45),
      look: spot.screen.clone().add(new Vector3(0.22, -0.02, 0)),
    };
  }

  /** Right in front of the monitor, where entering a level ends and chair-swivel's cutaway starts and ends */
  private monitorPose(spot: LevelSpot): Pose {
    return { position: spot.screen.clone().add(new Vector3(0, 0, 0.3)), look: spot.screen.clone() };
  }

  /** On the dance pad: behind and above the character, looking past them at the cabinet's screen */
  private padPose(spot: GameSpot): Pose {
    const { x, z } = spot.stand;
    return {
      position: new Vector3(x, 1.95, z + 1.7),
      look: spot.screen.clone().add(new Vector3(0, -0.15, 0)),
    };
  }

  /** Right in front of the cabinet's screen, where the dance machine's 2D game takes over */
  private cabinetScreenPose(spot: GameSpot): Pose {
    return {
      position: spot.screen.clone().add(new Vector3(0, 0, 0.35)),
      look: spot.screen.clone(),
    };
  }

  /** chair-swivel's wide shot: from above and behind, so the whole spin shows */
  private cutawayWidePose(spot: LevelSpot): Pose {
    const { x, z } = spot.seat;
    return {
      position: new Vector3(x, 0, z).add(CUTAWAY_WIDE),
      look: new Vector3(x, CUTAWAY_LOOK_HEIGHT, z),
    };
  }

  /**
   * Loading progress: models and textures go through three's default loading manager, whose counts drive the bar;
   * it hides when everything is done, and later stragglers (such as custom models) don't show it again.
   */
  private trackLoading(): void {
    let done = false;
    this.overlay.setLoading(0);
    DefaultLoadingManager.onProgress = (_url, loaded, total) => {
      if (!done) this.overlay.setLoading(total > 0 ? loaded / total : 0);
    };
    DefaultLoadingManager.onLoad = () => {
      done = true;
      this.overlay.setLoading(null);
    };
  }

  // ---------- Rendering ----------

  /**
   * Bright daylight: a stylised gradient sky as background and environment map, shadowed sunlight with skylight
   * filling the shadows, ACES tone mapping (ADR 0005).
   */
  private setUpLighting(): void {
    const renderer = this.renderer;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene.fog = new Fog(C.fog, 70, 190);
    // Skylight only fills the shadows; stronger, it flattens the sun's and the street looks lit by nothing in particular
    this.scene.add(new HemisphereLight(C.ambientSky, C.ambientGround, 0.75));

    const sun = this.sun;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const camera = sun.shadow.camera;
    camera.left = -SHADOW_RANGE;
    camera.right = SHADOW_RANGE;
    camera.top = SHADOW_RANGE;
    camera.bottom = -SHADOW_RANGE;
    camera.near = 1;
    camera.far = 120;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    // Soften shadow edges
    sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);

    // The stylised sky (dream.ts), rendered once more as the environment map so glass and metal reflect the blue
    this.scene.add(createDreamSky(this.sunDirection, 180));
    const pmrem = new PMREMGenerator(renderer);
    const skyOnly = new Scene();
    skyOnly.add(createDreamSky(this.sunDirection, 180));
    this.scene.environment = pmrem.fromScene(skyOnly, 0.02).texture;
    this.scene.environmentIntensity = 0.9;
    pmrem.dispose();
  }

  /** Shadows cover only the area around the character: the sun and its target follow it (or the title camera) */
  private followSun(center: Vector3): void {
    this.sun.target.position.set(center.x, 0, center.z);
    this.sun.position.copy(this.sunDirection).multiplyScalar(40).add(this.sun.target.position);
  }

  private resize(): void {
    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    if (!(width > 0 && height > 0)) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
