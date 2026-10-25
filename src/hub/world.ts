// The whole street set: a British high street around 2000. Three shops on the north side can be entered
// (record shop, net café, arcade); the south side has buildings and street furniture only.
// Layout, shop names and texts are first-pass placeholders (doc/hub.md). Signs and posters are in English.
// Realistic style: PBR photo textures on walls and ground, stock models for props (assets.ts); bespoke props use simple
// placeholder shapes until the user's Tripo / Blender models go into assets/public/models/custom/ (spec: doc/hub-assets.md).
// Axes: x along the street (west negative), z from north to south, y up, in metres. Road at |z| < 4, pavements out to |z| = 7.

import type { Arrow } from '@/dance/steps.ts';
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
import { DanceAttractScreen, padArrowTexture } from './dance-attract.ts';
import { headingOf, type Spot } from './motion.ts';
import { ledTexture, posterTexture, signTexture } from './textures.ts';

/** Kerb height of the pavement above the road */
const CURB_HEIGHT = 0.12;
const ROAD_HALF_WIDTH = 4;
const SIDEWALK_EDGE = 7;
/** Barriers at both ends of the street */
const STREET_END = 33;
/** Ground floor height of the shops */
const STOREY = 3.4;
/** Height of each upper floor */
const UPPER_STOREY = 3.0;
const WALL = 0.25;
const DOOR_HALF_WIDTH = 0.9;
const DOOR_HEIGHT = 2.5;

/** Sit at a computer to start a level */
export interface LevelSpot extends Spot {
  kind: 'level';
  /** Level id (chart id) */
  levelId: string;
  /** Character position and heading when seated */
  seat: { x: number; z: number; heading: number };
  /** Screen centre (world), where the camera finally pushes in; updated when a custom computer model loads */
  screen: Vector3;
  /** The screen's self-lit material; chair-swivel's cutaway shows the level on it (doc/cross-dimension.md) */
  screenMaterial: MeshStandardMaterial;
  /** The swivel chair, turned about its centre by the cutaway */
  chair: Object3D;
}

/** Look at something or talk: shows a few lines of text */
export interface ReadSpot extends Spot {
  kind: 'read';
  /** The verb in the hint, e.g. "Examine" */
  verb: string;
  name: string;
  lines: string[];
  /** An arcade machine: takes the cheat code's 10p coin when the player has it (doc/cheat-code.md) */
  coinSlot: boolean;
}

/** The guide booklet on the café's front desk: opens the booklet overlay (doc/hub.md#guide-booklet) */
export interface GuideSpot extends Spot {
  kind: 'guide';
  name: string;
}

/** An arcade game to play: E opens its 2D screen; the dance machine (doc/dance-machine.md) */
export interface GameSpot extends Spot {
  kind: 'game';
  name: string;
  /** Where the character stands to play, and the heading that faces the screen */
  stand: { x: number; z: number; heading: number };
  /** Screen centre (world), where the camera pushes in; updated when a custom model loads */
  screen: Vector3;
}

export type HubSpot = LevelSpot | ReadSpot | GuideSpot | GameSpot;

/** A shop's area; entering shows its name */
export interface Zone extends Box {
  name: string;
}

export interface World {
  root: Group;
  /** What the character can't walk through */
  colliders: Box[];
  /** What the camera can't pass through (walls, ceilings, buildings) */
  blockers: Object3D[];
  spots: HubSpot[];
  zones: Zone[];
  /** Spawn point: the west end of the street, facing east */
  spawn: { x: number; z: number; heading: number };
  /** Ground height underfoot: the road is a kerb lower than the pavement */
  groundHeight(x: number, z: number): number;
  /** Call every frame, t in seconds: the hint markers bob up and down */
  update(t: number): void;
}

/** Monitor images: the original system wallpapers (assets/reference/, ADR 0004), scaled down */
export type ScreenImage = 'xp-bliss' | 'xp-azul' | 'xp-autumn' | 'xp-desert' | 'mac-aqua-blue';

/**
 * What an entry computer runs, which also picks its row: play computers in the café's front row, editors in the row
 * behind, showcase computers in the back row (doc/showcase.md)
 */
export type CafeRole = 'levels' | 'editor' | 'showcase';

/** The café row of each role, from the front */
const CAFE_ROW: Record<CafeRole, number> = { levels: 0, editor: 1, showcase: 2 };

