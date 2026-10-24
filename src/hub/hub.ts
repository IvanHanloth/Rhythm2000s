// 街区大厅（doc/hub.md，ADR 0005）：开始界面和选关都在这里。
// 开始界面镜头摇过街道 →「开始游戏」后镜头落到角色身后 → 走进网吧坐到电脑前 → 进入节奏关卡。
// 大厅不做节奏判定，运动用 requestAnimationFrame 的帧时间（每帧间隔有上限），不用音频时钟（ADR 0005）。

import {
  ACESFilmicToneMapping,
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
  Vector3,
  WebGLRenderer,
} from 'three';
import { STREET_COLORS as C } from '@/theme/street.ts';
import { pushOut, type Point } from './collision.ts';
import {
  clampPitch,
  dampAngle,
  headingOf,
  lerpAngle,
  moveDirection,
  nearestSpot,
  orbitOffset,
} from './motion.ts';
import { HubOverlay, type LevelInfo } from './overlay.ts';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createDreamGradePass, createDreamSky, DreamMotes } from './dream.ts';
import { HubSounds } from './sounds.ts';
import { WhaleAvatar } from './whale-model.ts';
import { buildWorld, type HubSpot, type LevelSpot, type ScreenImage, type World } from './world.ts';

export type { LevelInfo } from './overlay.ts';

/** 设备像素比上限：高分屏上不按满分辨率渲染，省一点性能 */
const MAX_PIXEL_RATIO = 1.5;
/** 太阳的高度角和方位角（度）：上午，阳光从东南边斜照进街道 */
const SUN_ELEVATION = 38;
const SUN_AZIMUTH = 150;
/** 阴影只算角色周围这么大的范围（米，半宽） */
const SHADOW_RANGE = 22;
/** 一帧最多算多少秒，切回页面时不会一下子走出很远 */
const MAX_FRAME_SECONDS = 0.05;

const WALK_SPEED = 3.0;
const RUN_SPEED = 5.6;
/** 角色在地面上的半径（米） */
const PLAYER_RADIUS = 0.32;
/** 镜头看点在脚底以上多高 */
const EYE_HEIGHT = 1.45;
/** 镜头离看点的距离 */
const BOOM_LENGTH = 3.6;
/** 镜头碰到墙时，在墙前面留多少距离 */
const BOOM_MARGIN = 0.25;
const MOUSE_YAW = 0.0026;
const MOUSE_PITCH = 0.0022;

const INTRO_SECONDS = 1.6;
const SIT_SECONDS = 0.9;
const STAND_SECONDS = 0.7;
const LAUNCH_SECONDS = 0.8;
const FADE_MS = 600;

/** 每个场景的电脑长什么样；没登记的场景用 XP 画面 */
const MACHINE_LOOKS: Record<string, { screen: ScreenImage; imac?: boolean }> = {
  'windows-xp': { screen: 'xp-bliss' },
  'mac-2000': { screen: 'mac-aqua-blue', imac: true },
};

/**
 * title：开始界面；intro：镜头从开始界面落到角色身后；roam：自由走动；paused：鼠标被放开后的暂停菜单；
 * dialog：看告示、和人说话；sitting / seated / standing：坐下、坐着看关卡卡片、起身；
 * launching：镜头推进屏幕，随后进入关卡。
 */
type State =
  | 'title'
  | 'intro'
  | 'roam'
  | 'paused'
  | 'dialog'
  | 'sitting'
  | 'seated'
  | 'standing'
  | 'launching';

interface Pose {
  position: Vector3;
  look: Vector3;
}

interface CameraTween {
  from: Pose;
  /** 目标每帧重新计算，镜头可以落到一个还在动的位置上 */
  to: () => Pose;
  start: number;
  duration: number;
  done: () => void;
}

export interface HubOptions {
  /** 网吧里的入口电脑（每个场景一台），按顺序摆进网吧（cafe-layout.ts） */
  levels: readonly LevelInfo[];
  /** 坐下后按「开始」：进入这一关 */
  onPlay(levelId: string): void;
  /** 这一关的最佳成绩（一行文字）；还没打过时为 null */
  recordOf(levelId: string): string | null;
  /** 用来播放坐下时的开机声；不给时大厅没有声音 */
  audio?: AudioContext;
}

