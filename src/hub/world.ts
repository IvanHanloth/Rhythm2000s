// 街区的全部布景：2000 年英国商业街（High Street）的黄昏，北侧三家能进的店（唱片行、网吧、街机厅），
// 南侧是不能进的楼和街边设施。英国元素是 2026-10-24 用户的要求（项目参加英国的黑客松）。
// 布局、店名、文案都是第一版占位（doc/hub.md「暂定内容」）。场景里的招牌、海报一律用英文（2026-10-24 用户要求）。
// 写实风格：墙面、地面用 PBR 照片贴图，道具用现成模型（assets.ts）；需要定制的道具先用简单形体占位，
// 等用户用 Tripo / Blender 做好后放进 public/models/custom/（规格见 doc/hub-assets.md）。
// 坐标：x 沿街道（西负东正），z 从北向南，y 向上，单位米。马路在 |z| < 4，两侧人行道到 |z| = 7。

import type { SceneId } from '@/scenes/catalog.ts';
import {
  BoxGeometry,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { STREET_COLORS as C } from '@/theme/street.ts';
import { attachCustom, attachModel, surface, type PropOptions } from './assets.ts';
import { SEAT_HEIGHT } from './character.ts';
import { arrangeMachines } from './cafe-layout.ts';
import { boxAt, type Box } from './collision.ts';
import type { Spot } from './motion.ts';
import { ledTexture, posterTexture, signTexture } from './textures.ts';

/** 人行道比马路高出的高度 */
const CURB_HEIGHT = 0.12;
const ROAD_HALF_WIDTH = 4;
const SIDEWALK_EDGE = 7;
/** 街道两头的路障 */
const STREET_END = 33;
/** 店面一层的层高 */
const STOREY = 3.4;
/** 楼上每层的层高 */
const UPPER_STOREY = 3.0;
const WALL = 0.25;
const DOOR_HALF_WIDTH = 0.9;
const DOOR_HEIGHT = 2.5;

/** 坐到电脑前开始关卡 */
export interface LevelSpot extends Spot {
  kind: 'level';
  /** 关卡 id（谱面 id） */
  levelId: string;
  /** 坐下后角色的位置和朝向 */
  seat: { x: number; z: number; heading: number };
  /** 屏幕中心（世界坐标），镜头最后推进到这里；自制电脑模型加载后会更新 */
  screen: Vector3;
}

/** 看一眼、说句话：显示几行文字 */
export interface ReadSpot extends Spot {
  kind: 'read';
  /** 提示里的动词，例如「Examine」 */
  verb: string;
  name: string;
  lines: string[];
}

export type HubSpot = LevelSpot | ReadSpot;

/** 一家店的范围，进门时显示店名 */
export interface Zone extends Box {
  name: string;
}

export interface World {
  root: Group;
  /** 角色不能穿过的东西 */
  colliders: Box[];
  /** 镜头不能穿过的东西（墙、天花板、楼） */
  blockers: Object3D[];
  spots: HubSpot[];
  zones: Zone[];
  /** 出生点：街道西头，面朝东 */
  spawn: { x: number; z: number; heading: number };
  /** 脚下地面的高度：马路比人行道低一个路沿 */
  groundHeight(x: number, z: number): number;
  /** 每帧调用，t 单位是秒：提示标记上下浮动 */
  update(t: number): void;
}

/** 显示器画面：用原版系统壁纸（assets/reference/，ADR 0004）缩小后的图 */
export type ScreenImage = 'xp-bliss' | 'xp-azul' | 'xp-autumn' | 'xp-desert' | 'mac-aqua-blue';

/** 入口电脑：每个场景一台，坐下后进这个场景的关卡列表（场景 id 见 src/scenes/catalog.ts） */
export interface LevelMachine {
  levelId: string;
  sceneId: SceneId;
  /** 屏幕上显示的壁纸（public/textures/screens/） */
  screen: ScreenImage;
  /** 半透明外壳的一体机；否则是米色 CRT */
  imac?: boolean;
}

interface BoxOptions {
  /** 角色撞得上 */
  solid?: boolean;
  /** 挡镜头；默认和 solid 一样 */
  blockCamera?: boolean;
  /** 投射阴影，默认 true */
  castShadow?: boolean;
}

/** UV 以米为单位的长方体：配合 surface() 的平铺，砖块大小和墙的大小无关 */
function meterBox(w: number, h: number, d: number): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv!;
  // 六个面依次是 +x、-x、+y、-y、+z、-z，每面 4 个顶点
  const faces: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  faces.forEach(([u, v], face) => {
    for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  });
  return geometry;
}

function meterPlane(w: number, h: number): BufferGeometry {
  const geometry = new PlaneGeometry(w, h);
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return geometry;
}