/**
 * Entry computer: per scene one to play, whose level list opens on sitting down, one running the chart editor
 * (doc/chart-editor.md) and one running the showcase tour (doc/showcase.md). Scene ids in src/scenes/catalog.ts
 */
export interface LevelMachine {
  levelId: string;
  sceneId: SceneId;
  role: CafeRole;
  /** Wallpaper on its screen (assets/public/textures/screens/) */
  screen: ScreenImage;
  /** Translucent all-in-one; otherwise a beige CRT */
  imac?: boolean;
}

interface BoxOptions {
  /** The character collides with it */
  solid?: boolean;
  /** Blocks the camera; same as solid by default */
  blockCamera?: boolean;
  /** Casts shadows; true by default */
  castShadow?: boolean;
}

/** A box with UVs in metres: with surface() tiling, brick size doesn't depend on wall size */
function meterBox(w: number, h: number, d: number): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv!;
  // Faces in order +x, -x, +y, -y, +z, -z, 4 vertices each
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

/** Placeholder box: (x, z) is the centre of its base, y the base height */
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
  /**
   * Windows on the facades, merged into a few InstancedMeshes at the end. Each building picks one frame colour;
   * each pane shows either the reflected sky or a curtain behind it (doc/hub.md).
   */
  private readonly windows: {
    matrix: Matrix4;
    frame: string;
    glass: string;
    curtained: boolean;
  }[] = [];
  private readonly plainCache = new Map<string, MeshStandardMaterial>();

  /** Untextured realistic materials: plastic, metal, paint */
  plain(color: string, roughness = 0.7, metalness = 0): MeshStandardMaterial {
    const key = `${color}/${roughness}/${metalness}`;
    let m = this.plainCache.get(key);
    if (!m)
      this.plainCache.set(key, (m = new MeshStandardMaterial({ color, roughness, metalness })));
    return m;
  }

  /** Self-lit surfaces (light boxes, screens, lamps); brightness above 1 is picked up by the bloom */
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

  /** A box: (x, z) is the centre of its base, y the base height */
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
   * An upright panel (sign, poster, banner) with one image filling it, UVs 0 to 1.
   * facing is its heading: 0 faces +z (south), π faces -z (north)
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

  /** A flat surface on the ground */
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

  /** Stock model (assets/public/models/props/) at (x, y, z), with an optional collision box */
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

  /**
   * Custom model slot: a placeholder built in the anchor's frame, replaced when the custom model arrives.
   * Returns the anchor, which carries whichever of the two is shown.
   */
  custom(
    slot: string,
    x: number,
    z: number,
    rotation: number,
    buildPlaceholder: (placeholder: Group) => void,
    onLoaded?: (model: Object3D) => void,
  ): Group {
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
    return anchor;
  }

  read(
    name: string,
    verb: string,
    x: number,
    z: number,
    lines: string[],
    reach = 1.2,
    coinSlot = false,
  ): void {
    this.spots.push({ kind: 'read', name, verb, x, z, reach, lines, coinSlot });
  }

  game(spot: Omit<GameSpot, 'kind'>): void {
    this.spots.push({ kind: 'game', ...spot });
  }

  /** Windows on a facade: from x0 to x1, `floors` storeys up from y0; z is the wall, facing its direction (+1 south, -1 north) */
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
    const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
    const frame = pick(C.windowFrames);
    for (let floor = 0; floor < floors; floor++) {
      for (let col = 0; col < columns; col++) {
        const matrix = new Matrix4().makeTranslation(
          x0 + step * (col + 0.5),
          y0 + floor * UPPER_STOREY + UPPER_STOREY * 0.5,
          z + facing * 0.03,
        );
        if (facing < 0) matrix.multiply(new Matrix4().makeRotationY(Math.PI));
        const curtained = random() < 0.35;
        this.windows.push({
          matrix,
          frame,
          glass: curtained ? pick(C.windowCurtains) : pick(C.windowGlass),
          curtained,
        });
      }
    }
  }

  /** Merges every window into three InstancedMeshes: frames, clear glass, curtained glass */
  flushWindows(): void {
    const clear = this.windows.filter((w) => !w.curtained);
    const curtained = this.windows.filter((w) => w.curtained);
    // Instance colours multiply the material colour, so the materials are white
    const frames = new InstancedMesh(
      meterBox(1.3, 1.55, 0.06),
      this.plain('#ffffff', 0.55),
      this.windows.length,
    );
    const glass = new PlaneGeometry(1.15, 1.4);
    // Smooth and partly metallic, so the panes mirror the sky and change with the angle
    const clearGlass = new InstancedMesh(
      glass,
      new MeshStandardMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0.55 }),
      clear.length,
    );
    // Fabric seen through glass: a soft sheen, no mirror
    const curtainGlass = new InstancedMesh(
      glass,
      new MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.1 }),
      curtained.length,
    );
    // Glass sits a hair proud of the frame so they don't fight over depth
    const nudge = new Matrix4().makeTranslation(0, 0, 0.035);
    this.windows.forEach((w, i) => {
      frames.setMatrixAt(i, w.matrix);
      frames.setColorAt(i, new Color(w.frame));
    });
    for (const [mesh, list] of [
      [clearGlass, clear],
      [curtainGlass, curtained],
    ] as const) {
      list.forEach((w, i) => {
        mesh.setMatrixAt(i, w.matrix.clone().multiply(nudge));
        mesh.setColorAt(i, new Color(w.glass));
      });
    }
    for (const mesh of [frames, clearGlass, curtainGlass]) {
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

// ---------- Street ----------

function buildStreet(b: Builder): void {
  const length = (STREET_END + 8) * 2;
  b.floor(240, 240, 0, -CURB_HEIGHT - 0.01, 0, surface('asphalt_02', { tile: 4, tint: '#8a8a8a' }));
  b.floor(length, ROAD_HALF_WIDTH * 2, 0, -CURB_HEIGHT, 0, surface('asphalt_02', { tile: 3 }));

  // Road markings
  const paint = b.plain(C.roadLine, 0.6);
  for (let x = -STREET_END - 6; x < STREET_END + 6; x += 4) {
    if (Math.abs(x) < 3) continue;
    b.floor(2, 0.14, x + 1, -CURB_HEIGHT + 0.004, 0, paint);
  }
  for (let z = -2.6; z <= 2.65; z += 0.75) b.floor(3, 0.4, 0, -CURB_HEIGHT + 0.004, z, paint);

  // British road: double yellow lines at the kerb, and LOOK RIGHT before the crossing (traffic drives on the left, so the near lane comes from the right on both sides)
  const yellow = b.plain(C.roadYellow, 0.6);
  for (const side of [-1, 1]) {
    for (const offset of [0.25, 0.4]) {
      b.floor(length, 0.08, 0, -CURB_HEIGHT + 0.004, side * (ROAD_HALF_WIDTH - offset), yellow);
    }
    // Road lettering is white paint only, no background
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
    // Reads upright for someone on this kerb facing the road
    if (side < 0) text.rotation.z = Math.PI;
  }

  // Belisha beacons at both ends of the zebra crossing (custom slot belisha-beacon): a striped pole topped by a yellow globe, flashing once a second
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

  // Pavements and kerbs
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

  // Manhole covers
  for (const x of [-18, 6, 22]) b.prop('water_manhole_cover', x, -CURB_HEIGHT, 1.8, { width: 0.7 });

  // Street lamps: four on the north side, three on the south. Off by day
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

  // Street furniture: bins, a utility cabinet
  b.prop('metal_trash_can', -20, 0, -4.7, { width: 1.4, collider: [1.4, 0.5] });
  b.prop('metal_trash_can', 12, 0, 4.7, { width: 1.4, rotation: Math.PI, collider: [1.4, 0.5] });
  b.prop('utility_box_01', -12.6, 0, -6.6, { height: 1.1, collider: [0.55, 0.45] });
  b.prop('utility_box_01', 27, 0, 6.6, { height: 1.1, rotation: Math.PI, collider: [0.55, 0.45] });

  // Roadworks barriers at both ends, with a building behind each
  const barrier = b.plain(C.signYellow, 0.5);
  const closed = signTexture({
    text: 'ROAD CLOSED',
    sub: 'DETOUR →',
    background: C.signRed,
    width: 256,
    height: 96,
  });
  // The cheat code on the back of the east barrier, the far end from the spawn point (doc/cheat-code.md): seen by
  // turning the camera round at the barrier
  const cheatCode = signTexture({
    text: 'Cheat Code: IvanHanloth',
    background: C.plasticDark,
    color: C.signYellow,
    width: 512,
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
    if (side === 1) {
      b.panel(
        3.2,
        0.6,
        x + side * 0.16,
        0.6,
        0,
        side * (Math.PI / 2),
        b.glow(cheatCode, '#ffffff', 1.2),
      );
    }
    b.box(4, 16, 60, x + side * 6, -CURB_HEIGHT, 0, farWall, { blockCamera: true });
  }
}

// ---------- South side: facades and street furniture ----------

function buildSouthSide(b: Builder): void {
  // A British high street: mostly Victorian red brick, with painted fronts and one tiled 1960s block
  const facades = [
    surface('red_brick_03', { tile: 2 }),
    surface('painted_plaster_wall', { tile: 2.5, tint: '#e2d3b0' }),
    surface('red_brick_03', { tile: 2, tint: '#c9a89a' }),
    surface('rectangular_facade_tiles', { tile: 2, tint: '#d8d4cc' }),
    surface('painted_plaster_wall', { tile: 2.5, tint: '#c8d4dc' }),
  ];
  const shutter = surface('painted_metal_shutter', { tile: 2 });
  // Shops typical of a British high street around 2000: video rental, mobile top-up, one-hour photo, newsagent, chippy, bookies…
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
  // Flyers stuck on the shutters
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
    // Ground floor shopfront: shutter and light-box sign
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

  // Rooftop billboard
  const billboard = signTexture({
    text: 'BROADBAND 512K',
    sub: '£29.99 / MONTH · GOODBYE DIAL-UP',
    background: C.signBlue,
    border: C.signYellow,
  });
  b.panel(10, 2.5, 4, 13.5, SIDEWALK_EDGE + 1, Math.PI, b.glow(billboard, '#ffffff', 1.1));
  for (const dx of [-3.5, 3.5])
    b.box(0.2, 3, 0.2, 4 + dx, 10.5, SIDEWALK_EDGE + 1.2, b.plain(C.metalDark, 0.5, 0.7));

  // Newsstand (custom slot newsstand)
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

  // Red phone box (custom slot phone-box) and red pillar box (custom slot pillar-box)
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

  // Bus stop (custom slot bus-stop): a kerbside shelter, glass back to the road and open to the pavement, so it
  // leaves the shopfronts clear and a walkway behind it; the stop flag stands on its own pole at the kerb
  const bx = 19;
  const bz = 5.05;
  b.custom('bus-stop', bx, bz, 0, (p) => {
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
  b.colliders.push(boxAt(bx, bz - 0.6, 3.8, 0.1), boxAt(bx, bz - 0.25, 2.4, 0.4));
  const busSign = signTexture({
    text: 'BUS STOP',
    sub: '24 · CITY CENTRE — UNIVERSITY',
    background: C.signRed,
    width: 256,
    height: 96,
  });
  // The flag sticks out at right angles to the kerb, readable from both directions along the street
  const flagX = bx + 2.7;
  const flagZ = ROAD_HALF_WIDTH + 0.35;
  b.box(0.08, 3.1, 0.08, flagX, 0, flagZ, b.plain(C.metal, 0.35, 0.7));
  for (const side of [-1, 1]) {
    b.panel(
      0.9,
      0.34,
      flagX + side * 0.045,
      2.75,
      flagZ + 0.5,
      (side * Math.PI) / 2,
      b.glow(busSign, '#ffffff', 1.1),
    );
  }
  b.colliders.push(boxAt(flagX, flagZ, 0.2, 0.2));
  b.read('Bus stop', 'Examine', bx, bz + 1.0, [
    'Route 24 to the city centre and the university. Someone has scribbled over the next bus time: "EVENTUALLY".',
  ]);
}

// ---------- North side: shop shells ----------

interface ShopOptions {
  name: string;
  x: number;
  width: number;
  depth: number;
  /** Outer wall material */
  facade: Material;
  /** Inner wall material */
  inner: Material;
  sign: Texture;
  floor: Material;
  light: string;
  lightIntensity: number;
  /** Rows of fluorescent tubes on the ceiling */
  lightRows: number;
}

/** A shop: a walk-in ground floor (door and display windows in front) with two storeys above. Returns the interior bounds */
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

  // Walls: outer faces get the facade material, inner faces paint. Box face order: +x, -x, +y, -y, +z, -z
  const f = o.facade;
  const n = o.inner;
  b.box(o.width, STOREY, WALL, o.x, 0, back + WALL / 2, [n, n, n, n, n, f], solid);
  b.box(WALL, STOREY, o.depth, left + WALL / 2, 0, mid, [n, f, n, n, n, n], solid);
  b.box(WALL, STOREY, o.depth, right - WALL / 2, 0, mid, [f, n, n, n, n, n], solid);

  // Front wall: low walls and display windows either side of the door, a lintel above it
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

  // Two upper storeys in the same facade, with windows
  b.box(o.width, UPPER_STOREY * 2 + 0.4, o.depth, o.x, STOREY + 0.15, mid, o.facade, {
    blockCamera: true,
  });
  b.windowGrid(left + 0.4, right - 0.4, STOREY + 0.55, 2, front, 1, Math.round(o.x * 7 + 50));

  // Light-box sign and door lamp (unlit by day)
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

  // Inside: a main light and fluorescent tubes on the ceiling
  b.light(o.light, o.lightIntensity, o.x, STOREY - 1.4, mid, 0);
  for (let row = 0; row < o.lightRows; row++) {
    const z = front - (o.depth / (o.lightRows + 1)) * (row + 1);
    for (const dx of [-o.width / 4, o.width / 4]) {
      b.prop('mounted_fluorescent_lights', o.x + dx, STOREY, z, { width: 0.9, groundAlign: false });
    }
  }
  return { back, left, right };
}

/** Buildings between the shops and at the street ends that can't be entered */
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

// ---------- Net café ----------

/**
 * Desk centre z of the café's three rows, and the x offsets of their 4 seats: XP and Mac side by side at the start of the
 * front row, their chart editors right behind them in the middle row and their showcase computers behind those in the
 * back row (allocated by cafe-layout.ts)
 */
const CAFE_ROWS = [-11.2, -14.2, -17.2];
const CAFE_COLUMNS = [-5.3, -3.1, -0.9, 1.3];

type Machine =
  | { kind: 'level'; level: LevelMachine }
  | { kind: 'busy'; screen: ScreenImage }
  | { kind: 'repair' }
  | { kind: 'off' };

/** Screens shown in turn on machines someone is using */
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

  // Entry computers (play in front, editors behind, showcase at the back); empty seats get occupied, out-of-order or
  // switched-off machines
  const layout = arrangeMachines(
    levels.map((level) => ({ ...level, row: CAFE_ROW[level.role] })),
    CAFE_ROWS.length,
    CAFE_COLUMNS.length,
  );
  if (layout.overflow.length > 0) {
    console.warn(
      `No room in the café for levels: ${layout.overflow.map((l) => l.levelId).join(', ')}`,
    );
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

  // Ceiling fans, a camera and potted plants by the door
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

  // Front desk (custom slot cafe-counter)
  const cx = x + 4.6;
  const cz = -9.3;
  b.custom('cafe-counter', cx, cz, 0, (p) => {
    p.add(placeholderBox(2.6, 1.05, 0.8, 0, 0, 0, b.plain(C.woodLight, 0.5)));
    p.add(placeholderBox(2.7, 0.05, 0.9, 0, 1.05, 0, b.plain(C.wood, 0.35)));
  });
  b.colliders.push(boxAt(cx, cz, 2.6, 0.8));
  b.prop('classic_laptop', cx + 0.6, 1.1, cz, { width: 0.45, rotation: Math.PI });
  // The guide booklet, propped up at the west end of the desk facing the door (doc/hub.md#guide-booklet)
  const booklet = new Group();
  booklet.position.set(cx - 0.95, 1.1, cz + 0.22);
  booklet.rotation.x = -0.35;
  const cover = new Mesh(
    new PlaneGeometry(0.2, 0.28),
    b.glow(
      posterTexture(['GUIDE', 'HOW TO', 'PLAY', 'READ ME!'], C.bookletCover, C.signText),
      '#ffffff',
      0.45,
    ),
  );
  cover.position.set(0, 0.14, 0.006);
  const pages = new Mesh(new BoxGeometry(0.2, 0.28, 0.01), b.plain(C.bookletPaper, 0.8));
  pages.position.set(0, 0.14, 0);
  pages.castShadow = true;
  booklet.add(pages, cover);
  b.root.add(booklet);
  b.spots.push({ kind: 'guide', name: 'Guide booklet', x: cx - 0.95, z: cz + 0.85, reach: 0.75 });
  b.read('Front desk', 'Examine', cx + 0.1, cz + 0.85, [
    'Nobody at the desk. The price list says: internet £1 per 30 minutes, printing 10p a page.',
    'A Post-it note beside it: "The ones with yellow markers are free. Help yourself."',
  ]);

  // Notices on the wall
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
 * A computer desk: desk (custom slot computer-desk), computer (crt-pc or imac-g3) and chair (office-chair).
 * A mesh named SCREEN in a custom computer model is replaced by the screen image.
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
      // Custom computer model: swap its SCREEN mesh for the screen image and aim the camera push at its centre
      const screen = model.getObjectByName('SCREEN') as Mesh | undefined;
      if (!screen) return;
      screen.material = screenMaterial;
      model.updateWorldMatrix(true, true);
      screen.geometry.computeBoundingBox();
      screen.geometry.boundingBox!.getCenter(screenCenter);
      screen.localToWorld(screenCenter);
    },
  );

  // Chair (custom slot office-chair)
  const seatZ = z + 0.85;
  const chair = b.custom('office-chair', x, seatZ, 0, (p) => {
    const fabric = b.plain(C.plasticDark, 0.8);
    p.add(placeholderBox(0.5, 0.08, 0.5, 0, SEAT_HEIGHT - 0.08, 0, fabric));
    p.add(placeholderBox(0.5, 0.6, 0.06, 0, SEAT_HEIGHT, 0.25, fabric));
    p.add(placeholderBox(0.06, SEAT_HEIGHT - 0.08, 0.06, 0, 0, 0, b.plain(C.metalDark, 0.4, 0.8)));
  });

  switch (machine.kind) {
    case 'level': {
      // Only play computers get a marker; the editors and showcase computers behind them stay unmarked (doc/hub.md)
      if (machine.level.role === 'levels') {
        const marker = new Mesh(new OctahedronGeometry(0.12, 0), b.glow(null, C.marker, 6));
        marker.position.set(x, 1.75, z - 0.1);
        b.root.add(marker);
        b.animations.push((t) => {
          marker.position.y = 1.75 + Math.sin(t * 2.4 + x) * 0.06;
          marker.rotation.y = t * 1.6;
        });
      }
      b.spots.push({
        kind: 'level',
        levelId: machine.level.levelId,
        x,
        z: seatZ,
        reach: 1.0,
        seat: { x, z: seatZ, heading: Math.PI },
        screen: screenCenter,
        screenMaterial,
        chair,
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

// ---------- Record shop ----------

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

  // Steel shelving along the walls and down the middle with boxes on it (custom CD racks later)
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

  // Counter (custom slot shop-counter)
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

// ---------- Arcade ----------

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

  // Four arcade cabinets along the back wall (custom slot arcade-cabinet)
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
    b.read('Arcade machine', 'Examine', cx, cz + 1.3, notes[i]!, 0.9, true);
  });

  // Dance machine (custom slot dance-machine)
  // Console demo stand: a low cabinet (custom slot tv-stand) with an old TV, console and controllers
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

  buildDanceMachine(b, left + 2, back + 6);
}

/** Height of the dance pad's top, where the player stands */
const PAD_TOP = 0.12;

/**
 * The dance machine (custom slot dance-machine, doc/dance-machine.md): a pad with four glowing arrow panels and a
 * safety bar behind the player, facing a cabinet with speakers, a marquee and a screen running the attract loop.
 * The origin is the pad's centre; the cabinet is towards -Z.
 */
function buildDanceMachine(b: Builder, x: number, z: number): void {
  const attract = new DanceAttractScreen();
  const screenMaterial = b.glow(attract.texture, '#ffffff', 1.1);
  const screen = new Vector3(x, 1.42, z - 0.9);
  const arrowTexture = padArrowTexture();
  const panels: { key: Arrow; material: MeshStandardMaterial }[] = [];

  b.custom(
    'dance-machine',
    x,
    z,
    0,
    (p) => {
      const metal = b.plain(C.metal, 0.35, 0.8);
      const body = b.plain(C.plasticDark, 0.45);
      // Pad: a metal frame, four dark arrow panels with glowing arrows, the centre and corners bare metal
      p.add(placeholderBox(1.6, PAD_TOP - 0.02, 1.6, 0, 0, 0, metal));
      const pad: [Arrow, number, number, number, string][] = [
        ['up', 0, -0.5, 0, C.neonPink],
        ['down', 0, 0.5, Math.PI, C.neonPink],
        ['left', -0.5, 0, Math.PI / 2, C.neonCyan],
        ['right', 0.5, 0, -Math.PI / 2, C.neonCyan],
      ];
      for (const [key, px, pz, turn, color] of pad) {
        p.add(placeholderBox(0.46, 0.02, 0.46, px, PAD_TOP - 0.02, pz, b.plain('#1a1830', 0.3)));
        const material = b.glow(arrowTexture, color, 0.7);
        const decal = new Mesh(new PlaneGeometry(0.38, 0.38), material);
        // Lying flat: the arrow's top points to -Z (towards the screen) before turning for its direction
        decal.rotation.set(-Math.PI / 2, 0, turn);
        decal.position.set(px, PAD_TOP + 0.002, pz);
        p.add(decal);
        panels.push({ key, material });
      }
      p.add(
        placeholderBox(0.46, 0.012, 0.46, 0, PAD_TOP - 0.02, 0, b.plain(C.metalDark, 0.4, 0.8)),
      );

      // Safety bar behind the player
      const bar = b.plain(C.metal, 0.25, 0.9);
      for (const side of [-1, 1]) {
        const post = new Mesh(new CylinderGeometry(0.03, 0.03, 1.0, 12), bar);
        post.position.set(side * 0.78, 0.5 + PAD_TOP, 0.78);
        p.add(post);
      }
      const rail = new Mesh(new CylinderGeometry(0.03, 0.03, 1.56, 12), bar);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 1.0 + PAD_TOP, 0.78);
      p.add(rail);

      // Cabinet: base, screen housing, speaker towers with cones, marquee, light strips
      p.add(placeholderBox(1.3, 0.95, 0.6, 0, 0, -1.15, body));
      p.add(placeholderBox(1.2, 0.95, 0.55, 0, 0.95, -1.18, body));
      const screenMesh = new Mesh(new PlaneGeometry(0.96, 0.72), screenMaterial);
      screenMesh.position.set(0, 1.42, -0.9);
      p.add(screenMesh);
      p.add(placeholderBox(1.0, 0.06, 0.24, 0, 0.9, -0.8, body));
      for (const side of [-1, 1]) {
        const button = new Mesh(
          new CylinderGeometry(0.035, 0.035, 0.03, 16),
          b.glow(null, side < 0 ? C.signRed : C.signGreen, 1.4),
        );
        button.position.set(side * 0.2, 0.975, -0.78);
        p.add(button);
      }
      const rubber = b.plain('#141414', 0.9);
      for (const side of [-1, 1]) {
        p.add(placeholderBox(0.3, 1.9, 0.5, side * 0.8, 0, -1.1, body));
        for (const [cy, radius] of [
          [0.45, 0.11],
          [1.15, 0.11],
          [1.62, 0.05],
        ] as const) {
          const cone = new Mesh(new CylinderGeometry(radius, radius * 0.8, 0.03, 24), rubber);
          cone.rotation.x = Math.PI / 2;
          cone.position.set(side * 0.8, cy, -0.84);
          p.add(cone);
        }
        p.add(
          placeholderBox(0.03, 1.8, 0.03, side * 0.63, 0.05, -0.86, b.glow(null, C.neonCyan, 2)),
        );
      }
      const marquee = signTexture({
        text: 'DANCE MACHINE',
        sub: 'FUNLAND AMUSEMENTS',
        background: C.plasticDark,
        color: C.neonPink,
        border: C.neonCyan,
      });
      // Marquee: a box with the lit sign on its front face only, so the lettering isn't tiled
      p.add(placeholderBox(1.9, 0.36, 0.55, 0, 1.9, -1.12, body));
      const sign = new Mesh(new PlaneGeometry(1.84, 0.32), b.glow(marquee, '#ffffff', 1.4));
      sign.position.set(0, 2.08, -0.843);
      p.add(sign);
    },
    (model) => {
      // Custom model: its SCREEN mesh shows the attract loop and the camera pushes in on its centre
      const mesh = model.getObjectByName('SCREEN');
      if (!(mesh instanceof Mesh)) return;
      mesh.material = screenMaterial;
      model.updateWorldMatrix(true, true);
      mesh.geometry.computeBoundingBox();
      mesh.geometry.boundingBox!.getCenter(screen);
      mesh.localToWorld(screen);
    },
  );
  b.colliders.push(boxAt(x, z - 1.12, 1.9, 0.6));
  b.animations.push((t) => {
    attract.update(t);
    const lit = attract.litKeys(t);
    for (const { key, material } of panels)
      material.emissiveIntensity = lit.includes(key) ? 3 : 0.7;
  });
  b.game({
    name: 'Dance machine',
    x,
    z,
    reach: 1.0,
    stand: { x, z, heading: headingOf({ x: 0, z: -1 }) },
    screen,
  });
}

// ---------- A millennial British high street ----------

/** Banners, LED tickers, window posters, street signs, pub signs: the things all over a British high street around 2000 (English text only) */
function buildMillennium(b: Builder): void {
  // HIGH STREET sign: the standard British black on white with a red border, fixed above a ground floor
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

  // Pub sign: an iron bracket off the wall with a two-sided board hanging below
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

  // A cloth banner across the road, tied to the buildings at both ends
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
    // Two single-sided panels back to back, so it reads correctly from both ends of the street
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

  // LED ticker on a south rooftop
  const led = ledTexture(
    '★ HAPPY NEW MILLENNIUM ★ 2000 ★ COUNTDOWN COMPLETE ★ Y2K OK ★',
    C.signYellow,
  );
  // Panel 7.2 × 0.9 m; the texture's 48 px height maps to 0.9 m and only part of its width shows
  const ledWidth = (led.image as HTMLCanvasElement).width;
  led.repeat.set(((7.2 / 0.9) * 48) / ledWidth, 1);
  const ledX = -4;
  const ledZ = SIDEWALK_EDGE - 0.1;
  b.box(7.6, 1.2, 0.3, ledX, 9.1, ledZ + 0.2, b.plain(C.metalDark, 0.5, 0.6));
  b.panel(7.2, 0.9, ledX, 9.7, ledZ, Math.PI, b.glow(led, '#ffffff', 4.5));
  b.animations.push((t) => {
    led.offset.x = (t * 0.06) % 1;
  });

  // TV wall at the electrical shop: two shelves of CRTs, all switched on
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

  // Second rooftop billboard: a computer advert
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

  // LED ticker inside the arcade's entrance
  const coin = ledTexture('10p A GO ★ INSERT COIN ★ HIGH SCORE ★ 2 PLAYERS ★', C.neonPink);
  coin.repeat.set(((3.2 / 0.4) * 48) / (coin.image as HTMLCanvasElement).width, 1);
  b.panel(3.2, 0.4, 16, 2.25, -SIDEWALK_EDGE - WALL - 0.03, 0, b.glow(coin, '#ffffff', 4.5));
  b.animations.push((t) => {
    coin.offset.x = (t * 0.09) % 1;
  });

  // Neon sign in the café window
  const open = signTexture({
    text: 'OPEN 7 DAYS',
    background: '#000000',
    color: C.neonCyan,
    border: C.neonPink,
    width: 256,
    height: 96,
  });
  b.panel(1.1, 0.42, 4.2, 2.0, -SIDEWALK_EDGE - WALL - 0.03, 0, b.glow(open, '#ffffff', 5));

  // Outside the newsstand: two stacked plastic crates as a counter, with portable stereos for sale
  b.prop('plastic_crate_01', -9.1, 0, 4.7, {
    height: 0.3,
    rotation: Math.PI / 2,
    collider: [0.45, 0.35],
  });
  b.prop('plastic_crate_01', -9.1, 0.3, 4.7, { height: 0.3, rotation: Math.PI / 2 + 0.1 });
  b.prop('portable_cassette_player', -9.2, 0.6, 4.65, { width: 0.14, rotation: 2.6 });
  b.prop('cassette_player', -8.95, 0.6, 4.7, { height: 0.15, rotation: 3.4 });

  // Posters in the shop windows (inside the glass, facing out)
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