function smoothstep(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

export class Hub {
  readonly element = document.createElement('div');
  private readonly options: HubOptions;
  private readonly renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  /** 阳光：投射阴影，光源每帧跟着角色走 */
  private readonly sun = new DirectionalLight(C.sun, 2.6);
  /** 太阳所在的方向（单位向量），天空和阳光共用 */
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
  /** 大厅自己的时间（秒），只用于镜头路线和小动画 */
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
  /** 我们自己放开鼠标时为 true，这时不弹暂停菜单 */
  private releasingPointer = false;

  constructor(options: HubOptions) {
    this.options = options;
    this.element.className = 'hub';
    this.element.hidden = true;
    this.element.append(this.renderer.domElement);

    this.world = buildWorld(
      options.levels.map((level) => ({
        levelId: level.id,
        sceneId: level.sceneId,
        ...(MACHINE_LOOKS[level.sceneId] ?? { screen: 'xp-bliss' }),
      })),
    );
    this.world.root.updateMatrixWorld(true);
    this.scene.add(this.world.root, this.player.root);
    this.setUpLighting();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // 只有亮度超过 1 的东西（灯箱招牌、屏幕、亮着的窗）才发出辉光
    // 辉光只给专门调亮的自发光（斑马线闪灯、LED 屏、霓虹灯牌、关卡标记，亮度 4～6），带一点梦一样的柔光；
    // 天空和被阳光照亮的白墙（线性亮度最多 1.5 左右）都在阈值以下，否则整个画面会糊成一片白（2026-10-24 实测）
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

    this.overlay = new HubOverlay({
      onStart: () => this.start(),
      onResume: () => this.resume(),
      onQuitToTitle: () => this.quitToTitle(),
      onPlayLevel: () => this.launch(),
      onStandUp: () => this.standUp(),
    });
    this.element.append(this.overlay.element);
    this.overlay.showTitle(true);
    this.sounds = options.audio ? new HubSounds(options.audio) : null;
    this.trackLoading();

    new ResizeObserver(() => this.resize()).observe(this.element);
    this.listen();
  }

  /** 显示大厅。从关卡回来时回到原来的座位 */
  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.element.hidden = false;
    this.resize();
    if (this.state === 'launching' && this.seat) {
      this.state = 'seated';
      this.applyPose(this.seatedPose(this.seat.spot));
      this.overlay.showCard(this.levelOf(this.seat.spot), this.recordOf(this.seat.spot));
    }
    this.overlay.setFade(false, FADE_MS);
    this.lastFrame = performance.now();
    this.frameId = requestAnimationFrame(this.loop);
  }

  /** 藏起大厅、停止渲染，进入关卡时调用 */
  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.element.hidden = true;
    cancelAnimationFrame(this.frameId);
    this.keys.clear();
    if (document.pointerLockElement === this.renderer.domElement) this.releasePointer();
  }

  // ---------- 流程 ----------

  private start(): void {
    if (this.state !== 'title') return;
    this.state = 'intro';
    this.overlay.showTitle(false);
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
      this.dialogQueue = spot.lines.map((text) => ({ name: spot.name, text }));
      this.overlay.setPrompt(null);
      this.nextDialogLine();
      return;
    }
    this.sit(spot);
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

  private standUp(): void {
    if (this.state !== 'seated' || !this.seat) return;
    const { spot } = this.seat;
    this.state = 'standing';
    this.overlay.showCard(null);
    this.player.sit(false);
    // 从椅子上站起来，往过道退半步
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
    const screen = seat.spot.screen;
    this.tweenCamera(
      () => ({ position: screen.clone().add(new Vector3(0, 0, 0.3)), look: screen.clone() }),
      LAUNCH_SECONDS,
      () => this.options.onPlay(seat.spot.levelId),
    );
  }

  private levelOf(spot: LevelSpot): LevelInfo | null {
    return this.options.levels.find((level) => level.id === spot.levelId) ?? null;
  }

  private recordOf(spot: LevelSpot): string | null {
    return this.options.recordOf(spot.levelId);
  }

  // ---------- 输入 ----------

  private listen(): void {
    const canvas = this.renderer.domElement;

    window.addEventListener('keydown', (event) => {
      if (!this.visible) return;
      this.keys.add(event.code);
      if (event.repeat) return;
      switch (event.code) {
        case 'Enter':
        case 'Space':
          if (this.state === 'title') {
            event.preventDefault();
            this.start();
          }
          break;
        case 'KeyE':
          if (this.state === 'roam' && this.focus) this.interact(this.focus);
          else if (this.state === 'dialog') this.nextDialogLine();
          else if (this.state === 'seated') this.launch();
          break;
        case 'Escape':
          if (this.state === 'seated') this.standUp();
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
      // 玩家按 Esc 放开了鼠标
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
    // 有的浏览器返回 Promise，被拒绝时（例如刚放开鼠标马上又请求）留着「点击画面」的提示就好
    void Promise.resolve(canvas.requestPointerLock()).catch(() => undefined);
  }

  private releasePointer(): void {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    this.releasingPointer = true;
    document.exitPointerLock();
  }

  // ---------- 每帧 ----------

  private readonly loop = (now: number) => {
    if (!this.visible) return;
    this.frameId = requestAnimationFrame(this.loop);
    const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.update(dt);
    this.followSun();
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
      case 'seated':
        this.player.type(this.time);
        break;
      case 'intro':
      case 'paused':
      case 'dialog':
      case 'standing':
      case 'launching':
        this.walkAmount = 0;
        this.player.pose(this.walkPhase, 0);
        if (this.state === 'paused' || this.state === 'dialog') this.applyPose(this.followPose(dt));
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
    // 镜头离角色太近时把角色藏起来，免得画面被后脑勺挡住
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
    if (spot.kind === 'read') return `${spot.verb} · ${spot.name}`;
    const level = this.levelOf(spot);
    return `Sit down · ${level?.label ?? spot.levelId}`;
  }

  /** 坐下的过程：角色从站的地方挪到椅子上，转身面对屏幕 */
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

  // ---------- 镜头 ----------

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

  /** 开始界面：镜头沿街道来回慢慢平移，看向北侧的店面 */
  private titlePose(t: number): Pose {
    const x = Math.sin(t * 0.045) * 19;
    return {
      position: new Vector3(x, 2.2 + Math.sin(t * 0.11) * 0.3, 1.5),
      look: new Vector3(x * 0.9 + 3, 3.2, -8),
    };
  }

  /** 第三人称：镜头在角色身后，碰到墙就往前收 */
  private followPose(dt: number): Pose {
    const look = new Vector3(this.position.x, this.height + EYE_HEIGHT, this.position.z);
    const offset = orbitOffset(this.yaw, this.pitch, 1);
    const direction = new Vector3(offset.x, offset.y, offset.z).normalize();
    this.raycaster.set(look, direction);
    this.raycaster.far = BOOM_LENGTH + BOOM_MARGIN;
    const hit = this.raycaster.intersectObjects(this.world.blockers, false)[0];
    const reach = hit ? Math.max(0.3, hit.distance - BOOM_MARGIN) : BOOM_LENGTH;
    // 往里收要立刻收，免得穿墙；往外放慢一点，免得镜头一跳一跳
    this.boom =
      reach < this.boom || dt === 0
        ? reach
        : this.boom + (reach - this.boom) * (1 - Math.exp(-5 * dt));
    const position = look.clone().addScaledVector(direction, this.boom);
    position.y = Math.max(position.y, this.height + 0.25);
    return { position, look };
  }

  /** 坐下后：从右肩后面看屏幕，屏幕偏在画面左边，右边留给关卡卡片 */
  private seatedPose(spot: LevelSpot): Pose {
    const { x, z } = spot.seat;
    return {
      position: new Vector3(x + 0.55, 1.78, z + 0.45),
      look: spot.screen.clone().add(new Vector3(0.22, -0.02, 0)),
    };
  }

  /**
   * 加载进度：模型、贴图都走 three 的默认加载管理器，按它的计数显示进度条；
   * 全部完成后收起。之后再有零星的加载（例如自制模型）不再显示。
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

  // ---------- 渲染设置 ----------

  /**
   * 明亮的白天：风格化的渐变天空当背景，同一片天空生成环境反射；阳光带阴影，天光把阴影照亮，
   * ACES 色调映射。之前是黄昏的 HDRI，2026-10-24 用户觉得太暗，改成现在这样（ADR 0005 修订）。
   */
  private setUpLighting(): void {
    const renderer = this.renderer;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene.fog = new Fog(C.fog, 55, 170);
    this.scene.add(new HemisphereLight(C.ambientSky, C.ambientGround, 1.3));

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
    // 阴影边缘柔一点
    sun.shadow.radius = 4;
    this.scene.add(sun, sun.target);

    // 风格化的渐变天空（dream.ts），同一片天空单独渲染一次生成环境反射，玻璃和金属会映出蓝天
    this.scene.add(createDreamSky(this.sunDirection, 180));
    const pmrem = new PMREMGenerator(renderer);
    const skyOnly = new Scene();
    skyOnly.add(createDreamSky(this.sunDirection, 180));
    this.scene.environment = pmrem.fromScene(skyOnly, 0.02).texture;
    this.scene.environmentIntensity = 1.5;
    pmrem.dispose();
  }

  /** 阴影只覆盖角色附近：阳光的位置和目标每帧跟着角色（或开始界面的镜头）平移 */
  private followSun(): void {
    const center = this.state === 'title' ? this.cameraLook : this.player.root.position;
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