/** 占位形体用的长方体：(x, z) 是底面中心，y 是底面高度 */
function placeholderBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: Material,
): Mesh {
  const mesh = new Mesh(meterBox(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

const screenLoader = new TextureLoader();

class Builder {
  readonly root = new Group();
  readonly colliders: Box[] = [];
  readonly blockers: Object3D[] = [];
  readonly spots: HubSpot[] = [];
  readonly zones: Zone[] = [];
  readonly animations: ((t: number) => void)[] = [];
  /** 楼面上的窗户，最后合成几个 InstancedMesh */
  private readonly windows: { matrix: Matrix4; lit: boolean }[] = [];
  private readonly plainCache = new Map<string, MeshStandardMaterial>();

  /** 没有贴图的写实材质：塑料、金属、漆面 */
  plain(color: string, roughness = 0.7, metalness = 0): MeshStandardMaterial {
    const key = `${color}/${roughness}/${metalness}`;
    let m = this.plainCache.get(key);
    if (!m)
      this.plainCache.set(key, (m = new MeshStandardMaterial({ color, roughness, metalness })));
    return m;
  }

  /** 自己发光的面（灯箱招牌、屏幕、灯）：亮度大于 1 时会被辉光效果放大 */
  glow(map: Texture | null, color: string, intensity: number): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color: '#000000',
      emissive: color,
      emissiveMap: map,
      emissiveIntensity: intensity,
      roughness: 0.4,
    });
  }

  screen(image: ScreenImage): MeshStandardMaterial {
    const map = screenLoader.load(`${import.meta.env.BASE_URL}textures/screens/${image}.webp`);
    map.colorSpace = SRGBColorSpace;
    return this.glow(map, '#ffffff', 1.1);
  }

  /** 长方体：(x, z) 是底面中心，y 是底面高度 */
  box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: Material | Material[],
    options: BoxOptions = {},
  ): Mesh {
    const mesh = new Mesh(meterBox(w, h, d), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    const solid = options.solid ?? false;
    if (solid) this.colliders.push(boxAt(x, z, w, d));
    if (options.blockCamera ?? solid) this.blockers.push(mesh);
    return mesh;
  }

  /**
   * 竖着的面板（招牌、海报、横幅），整张图铺满一块，UV 是 0 到 1。
   * facing 是它朝向的角度：0 朝 +z（南），π 朝 -z（北）
   */
  panel(
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    facing: number,
    material: Material,
  ): Mesh {
    const mesh = new Mesh(new PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = facing;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  /** 平铺在地上的面 */
  floor(w: number, d: number, x: number, y: number, z: number, material: Material): Mesh {
    const mesh = new Mesh(meterPlane(w, d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  light(color: string, intensity: number, x: number, y: number, z: number, distance = 0): void {
    const light = new PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    this.root.add(light);
  }

  /** 现成模型（public/models/props/）：放在 (x, y, z)，可选碰撞盒 */
  prop(
    name: string,
    x: number,
    y: number,
    z: number,
    options: PropOptions & { collider?: [number, number] } = {},
  ): void {
    const anchor = new Group();
    anchor.position.set(x, y, z);
    this.root.add(anchor);
    attachModel(anchor, `props/${name}.glb`, options);
    if (options.collider) this.colliders.push(boxAt(x, z, ...options.collider));
  }

  /** 自制模型槽位：先放占位形体（在锚点坐标系里搭），自制模型到了就替换 */
  custom(
    slot: string,
    x: number,
    z: number,
    rotation: number,
    buildPlaceholder: (placeholder: Group) => void,
    onLoaded?: (model: Object3D) => void,
  ): void {
    const anchor = new Group();
    anchor.position.set(x, 0, z);
    this.root.add(anchor);
    const placeholder = new Group();
    placeholder.rotation.y = rotation;
    buildPlaceholder(placeholder);
    placeholder.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    attachCustom(anchor, slot, placeholder, { rotation, onLoaded });
  }

  read(name: string, verb: string, x: number, z: number, lines: string[], reach = 1.2): void {
    this.spots.push({ kind: 'read', name, verb, x, z, reach, lines });
  }

  /** 在楼面上开窗：从 x0 到 x1、从高度 y0 起 floors 层；z 是墙面位置，facing 是墙面朝向（+1 朝南，-1 朝北） */
  windowGrid(
    x0: number,
    x1: number,
    y0: number,
    floors: number,
    z: number,
    facing: 1 | -1,
    seed: number,
  ): void {
    const columns = Math.floor((x1 - x0) / 2.2);
    if (columns <= 0) return;
    const step = (x1 - x0) / columns;
    let s = seed;
    const random = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let floor = 0; floor < floors; floor++) {
      for (let col = 0; col < columns; col++) {
        const matrix = new Matrix4().makeTranslation(
          x0 + step * (col + 0.5),
          y0 + floor * UPPER_STOREY + UPPER_STOREY * 0.5,
          z + facing * 0.03,
        );
        if (facing < 0) matrix.multiply(new Matrix4().makeRotationY(Math.PI));
        this.windows.push({ matrix, lit: random() < 0.4 });
      }
    }
  }

  /** 把所有窗户合成三个 InstancedMesh：窗框、暗着的玻璃、亮灯的玻璃 */
  flushWindows(): void {
    const lit = this.windows.filter((w) => w.lit);
    const dark = this.windows.filter((w) => !w.lit);
    const frames = new InstancedMesh(
      meterBox(1.3, 1.55, 0.06),
      this.plain(C.metal, 0.5, 0.6),
      this.windows.length,
    );
    const glass = new PlaneGeometry(1.15, 1.4);
    const litGlass = new InstancedMesh(glass, this.glow(null, '#ffffff', 0.75), lit.length);
    const darkGlass = new InstancedMesh(
      glass,
      new MeshStandardMaterial({ color: C.windowDark, roughness: 0.08, metalness: 0.3 }),
      dark.length,
    );
    // 玻璃比窗框往外凸一点点，避免和窗框抢深度
    const nudge = new Matrix4().makeTranslation(0, 0, 0.035);
    this.windows.forEach((w, i) => frames.setMatrixAt(i, w.matrix));
    lit.forEach((w, i) => litGlass.setMatrixAt(i, w.matrix.clone().multiply(nudge)));
    dark.forEach((w, i) => darkGlass.setMatrixAt(i, w.matrix.clone().multiply(nudge)));
    // 亮灯的窗户颜色略有差别，看起来是不同人家
    const tints = [C.windowLit, '#ffe7b8', '#fff3d8', '#ffc98a'];
    lit.forEach((_, i) => litGlass.setColorAt(i, new Color(tints[i % tints.length]!)));
    for (const mesh of [frames, litGlass, darkGlass]) {
      mesh.receiveShadow = true;
      this.root.add(mesh);
    }
  }
}

export function buildWorld(levels: readonly LevelMachine[]): World {
  const b = new Builder();
  buildStreet(b);
  buildSouthSide(b);
  buildMusicShop(b, -16);
  buildInternetCafe(b, 0, levels);
  buildArcade(b, 16);
  buildFillers(b);
  buildMillennium(b);
  b.flushWindows();

  return {
    root: b.root,
    colliders: b.colliders,
    blockers: b.blockers,
    spots: b.spots,
    zones: b.zones,
    spawn: { x: -27, z: -5.4, heading: Math.PI / 2 },
    groundHeight: (x, z) =>
      Math.abs(z) < ROAD_HALF_WIDTH && Math.abs(x) < STREET_END + 4 ? -CURB_HEIGHT : 0,
    update: (t) => {
      for (const animate of b.animations) animate(t);
    },
  };
}

// ---------- 街道 ----------

function buildStreet(b: Builder): void {
  const length = (STREET_END + 8) * 2;
  b.floor(240, 240, 0, -CURB_HEIGHT - 0.01, 0, surface('asphalt_02', { tile: 4, tint: '#8a8a8a' }));
  b.floor(length, ROAD_HALF_WIDTH * 2, 0, -CURB_HEIGHT, 0, surface('asphalt_02', { tile: 3 }));

  // 路面标线
  const paint = b.plain(C.roadLine, 0.6);
  for (let x = -STREET_END - 6; x < STREET_END + 6; x += 4) {
    if (Math.abs(x) < 3) continue;
    b.floor(2, 0.14, x + 1, -CURB_HEIGHT + 0.004, 0, paint);
  }
  for (let z = -2.6; z <= 2.65; z += 0.75) b.floor(3, 0.4, 0, -CURB_HEIGHT + 0.004, z, paint);

  // 英国街道：路边的双黄线（禁止停车），斑马线前写着 LOOK RIGHT（靠左行驶，两边路沿最近的车道都是从右边来车）
  const yellow = b.plain(C.roadYellow, 0.6);
  for (const side of [-1, 1]) {
    for (const offset of [0.25, 0.4]) {
      b.floor(length, 0.08, 0, -CURB_HEIGHT + 0.004, side * (ROAD_HALF_WIDTH - offset), yellow);
    }
    // 路面上的字只有白漆，没有底色
    const look = signTexture({
      text: 'LOOK RIGHT',
      background: 'transparent',
      color: C.roadLine,
      width: 512,
      height: 96,
    });
    const text = b.floor(
      2.4,
      0.45,
      0,
      -CURB_HEIGHT + 0.006,
      side * (ROAD_HALF_WIDTH - 0.6),
      new MeshStandardMaterial({ map: look, transparent: true, roughness: 0.8 }),
    );
    // 让站在这一侧路沿、面朝马路的人读起来是正的
    if (side < 0) text.rotation.z = Math.PI;
  }

  // 斑马线两头的黄色闪灯（自制槽位 belisha-beacon）：黑白条纹杆子顶着一个黄色灯球，一秒亮一次
  const beaconLights: MeshStandardMaterial[] = [];
  for (const [bx, bz] of [
    [-1.9, -4.3],
    [1.9, -4.3],
    [-1.9, 4.3],
    [1.9, 4.3],
  ] as const) {
    const globe = b.glow(null, C.beaconAmber, 5);
    beaconLights.push(globe);
    b.custom('belisha-beacon', bx, bz, 0, (p) => {
      for (let k = 0; k < 6; k++) {
        const stripe = k % 2 === 0 ? b.plain(C.signTextDark, 0.5) : b.plain(C.signText, 0.5);
        p.add(placeholderBox(0.1, 0.4, 0.1, 0, k * 0.4, 0, stripe));
      }
      const ball = new Mesh(new SphereGeometry(0.17, 16, 12), globe);
      ball.position.y = 2.55;
      p.add(ball);
    });
    b.colliders.push(boxAt(bx, bz, 0.25, 0.25));
  }
  b.animations.push((t) => {
    const on = t % 1 < 0.5;
    for (const light of beaconLights) light.emissiveIntensity = on ? 5 : 0.15;
  });

  // 人行道和路沿
  const sidewalkWidth = SIDEWALK_EDGE - ROAD_HALF_WIDTH;
  const pavers = surface('square_concrete_pavers', { tile: 1.6 });
  const curb = surface('painted_plaster_wall', { tile: 1, tint: '#b8b2a6' });
  for (const side of [-1, 1]) {
    const z = side * (ROAD_HALF_WIDTH + sidewalkWidth / 2);
    b.floor(length, sidewalkWidth, 0, 0, z, pavers);
    b.box(length, CURB_HEIGHT, 0.2, 0, -CURB_HEIGHT, side * (ROAD_HALF_WIDTH + 0.1), curb, {
      castShadow: false,
    });
  }

  // 井盖
  for (const x of [-18, 6, 22]) b.prop('water_manhole_cover', x, -CURB_HEIGHT, 1.8, { width: 0.7 });

  // 路灯：北侧四盏、南侧三盏。白天不亮
  const lamps: [number, number][] = [
    [-24, -4.6],
    [-8, -4.6],
    [8, -4.6],
    [24, -4.6],
    [-16, 4.6],
    [0, 4.6],
    [16, 4.6],
  ];
  for (const [x, z] of lamps) {
    b.prop('street_lamp_01', x, 0, z, { height: 4.2, collider: [0.35, 0.35] });
  }

  // 街边：垃圾桶、配电箱
  b.prop('metal_trash_can', -20, 0, -4.7, { width: 1.4, collider: [1.4, 0.5] });
  b.prop('metal_trash_can', 12, 0, 4.7, { width: 1.4, rotation: Math.PI, collider: [1.4, 0.5] });
  b.prop('utility_box_01', -12.6, 0, -6.6, { height: 1.1, collider: [0.55, 0.45] });
  b.prop('utility_box_01', 27, 0, 6.6, { height: 1.1, rotation: Math.PI, collider: [0.55, 0.45] });

  // 街道两头的施工路障，后面再挡一栋楼
  const barrier = b.plain(C.signYellow, 0.5);
  const closed = signTexture({
    text: 'ROAD CLOSED',
    sub: 'DETOUR →',
    background: C.signRed,
    width: 256,
    height: 96,
  });
  const farWall = surface('red_brick_03', { tile: 2, tint: '#e8d8d0' });
  for (const side of [-1, 1]) {
    const x = side * STREET_END;
    b.box(0.3, 1.1, SIDEWALK_EDGE * 2, x, -CURB_HEIGHT, 0, barrier, { solid: true });
    b.panel(
      2.4,
      0.9,
      x - side * 0.16,
      0.65,
      0,
      -side * (Math.PI / 2),
      b.glow(closed, '#ffffff', 1.2),
    );
    b.box(4, 16, 60, x + side * 6, -CURB_HEIGHT, 0, farWall, { blockCamera: true });
  }
}

// ---------- 南侧：不能进的楼面和街边设施 ----------

function buildSouthSide(b: Builder): void {
  // 英国商业街：维多利亚式红砖楼为主，夹着刷了涂料的楼和一栋 60 年代的贴砖楼
  const facades = [
    surface('red_brick_03', { tile: 2 }),
    surface('painted_plaster_wall', { tile: 2.5, tint: '#e2d3b0' }),
    surface('red_brick_03', { tile: 2, tint: '#c9a89a' }),
    surface('rectangular_facade_tiles', { tile: 2, tint: '#d8d4cc' }),
    surface('painted_plaster_wall', { tile: 2.5, tint: '#c8d4dc' }),
  ];
  const shutter = surface('painted_metal_shutter', { tile: 2 });
  // 2000 年前后英国商业街上常见的店：录像出租、手机话费、一小时冲印、报刊店、炸鱼薯条、投注站……
  const shopSigns = [
    'VIDEO & DVD RENTAL',
    'MOBILE PHONES',
    '1-HOUR PHOTO',
    'NEWSAGENT',
    'FISH & CHIPS',
    'COMPUTER SUPERSTORE',
    'BOOKMAKERS',
    'OFF LICENCE',
  ];
  // 卷帘门上贴的小广告
  const flyers: [string[], string, string][] = [
    [['PC 2000', 'PIII 600', '128MB RAM', '£899'], C.signText, C.signBlue],
    [['PAY AS', 'YOU GO', 'TOP UP HERE'], C.signYellow, C.signRed],
    [['RINGTONES', 'POLYPHONIC', 'TEXT NOW'], C.neonPink, C.signText],
    [['FLASH', 'GAMES', 'FREE CD-R'], C.signGreen, C.signText],
    [['DIGITAL', 'CAMERA', '1.3 MP'], C.signText, C.signRed],
    [['VIDEO', 'RENTAL', '£2.50 NIGHT'], C.signBlue, C.signYellow],
  ];
  let x = -STREET_END - 3;
  let i = 0;
  while (x < STREET_END + 3) {
    const width = 7 + ((i * 3) % 5);
    const floors = 2 + ((i * 2) % 4);
    const height = STOREY + floors * UPPER_STOREY;
    const cx = x + width / 2;
    b.box(width, height, 12, cx, 0, SIDEWALK_EDGE + 6, facades[i % facades.length]!, {
      solid: true,
    });
    b.windowGrid(x + 0.4, x + width - 0.4, STOREY, floors, SIDEWALK_EDGE, -1, 11 + i * 7);
    // 一层的店面：卷帘门 + 灯箱招牌
    b.box(width - 1, 2.6, 0.08, cx, 0, SIDEWALK_EDGE - 0.04, shutter);
    for (let k = 0; k < 2; k++) {
      const [lines, background, color] = flyers[(i * 2 + k) % flyers.length]!;
      const fx = cx - width / 2 + 1.2 + k * 0.9 + (i % 3) * 0.4;
      b.panel(
        0.6,
        0.8,
        fx,
        1.3 + (k % 2) * 0.15,
        SIDEWALK_EDGE - 0.09,
        Math.PI,
        b.glow(posterTexture(lines, background, color), '#ffffff', 0.3),
      );
    }
    const signWidth = Math.min(width - 1.5, 4);
    const sign = signTexture({
      text: shopSigns[i % shopSigns.length]!,
      background: [C.signBlue, C.signRed, C.signGreen][i % 3]!,
      width: 256,
      height: 64,
    });
    b.box(signWidth, 0.8, 0.15, cx, 2.75, SIDEWALK_EDGE - 0.1, b.plain(C.metalDark, 0.5, 0.5));
    b.panel(
      signWidth - 0.1,
      0.7,
      cx,
      3.15,
      SIDEWALK_EDGE - 0.18,
      Math.PI,
      b.glow(sign, '#ffffff', 1.05),
    );
    x += width;
    i++;
  }

  // 屋顶广告牌
  const billboard = signTexture({
    text: 'BROADBAND 512K',
    sub: '£29.99 / MONTH · GOODBYE DIAL-UP',
    background: C.signBlue,
    border: C.signYellow,
  });
  b.panel(10, 2.5, 4, 13.5, SIDEWALK_EDGE + 1, Math.PI, b.glow(billboard, '#ffffff', 1.1));
  for (const dx of [-3.5, 3.5])
    b.box(0.2, 3, 0.2, 4 + dx, 10.5, SIDEWALK_EDGE + 1.2, b.plain(C.metalDark, 0.5, 0.7));

  // 报摊（自制槽位 newsstand）
  const kx = -9;
  const kz = 5.6;
  b.custom('newsstand', kx, kz, Math.PI, (p) => {
    const green = b.plain(C.signGreen, 0.5, 0.3);
    p.add(placeholderBox(2.2, 2.3, 1.4, 0, 0, 0, green));
    p.add(placeholderBox(2.6, 0.12, 1.9, 0, 2.3, 0.15, green));
  });
  b.colliders.push(boxAt(kx, kz, 2.2, 1.4));
  b.read('Newsstand', 'Examine', kx, kz - 1.3, [
    'The evening paper\'s front page: "MILLENNIUM BUG A NO-SHOW".',
    'Tucked beside it are a few free CD-ROMs off computer magazines, their covers bleached by the sun.',
  ]);

  // 红色电话亭（自制槽位 phone-box）和红色邮筒（自制槽位 pillar-box）
  const px = 4.5;
  const pz = 5.7;
  b.custom('phone-box', px, pz, Math.PI, (p) => {
    const red = b.plain(C.postRed, 0.45);
    p.add(placeholderBox(1.0, 2.4, 1.0, 0, 0, 0, red));
    p.add(placeholderBox(1.06, 0.12, 1.06, 0, 2.4, 0, red));
    p.add(placeholderBox(0.7, 1.5, 0.02, 0, 0.6, 0.51, b.plain(C.windowDark, 0.1, 0.2)));
    const label = signTexture({
      text: 'TELEPHONE',
      background: C.signTextDark,
      width: 256,
      height: 48,
    });
    const sign = new Mesh(new PlaneGeometry(0.8, 0.15), b.glow(label, '#ffffff', 1.2));
    sign.position.set(0, 2.25, 0.511);
    p.add(sign);
  });
  b.colliders.push(boxAt(px, pz, 1.0, 1.0));
  b.read('Phone box', 'Examine', px, pz - 0.8, [
    "A red phone box. The slot only takes 10p and 20p coins. All you've got is a fiver.",
  ]);
  const mx = -17;
  const mz = 5.9;
  b.custom('pillar-box', mx, mz, Math.PI, (p) => {
    const body = new Mesh(new CylinderGeometry(0.26, 0.28, 1.35, 20), b.plain(C.postRed, 0.4));
    body.position.y = 0.675;
    const cap = new Mesh(new CylinderGeometry(0.3, 0.3, 0.1, 20), b.plain(C.postRed, 0.4));
    cap.position.y = 1.4;
    p.add(body, cap, placeholderBox(0.3, 0.04, 0.02, 0, 1.05, 0.27, b.plain(C.signTextDark, 0.5)));
  });
  b.colliders.push(boxAt(mx, mz, 0.6, 0.6));
  b.read('Postbox', 'Examine', mx, mz - 0.7, [
    "A red pillar box. Last collection today: 5:30 pm. You've missed it.",
  ]);

  // 公交站（自制槽位 bus-stop）
  const bx = 19;
  const bz = 6.3;
  b.custom('bus-stop', bx, bz, Math.PI, (p) => {
    const metal = b.plain(C.metal, 0.35, 0.7);
    p.add(placeholderBox(4, 0.1, 1.4, 0, 2.5, 0, metal));
    for (const dx of [-1.8, 1.8]) p.add(placeholderBox(0.1, 2.5, 0.1, dx, 0, -0.5, metal));
    p.add(
      placeholderBox(
        3.8,
        2.0,
        0.06,
        0,
        0.4,
        -0.6,
        new MeshStandardMaterial({
          color: C.glass,
          transparent: true,
          opacity: 0.3,
          roughness: 0.05,
        }),
      ),
    );
    p.add(placeholderBox(2.4, 0.45, 0.4, 0, 0, -0.25, metal));
  });
  b.colliders.push(boxAt(bx, bz + 0.6, 3.8, 0.1), boxAt(bx, bz + 0.25, 2.4, 0.4));
  const busSign = signTexture({
    text: 'BUS STOP',
    sub: '24 · CITY CENTRE — UNIVERSITY',
    background: C.signRed,
    width: 256,
    height: 96,
  });
  b.panel(1.4, 0.5, bx - 1.2, 2.9, bz - 0.2, Math.PI, b.glow(busSign, '#ffffff', 1.3));
  b.read('Bus stop', 'Examine', bx, bz - 0.7, [
    'Route 24 to the city centre and the university. Someone has scribbled over the next bus time: "EVENTUALLY".',
  ]);
}

// ---------- 北侧：店铺外壳 ----------

interface ShopOptions {
  name: string;
  x: number;
  width: number;
  depth: number;
  /** 外墙材质 */
  facade: Material;
  /** 内墙材质 */
  inner: Material;
  sign: Texture;
  floor: Material;
  light: string;
  lightIntensity: number;
  /** 天花板上日光灯的排数 */
  lightRows: number;
}

/** 店铺：一层是能走进去的房间（前墙有门和玻璃橱窗），上面再叠两层楼面。返回店里的边界 */
function shop(b: Builder, o: ShopOptions): { back: number; left: number; right: number } {
  const front = -SIDEWALK_EDGE;
  const back = front - o.depth;
  const left = o.x - o.width / 2;
  const right = o.x + o.width / 2;
  const mid = front - o.depth / 2;
  const solid = { solid: true };

  b.zones.push({ name: o.name, minX: left, maxX: right, minZ: back, maxZ: front });
  b.floor(o.width, o.depth, o.x, 0.005, mid, o.floor);
  b.box(o.width, 0.15, o.depth, o.x, STOREY, mid, b.plain(C.ceiling, 0.9), { blockCamera: true });

  // 墙：朝外的面贴外墙材质，朝里的面刷涂料。盒子各面的顺序：+x、-x、+y、-y、+z、-z
  const f = o.facade;
  const n = o.inner;
  b.box(o.width, STOREY, WALL, o.x, 0, back + WALL / 2, [n, n, n, n, n, f], solid);
  b.box(WALL, STOREY, o.depth, left + WALL / 2, 0, mid, [n, f, n, n, n, n], solid);
  b.box(WALL, STOREY, o.depth, right - WALL / 2, 0, mid, [f, n, n, n, n, n], solid);

  // 前墙：门两边是矮墙 + 玻璃橱窗，门上是门楣
  const frontFaces = [f, f, f, f, f, n];
  const glass = new MeshStandardMaterial({
    color: C.glass,
    transparent: true,
    opacity: 0.18,
    roughness: 0.03,
    metalness: 0.1,
    depthWrite: false,
  });
  const frame = b.plain(C.metal, 0.35, 0.8);
  const fz = front - WALL / 2;
  for (const [from, to] of [
    [left, o.x - DOOR_HALF_WIDTH],
    [o.x + DOOR_HALF_WIDTH, right],
  ] as const) {
    const w = to - from;
    const cx = (from + to) / 2;
    b.colliders.push(boxAt(cx, fz, w, WALL));
    b.blockers.push(b.box(w, 0.8, WALL, cx, 0, fz, frontFaces));
    b.blockers.push(b.box(w, DOOR_HEIGHT - 0.8, 0.04, cx, 0.8, fz, glass, { castShadow: false }));
    b.blockers.push(b.box(w, STOREY - DOOR_HEIGHT, WALL, cx, DOOR_HEIGHT, fz, frontFaces));
    b.box(w, 0.05, 0.08, cx, DOOR_HEIGHT - 0.05, fz, frame);
    b.box(w, 0.05, 0.08, cx, 0.8, fz, frame);
  }
  b.blockers.push(
    b.box(DOOR_HALF_WIDTH * 2, STOREY - DOOR_HEIGHT, WALL, o.x, DOOR_HEIGHT, fz, frontFaces),
  );

  // 楼上两层：和店面同一面外墙，开窗
  b.box(o.width, UPPER_STOREY * 2 + 0.4, o.depth, o.x, STOREY + 0.15, mid, o.facade, {
    blockCamera: true,
  });
  b.windowGrid(left + 0.4, right - 0.4, STOREY + 0.55, 2, front, 1, Math.round(o.x * 7 + 50));

  // 灯箱招牌 + 门头壁灯（白天不点亮）
  const signWidth = o.width * 0.86;
  b.box(
    signWidth + 0.2,
    1.3,
    0.25,
    o.x,
    STOREY - 0.05,
    front + 0.12,
    b.plain(C.metalDark, 0.5, 0.5),
  );
  b.panel(signWidth, 1.1, o.x, STOREY + 0.6, front + 0.26, 0, b.glow(o.sign, '#ffffff', 1.2));
  b.prop('street_lamp_02', o.x - DOOR_HALF_WIDTH - 0.5, 2.6, front + 0.02, {
    height: 0.9,
    groundAlign: false,
  });

  // 屋里：主灯 + 天花板上的日光灯
  b.light(o.light, o.lightIntensity, o.x, STOREY - 1.4, mid, 0);
  for (let row = 0; row < o.lightRows; row++) {
    const z = front - (o.depth / (o.lightRows + 1)) * (row + 1);
    for (const dx of [-o.width / 4, o.width / 4]) {
      b.prop('mounted_fluorescent_lights', o.x + dx, STOREY, z, { width: 0.9, groundAlign: false });
    }
  }
  return { back, left, right };
}

/** 店与店之间、街道两头不能进的楼 */
function buildFillers(b: Builder): void {
  const spans: [number, number, Material][] = [
    [-STREET_END - 3, -21, surface('rectangular_facade_tiles', { tile: 2, tint: '#e0e6ee' })],
    [-11, -7, surface('red_brick_03', { tile: 2 })],
    [7, 11, surface('painted_plaster_wall', { tile: 2.5, tint: '#c9d8c6' })],
    [21, STREET_END + 3, surface('rectangular_facade_tiles', { tile: 2 })],
  ];
  const shutter = surface('painted_metal_shutter', { tile: 2 });
  spans.forEach(([from, to, material], i) => {
    const width = to - from;
    const x = (from + to) / 2;
    const floors = 2;
    b.box(width, STOREY + floors * UPPER_STOREY + 0.6, 12, x, 0, -SIDEWALK_EDGE - 6, material, {
      solid: true,
    });
    b.windowGrid(from + 0.4, to - 0.4, STOREY + 0.3, floors, -SIDEWALK_EDGE, 1, 31 + i * 13);
    b.box(width - 0.8, 2.6, 0.08, x, 0, -SIDEWALK_EDGE + 0.04, shutter);
    b.prop('power_box_01', x + width / 2 - 0.8, 1.4, -SIDEWALK_EDGE, {
      height: 0.5,
      groundAlign: false,
    });
  });
}

// ---------- 网吧 ----------

/** 网吧里三排电脑的桌子中心 z，以及每排 4 台的 x 偏移：前排 XP 区，后两排 Mac 区（按 cafe-layout.ts 分配） */
const CAFE_ROWS = [-11.2, -14.2, -17.2];
const CAFE_COLUMNS = [-5.3, -3.1, -0.9, 1.3];

type Machine =
  | { kind: 'level'; level: LevelMachine }
  | { kind: 'busy'; screen: ScreenImage }
  | { kind: 'repair' }
  | { kind: 'off' };

/** 有人在用的机器屏幕上轮流放的画面 */
const BUSY_SCREENS: readonly ScreenImage[] = ['xp-azul', 'xp-autumn', 'xp-desert', 'mac-aqua-blue'];

function buildInternetCafe(b: Builder, x: number, levels: readonly LevelMachine[]): void {
  const { back, right } = shop(b, {
    name: 'CYBERSPACE CAFÉ',
    x,
    width: 14,
    depth: 12,
    facade: surface('rectangular_facade_tiles', { tile: 2 }),
    inner: surface('painted_plaster_wall', { tile: 2.5, tint: '#c4c8d4' }),
    sign: signTexture({
      text: 'CYBERSPACE CAFÉ',
      sub: 'INTERNET · GAMES · TEA & COFFEE',
      background: C.signBlue,
      border: C.neonCyan,
    }),
    floor: surface('dirty_carpet', { tile: 2, tint: '#9aa0c0' }),
    light: C.lampCool,
    lightIntensity: 7,
    lightRows: 3,
  });

  // 每个场景一台入口电脑；空位放有人占着、维修中、没开机的机器
  const layout = arrangeMachines(levels, CAFE_ROWS.length, CAFE_COLUMNS.length);
  if (layout.overflow.length > 0) {
    console.warn(`网吧里坐不下这些关卡：${layout.overflow.map((l) => l.levelId).join('、')}`);
  }
  let busy = 0;
  const machines: Machine[][] = layout.seats.map((row) =>
    row.map((seat): Machine => {
      if (seat.kind === 'level') return { kind: 'level', level: seat.level };
      if (seat.kind === 'busy')
        return { kind: 'busy', screen: BUSY_SCREENS[busy++ % BUSY_SCREENS.length]! };
      return { kind: seat.kind };
    }),
  );
  const partition = b.plain(C.plastic, 0.6);
  CAFE_ROWS.forEach((rowZ, row) => {
    CAFE_COLUMNS.forEach((dx, col) => computerDesk(b, x + dx, rowZ, machines[row]![col]!));
    for (const dx of [...CAFE_COLUMNS.map((c) => c - 1.1), CAFE_COLUMNS.at(-1)! + 1.1]) {
      b.box(0.04, 1.3, 0.9, x + dx, 0, rowZ, partition, { solid: true });
    }
  });

  // 吊扇、监控、门口的盆栽
  b.prop('ceiling_fan', x - 2, STOREY, -12.7, { width: 1.3, groundAlign: false });
  b.prop('ceiling_fan', x - 2, STOREY, -15.7, { width: 1.3, groundAlign: false });
  b.prop('security_camera_01', right - 0.4, STOREY - 0.35, -7.6, {
    height: 0.25,
    rotation: -2.4,
    groundAlign: false,
  });
  b.prop('potted_plant_01', x + 2.2, 0, -6.4, { height: 1.2, collider: [0.55, 0.55] });
  b.prop('potted_plant_01', x - 2.2, 0, -6.4, {
    height: 1.2,
    rotation: 1.4,
    collider: [0.55, 0.55],
  });

  // 前台（自制槽位 cafe-counter）
  const cx = x + 4.6;
  const cz = -9.3;
  b.custom('cafe-counter', cx, cz, 0, (p) => {
    p.add(placeholderBox(2.6, 1.05, 0.8, 0, 0, 0, b.plain(C.woodLight, 0.5)));
    p.add(placeholderBox(2.7, 0.05, 0.9, 0, 1.05, 0, b.plain(C.wood, 0.35)));
  });
  b.colliders.push(boxAt(cx, cz, 2.6, 0.8));
  b.prop('classic_laptop', cx + 0.6, 1.1, cz, { width: 0.45, rotation: Math.PI });
  b.read('Front desk', 'Examine', cx - 0.4, cz + 0.85, [
    'Nobody at the desk. The price list says: internet £1 per 30 minutes, printing 10p a page.',
    'A Post-it note beside it: "The ones with yellow markers are free. Help yourself."',
  ]);

  // 墙上的告示
  const prices = posterTexture(
    ['PRICES', '£1 / 30 MINS', 'PRINTING 10p', 'TEA 80p'],
    C.wallCream,
    C.signBlue,
  );
  const lanParty = posterTexture(
    ['LAN PARTY', 'SAT NIGHT', '£5 ENTRY', 'PRIZES!'],
    C.signRed,
    C.signText,
  );
  const noMinors = signTexture({
    text: 'PAY AT COUNTER',
    background: C.signText,
    color: C.signRed,
    width: 384,
    height: 128,
  });
  const backInner = back + WALL + 0.01;
  b.panel(1.2, 1.6, right - WALL - 0.01, 1.7, -12.5, -Math.PI / 2, b.glow(prices, '#ffffff', 0.35));
  b.panel(1.2, 1.6, x - 3, 1.8, backInner, 0, b.glow(lanParty, '#ffffff', 0.35));
  b.panel(1.6, 0.6, x + 1.5, 2.4, backInner, 0, b.glow(noMinors, '#ffffff', 0.4));
}

/**
 * 一张电脑桌：桌子（自制槽位 computer-desk）、电脑（crt-pc 或 imac-g3）、椅子（office-chair）。
 * 自制电脑模型里名为 SCREEN 的网格会被换成屏幕画面。
 */
function computerDesk(b: Builder, x: number, z: number, machine: Machine): void {
  b.custom('computer-desk', x, z, 0, (p) => {
    p.add(placeholderBox(2.0, 0.05, 0.8, 0, 0.72, 0, b.plain(C.woodLight, 0.45)));
    p.add(placeholderBox(0.05, 0.72, 0.76, -0.95, 0, 0, b.plain(C.wood, 0.6)));
    p.add(placeholderBox(0.05, 0.72, 0.76, 0.95, 0, 0, b.plain(C.wood, 0.6)));
  });
  b.colliders.push(boxAt(x, z, 2.0, 0.8));

  const imac = machine.kind === 'level' && machine.level.imac === true;
  const image =
    machine.kind === 'level'
      ? machine.level.screen
      : machine.kind === 'busy'
        ? machine.screen
        : null;
  const screenMaterial = image ? b.screen(image) : b.plain('#0c0e10', 0.15, 0.2);
  const screenY = 0.77 + 0.27;
  const screenOffset = imac ? -0.1 + 0.252 : -0.08 + 0.162;
  const screenCenter = new Vector3(x, screenY, z + screenOffset);
  const plastic = b.plain(C.plastic, 0.55);

  b.custom(
    imac ? 'imac-g3' : 'crt-pc',
    x,
    z,
    0,
    (p) => {
      if (imac) {
        const shell = new MeshStandardMaterial({
          color: C.imacShell,
          transparent: true,
          opacity: 0.8,
          roughness: 0.15,
        });
        p.add(placeholderBox(0.58, 0.54, 0.5, 0, 0.77, -0.1, shell));
      } else {
        p.add(placeholderBox(0.56, 0.48, 0.32, 0, 0.77, -0.08, plastic));
        p.add(placeholderBox(0.44, 0.38, 0.22, 0, 0.81, -0.33, plastic));
        p.add(placeholderBox(0.22, 0.48, 0.5, 0.65, 0, -0.05, plastic));
      }
      p.add(placeholderBox(0.48, 0.03, 0.16, -0.05, 0.77, 0.22, plastic));
      const screen = new Mesh(new PlaneGeometry(0.42, 0.32), screenMaterial);
      screen.position.set(0, screenY, screenOffset);
      p.add(screen);
    },
    (model) => {
      // 自制电脑模型：把 SCREEN 网格换成屏幕画面，镜头推进的目标改成它的中心
      const screen = model.getObjectByName('SCREEN') as Mesh | undefined;
      if (!screen) return;
      screen.material = screenMaterial;
      model.updateWorldMatrix(true, true);
      screen.geometry.computeBoundingBox();
      screen.geometry.boundingBox!.getCenter(screenCenter);
      screen.localToWorld(screenCenter);
    },
  );

  // 椅子（自制槽位 office-chair）
  const seatZ = z + 0.85;
  b.custom('office-chair', x, seatZ, 0, (p) => {
    const fabric = b.plain(C.plasticDark, 0.8);
    p.add(placeholderBox(0.5, 0.08, 0.5, 0, SEAT_HEIGHT - 0.08, 0, fabric));
    p.add(placeholderBox(0.5, 0.6, 0.06, 0, SEAT_HEIGHT, 0.25, fabric));
    p.add(placeholderBox(0.06, SEAT_HEIGHT - 0.08, 0.06, 0, 0, 0, b.plain(C.metalDark, 0.4, 0.8)));
  });

  switch (machine.kind) {
    case 'level': {
      const marker = new Mesh(new OctahedronGeometry(0.12, 0), b.glow(null, C.marker, 6));
      marker.position.set(x, 1.75, z - 0.1);
      b.root.add(marker);
      b.animations.push((t) => {
        marker.position.y = 1.75 + Math.sin(t * 2.4 + x) * 0.06;
        marker.rotation.y = t * 1.6;
      });
      b.spots.push({
        kind: 'level',
        levelId: machine.level.levelId,
        x,
        z: seatZ,
        reach: 1.0,
        seat: { x, z: seatZ, heading: Math.PI },
        screen: screenCenter,
      });
      break;
    }
    case 'busy':
      b.read(
        'Computer',
        'Examine',
        x,
        seatZ,
        ['Taken: a coat over the chair, a cold cup of tea and half a bag of crisps on the desk.'],
        0.9,
      );
      b.colliders.push(boxAt(x, seatZ, 0.6, 0.6));
      break;
    case 'repair':
      b.read(
        'Computer',
        'Examine',
        x,
        seatZ,
        ['A note taped to the screen: "OUT OF ORDER. Use another one."'],
        0.9,
      );
      break;
    case 'off':
      b.read(
        'Computer',
        'Examine',
        x,
        seatZ,
        ['You press the power button a few times. Nothing.'],
        0.9,
      );
      break;
  }
}

// ---------- 音像店 ----------

function buildMusicShop(b: Builder, x: number): void {
  const { back, left, right } = shop(b, {
    name: 'MILLENNIUM RECORDS',
    x,
    width: 10,
    depth: 9,
    facade: surface('red_brick_03', { tile: 2 }),
    inner: surface('painted_plaster_wall', { tile: 2.5, tint: '#efe4cf' }),
    sign: signTexture({
      text: 'MILLENNIUM RECORDS',
      sub: 'CDs · VINYL · TAPES · VIDEOS',
      background: C.signRed,
      border: C.signYellow,
    }),
    floor: surface('floor_tiles_06', { tile: 1.2 }),
    light: C.lampWarm,
    lightIntensity: 7,
    lightRows: 2,
  });

  // 靠墙和店中间的铁货架，上面放着纸箱（以后换成自制的 CD 架）
  const shelves: [number, number, number][] = [
    [left + WALL + 0.35, back + 4.2, Math.PI / 2],
    [right - WALL - 0.35, back + 4.2, -Math.PI / 2],
    [x - 1.6, back + 5, Math.PI / 2],
    [x + 1.6, back + 5, -Math.PI / 2],
  ];
  for (const [sx, sz, rotation] of shelves) {
    b.prop('steel_frame_shelves_01', sx, 0, sz, { height: 2.0, rotation, collider: [0.7, 2.2] });
    b.prop('cardboard_box_01', sx, 0.02, sz - 0.6, { height: 0.35, rotation: rotation + 0.3 });
  }
  b.prop('plastic_crate_01', x + 3.2, 0, -7.8, { height: 0.3, rotation: 0.4 });
  b.prop('plastic_crate_01', x + 3.25, 0.3, -7.85, { height: 0.3, rotation: 0.2 });

  // 柜台（自制槽位 shop-counter）
  const cz = back + 1.6;
  b.custom('shop-counter', x, cz, 0, (p) => {
    p.add(placeholderBox(3, 1.0, 0.7, 0, 0, 0, b.plain(C.woodLight, 0.5)));
    p.add(placeholderBox(0.5, 0.25, 0.35, 0.8, 1.0, 0, b.plain(C.plasticDark, 0.4)));
  });
  b.colliders.push(boxAt(x, cz, 3, 0.7));
  b.prop('boombox', x - 0.7, 1.0, cz, { width: 0.6, rotation: 0.15 });
  b.prop('cassette_player', x + 0.2, 1.0, cz + 0.1, { height: 0.16, rotation: -0.4 });
  b.prop('portable_cassette_player', x + 0.5, 1.0, cz + 0.15, { width: 0.14, rotation: 0.5 });
  b.read('Counter', 'Examine', x, cz + 0.9, [
    "Nobody behind the counter. The radio is playing this week's number one.",
    'A handwritten sign: "ANY 2 CDs FOR £20. LISTENING POST BROKEN."',
  ]);
  b.prop('ceiling_fan', x, STOREY, back + 4.5, { width: 1.2, groundAlign: false });

  const topHits = posterTexture(['TOP 40', 'NEW IN', '2 FOR £20'], C.signYellow, C.signRed);
  const original = posterTexture(['VHS', 'DVD', 'NOW £9.99'], C.signBlue, C.signText);
  const backInner = back + WALL + 0.01;
  b.panel(1.2, 1.6, x + 2.6, 1.8, backInner, 0, b.glow(topHits, '#ffffff', 0.35));
  b.panel(1.2, 1.6, x - 2.2, 1.8, backInner, 0, b.glow(original, '#ffffff', 0.35));
}

// ---------- 电玩城 ----------

function buildArcade(b: Builder, x: number): void {
  const { back, left } = shop(b, {
    name: 'FUNLAND AMUSEMENTS',
    x,
    width: 10,
    depth: 9,
    facade: surface('painted_plaster_wall', { tile: 2.5, tint: '#b9c4e0' }),
    inner: surface('painted_plaster_wall', { tile: 2.5, tint: '#3a3458' }),
    sign: signTexture({
      text: 'FUNLAND AMUSEMENTS',
      sub: '2p PUSHERS · ARCADE · DANCE',
      background: C.plasticDark,
      color: C.neonPink,
      border: C.neonPurple,
    }),
    floor: surface('dirty_carpet', { tile: 2, tint: '#6a5a9a' }),
    light: C.neonPurple,
    lightIntensity: 6,
    lightRows: 1,
  });
  b.light(C.neonCyan, 8, x + 3, 2.2, back + 2, 8);

  // 靠后墙的四台街机（自制槽位 arcade-cabinet）
  const notes = [
    ['A note over the coin slot: "OUT OF ORDER".'],
    ["The attract mode loops on and on. You haven't got a 10p coin."],
    ["Two players are going head to head… no, it's just the demo."],
    ['The joystick is bent and sticks every time you push it.'],
  ];
  const bodies = [C.signRed, C.signBlue, C.plasticDark, C.signGreen];
  const marquees = [C.signYellow, C.neonCyan, C.neonPink, C.signText];
  [-3.2, -1.1, 1.1, 3.2].forEach((dx, i) => {
    const cx = x + dx;
    const cz = back + 0.75;
    b.custom('arcade-cabinet', cx, cz, 0, (p) => {
      const body = b.plain(bodies[i]!, 0.45);
      p.add(placeholderBox(0.9, 1.0, 0.8, 0, 0, 0, body));
      p.add(placeholderBox(0.9, 0.9, 0.6, 0, 1.0, -0.1, body));
      p.add(placeholderBox(0.9, 0.3, 0.7, 0, 1.9, -0.05, b.glow(null, marquees[i]!, 1.6)));
      const screen = new Mesh(new PlaneGeometry(0.66, 0.5), b.glow(null, '#2a3a9a', 1.2));
      screen.position.set(0, 1.45, 0.21);
      screen.rotation.x = -0.12;
      p.add(screen);
      p.add(placeholderBox(0.86, 0.12, 0.35, 0, 0.95, 0.45, b.plain(C.plasticDark, 0.5)));
    });
    b.colliders.push(boxAt(cx, cz, 0.9, 0.8));
    b.read('Arcade machine', 'Examine', cx, cz + 1.3, notes[i]!, 0.9);
  });

  // 跳舞机（自制槽位 dance-machine）
  // 游戏机试玩台：矮柜（自制槽位 tv-stand）上放老电视、游戏机和手柄
  const sx = x + 3.4;
  const sz = back + 5.5;
  b.custom('tv-stand', sx, sz, -Math.PI / 2, (p) => {
    p.add(placeholderBox(1.2, 0.55, 0.5, 0, 0, 0, b.plain(C.wood, 0.6)));
  });
  b.colliders.push(boxAt(sx, sz, 0.5, 1.2));
  b.prop('television_02', sx, 0.55, sz - 0.1, { width: 0.6, rotation: -Math.PI / 2 });
  b.prop('gaming_console', sx + 0.05, 0.55, sz + 0.4, { width: 0.3, rotation: -Math.PI / 2 });
  b.prop('gamepad', sx - 0.6, 0, sz + 0.2, { width: 0.16, rotation: -1.2 });
  b.read(
    'Demo pod',
    'Examine',
    sx - 0.9,
    sz,
    [
      "The telly shows the console's start-up screen. Someone has tied the controller lead in knots.",
    ],
    1.0,
  );

  const dx = left + 2;
  const dz = back + 6;
  b.custom('dance-machine', dx, dz, 0, (p) => {
    p.add(placeholderBox(1.6, 0.12, 1.6, 0, 0, 0, b.plain(C.metal, 0.4, 0.7)));
    p.add(placeholderBox(1.6, 2.2, 0.4, 0, 0, -1.0, b.plain(C.plasticDark, 0.5)));
    const screen = new Mesh(new PlaneGeometry(1.0, 0.75), b.glow(null, '#3a2a8a', 1.2));
    screen.position.set(0, 1.6, -0.79);
    p.add(screen);
  });
  b.colliders.push(boxAt(dx, dz - 1.0, 1.6, 0.4));
  b.read('Dance machine', 'Examine', dx, dz, ['A sign stuck on the dance pad: "OUT OF USE".'], 1.0);
}

// ---------- 千禧年的英国商业街 ----------

/** 横幅、LED 滚动屏、橱窗海报、路牌、酒吧挂牌：2000 年前后英国商业街上随处可见的东西（文字只用英文） */
function buildMillennium(b: Builder): void {
  // HIGH STREET 路牌：英国标准的白底黑字、红色边框，钉在楼的一层上方
  const plate = signTexture({
    text: 'HIGH STREET',
    sub: 'CITY CENTRE',
    background: C.signText,
    color: C.signTextDark,
    border: C.postRed,
    width: 384,
    height: 96,
  });
  const plateMaterial = b.glow(plate, '#ffffff', 0.4);
  b.panel(1.6, 0.4, -9, 3.15, -SIDEWALK_EDGE + 0.02, 0, plateMaterial);
  b.panel(1.6, 0.4, -27.5, 3.9, SIDEWALK_EDGE - 0.02, Math.PI, plateMaterial);

  // 酒吧的挂牌：从墙上伸出一根铁杆，下面吊一块两面都有字的牌子
  const pub = signTexture({
    text: 'THE MILLENNIUM ARMS',
    sub: 'FREE HOUSE · EST. 1999',
    background: '#1f3b2a',
    color: C.signYellow,
    border: C.signYellow,
    width: 384,
    height: 256,
  });
  const pubX = 23;
  b.box(0.06, 0.06, 1.0, pubX, 3.75, -SIDEWALK_EDGE + 0.5, b.plain(C.metalDark, 0.4, 0.8));
  for (const facing of [Math.PI / 2, -Math.PI / 2]) {
    b.panel(
      0.9,
      0.62,
      pubX + Math.sign(facing) * 0.02,
      3.35,
      -SIDEWALK_EDGE + 0.6,
      facing,
      b.glow(pub, '#ffffff', 0.5),
    );
  }
  b.box(0.03, 0.66, 0.94, pubX, 3.02, -SIDEWALK_EDGE + 0.6, b.plain(C.wood, 0.6));

  // 横跨马路的布横幅，两头用绳子拴在楼上
  const banners: [number, string, string][] = [
    [-12, 'WELCOME TO THE NEW MILLENNIUM · 2000', C.signRed],
    [10, 'HIGH STREET MILLENNIUM FESTIVAL', C.signBlue],
  ];
  const rope = new LineBasicMaterial({ color: C.plasticDark });
  for (const [bx, text, background] of banners) {
    const cloth = new MeshStandardMaterial({
      map: signTexture({ text, background, color: C.signYellow, width: 1024, height: 72 }),
      roughness: 0.9,
    });
    // 两块单面背对背：从街道两头看过去字都是正的
    for (const facing of [Math.PI / 2, -Math.PI / 2]) {
      const banner = b.panel(11, 0.8, bx + Math.sign(facing) * 0.005, 6.2, 0, facing, cloth);
      banner.castShadow = true;
    }
    for (const side of [-1, 1]) {
      const points = [
        new Vector3(bx, 6.55, side * 5.5),
        new Vector3(bx, 6.9, side * SIDEWALK_EDGE),
      ];
      b.root.add(new Line(new BufferGeometry().setFromPoints(points), rope));
    }
  }

  // 南侧楼顶的 LED 滚动屏
  const led = ledTexture(
    '★ HAPPY NEW MILLENNIUM ★ 2000 ★ COUNTDOWN COMPLETE ★ Y2K OK ★',
    C.signYellow,
  );
  // 面板 7.2 × 0.9 米；贴图高 48 像素对应 0.9 米，横向只显示其中一段
  const ledWidth = (led.image as HTMLCanvasElement).width;
  led.repeat.set(((7.2 / 0.9) * 48) / ledWidth, 1);
  const ledX = -4;
  const ledZ = SIDEWALK_EDGE - 0.1;
  b.box(7.6, 1.2, 0.3, ledX, 9.1, ledZ + 0.2, b.plain(C.metalDark, 0.5, 0.6));
  b.panel(7.2, 0.9, ledX, 9.7, ledZ, Math.PI, b.glow(led, '#ffffff', 4.5));
  b.animations.push((t) => {
    led.offset.x = (t * 0.06) % 1;
  });

  // 电器行门口的电视墙：货架上摆两层 CRT 电视，都开着
  const tvX = 13;
  const tvZ = SIDEWALK_EDGE - 0.6;
  b.box(3.0, 0.5, 0.6, tvX, 0, tvZ, b.plain(C.metalDark, 0.5, 0.6), { solid: true });
  b.box(3.0, 0.05, 0.6, tvX, 1.0, tvZ, b.plain(C.metalDark, 0.5, 0.6));
  for (const dx of [-1.4, 1.4])
    b.box(0.05, 1.05, 0.6, tvX + dx, 0, tvZ, b.plain(C.metalDark, 0.5, 0.6));
  const tvScreens: ScreenImage[] = [
    'xp-bliss',
    'xp-azul',
    'xp-autumn',
    'xp-desert',
    'mac-aqua-blue',
    'xp-bliss',
  ];
  tvScreens.forEach((image, k) => {
    const tx = tvX - 0.95 + (k % 3) * 0.95;
    const ty = k < 3 ? 0.5 : 1.05;
    b.prop('television_02', tx, ty, tvZ, { width: 0.62, rotation: Math.PI });
    b.panel(0.44, 0.33, tx, ty + 0.3, tvZ - 0.26, Math.PI, b.screen(image));
  });
  b.read(
    'TV wall',
    'Examine',
    tvX,
    tvZ - 1.0,
    [
      'Six tellies, one weather forecast: more rain tomorrow. The shopkeeper says flat-screen tubes are all the rage this year.',
    ],
    1.3,
  );

  // 楼顶第二块广告牌：整机广告
  const pcAd = signTexture({
    text: 'PC 2000 · PENTIUM III',
    sub: '128MB RAM · 20GB HDD · 17" CRT · £899 INC VAT',
    background: '#1b2b5a',
    color: C.signYellow,
    border: C.neonCyan,
  });
  b.panel(8, 2.0, -26, 13.2, -SIDEWALK_EDGE - 0.5, 0, b.glow(pcAd, '#ffffff', 1.1));
  for (const dx of [-3, 3])
    b.box(0.2, 2.4, 0.2, -26 + dx, 10.4, -SIDEWALK_EDGE - 0.7, b.plain(C.metalDark, 0.5, 0.7));

  // 电玩城门头里面的 LED 滚动屏
  const coin = ledTexture('10p A GO ★ INSERT COIN ★ HIGH SCORE ★ 2 PLAYERS ★', C.neonPink);
  coin.repeat.set(((3.2 / 0.4) * 48) / (coin.image as HTMLCanvasElement).width, 1);
  b.panel(3.2, 0.4, 16, 2.25, -SIDEWALK_EDGE - WALL - 0.03, 0, b.glow(coin, '#ffffff', 4.5));
  b.animations.push((t) => {
    coin.offset.x = (t * 0.09) % 1;
  });

  // 网吧橱窗里的霓虹灯牌
  const open = signTexture({
    text: 'OPEN 7 DAYS',
    background: '#000000',
    color: C.neonCyan,
    border: C.neonPink,
    width: 256,
    height: 96,
  });
  b.panel(1.1, 0.42, 4.2, 2.0, -SIDEWALK_EDGE - WALL - 0.03, 0, b.glow(open, '#ffffff', 5));

  // 报摊门口：两只塑料筐叠起来当柜台，上面摆着卖的随身听
  b.prop('plastic_crate_01', -9.1, 0, 4.7, {
    height: 0.3,
    rotation: Math.PI / 2,
    collider: [0.45, 0.35],
  });
  b.prop('plastic_crate_01', -9.1, 0.3, 4.7, { height: 0.3, rotation: Math.PI / 2 + 0.1 });
  b.prop('portable_cassette_player', -9.2, 0.6, 4.65, { width: 0.14, rotation: 2.6 });
  b.prop('cassette_player', -8.95, 0.6, 4.7, { height: 0.15, rotation: 3.4 });

  // 橱窗里贴的海报（贴在玻璃内侧，朝外）
  const windowPosters: [number, string[], string, string][] = [
    [-19.5, ['NEW!', 'MP3 PLAYER', '64 MB', '£149'], C.signYellow, C.signRed],
    [-4.8, ['Y2K READY', 'ALL PCs', 'TESTED'], C.signText, C.signBlue],
    [4.8, ['56K → 512K', 'BROADBAND', 'NOW HERE'], C.signBlue, C.signText],
    [19.6, ['DANCE', 'MACHINE', 'NEW SONGS'], C.neonPink, C.signText],
  ];
  for (const [px, lines, background, color] of windowPosters) {
    const poster = b.glow(posterTexture(lines, background, color), '#ffffff', 0.45);
    b.panel(0.75, 1.0, px, 1.6, -SIDEWALK_EDGE - WALL - 0.02, 0, poster);
  }
}
