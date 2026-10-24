// 备用人偶：鲸鱼娘模型（whale-model.ts）下载完成前、或下载失败时显示的玩家角色。
// 二头身的动漫风人偶，用球、胶囊、锥体拼成，卡通着色（三阶明暗）+ 描边，眼睛是贴花；
// 外形按鲸鱼娘的常见特征：蓝色长发、鲸鱼尾巴形状的呆毛、水手服 + 百褶裙、身后一条鲸鱼尾巴。
// 原点在脚底，默认面朝 +z。

import {
  BackSide,
  CapsuleGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  type BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import { STREET_COLORS as C } from '../theme/street.ts';
import { blushTexture, eyeTexture, mouthTexture } from './textures.ts';

export interface Outfit {
  /** 上衣 */
  shirt: string;
  /** 裤子；穿裙子时是裙子的颜色 */
  pants: string;
  shoes?: string;
  hair?: string;
  /** 头发暗部 */
  hairShade?: string;
  /** 瞳色 */
  eyes?: string;
  /** 领子、袖口、领结的颜色；不写时没有水手领 */
  accent?: string;
  /** 穿裙子 + 长袜，否则是长裤 */
  skirt?: boolean;
  socks?: string;
  longHair?: boolean;
  /** 鲸鱼的呆毛和尾巴 */
  whale?: boolean;
}

/** 备用人偶的鲸鱼娘造型 */
export const WHALE_GIRL: Outfit = {
  shirt: C.whaleShirt,
  pants: C.whaleSkirt,
  shoes: C.whaleShoe,
  hair: C.whaleHair,
  hairShade: C.whaleHairDark,
  eyes: C.whaleEye,
  accent: C.whaleBlue,
  skirt: true,
  socks: C.whaleSock,
  longHair: true,
  whale: true,
};

/** 大厅里的人物：鲸鱼娘模型和备用人偶都实现这几个动作 */
export interface Figure {
  readonly root: Group;
  /** 走路姿势：phase 是步伐相位（弧度），amount 是摆动幅度（0 站定，1 走，更大是跑） */
  pose(phase: number, amount: number): void;
  /** 坐下 / 站起 */
  sit(sitting: boolean): void;
  /** 坐着时手指在键盘上动；t 单位是秒 */
  type(t: number): void;
  /** 每帧调用的小动作（眨眼等）；t 单位是秒 */
  animate?(t: number): void;
}

/** 坐下时臀部离地的高度，椅面要做成这么高 */
export const SEAT_HEIGHT = 0.5;
const HIP_HEIGHT = 0.64;
/** 描边粗细（米）。太细时离远了会闪 */
const OUTLINE_WIDTH = 0.009;

// ---------- 材质 ----------

/** 三阶明暗的色带，做出赛璐璐的感觉 */
const toonGradient = (() => {
  const texture = new DataTexture(new Uint8Array([90, 175, 255]), 3, 1, RedFormat);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
})();

const toonCache = new Map<string, MeshToonMaterial>();
function toon(color: string, doubleSided = false): MeshToonMaterial {
  const key = `${color}/${doubleSided}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new MeshToonMaterial({
      color,
      gradientMap: toonGradient,
      side: doubleSided ? DoubleSide : undefined,
    });
    toonCache.set(key, m);
  }
  return m;
}

/** 描边：把背面沿法线往外推一点，画成深色（inverted hull） */
const outline = (() => {
  const m = new MeshBasicMaterial({ color: C.whaleEyeDark, side: BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\ntransformed += normal * ${OUTLINE_WIDTH.toFixed(4)};`,
    );
  };
  m.customProgramCacheKey = () => 'hub-outline';
  return m;
})();

function decal(map: Texture): MeshBasicMaterial {
  return new MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

/** 一个零件：封闭的形状加描边，开口的形状（裙子、头发壳）不描边 */
function piece(
  parent: Group,
  geometry: BufferGeometry,
  material: Material,
  position: [number, number, number],
  options: {
    scale?: [number, number, number];
    rotation?: [number, number, number];
    outlined?: boolean;
  } = {},
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...position);
  if (options.scale) mesh.scale.set(...options.scale);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh);
  if (options.outlined ?? true) mesh.add(new Mesh(geometry, outline));
  return mesh;
}

// ---------- 几何体 ----------

/** 百褶裙：上窄下宽的开口锥台，下摆一圈一里一外地折 */
function pleatedSkirt(top: number, bottom: number, height: number): BufferGeometry {
  const geometry = new CylinderGeometry(top, bottom, height, 20, 1, true);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) > 0) continue;
    const segment = i % 21;
    const k = segment % 2 === 0 ? 1 : 0.9;
    position.setX(i, position.getX(i) * k);
    position.setZ(i, position.getZ(i) * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** 两头粗细不同的圆柱，沿 -z 方向伸出（尾巴用） */
function taper(from: number, to: number, length: number): BufferGeometry {
  const geometry = new CylinderGeometry(to, from, length, 12);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -length / 2);
  return geometry;
}

export class Character implements Figure {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly legs: Group[] = [];
  private readonly arms: Group[] = [];
  private readonly head = new Group();
  private readonly tail: Group | null = null;
  private readonly tailTip = new Group();
  private readonly ahoge = new Group();
  private sitting = false;

  constructor(outfit: Outfit) {
    const {
      shirt,
      pants,
      shoes = C.plasticDark,
      hair = C.hair,
      hairShade = hair,
      eyes = C.trunk,
      accent,
      skirt = false,
      socks = pants,
      longHair = false,
      whale = false,
    } = outfit;
    const body = this.body;
    this.root.add(body);
    const skin = toon(C.skin);

    // 腿：大腿 + 小腿（长袜或裤腿）+ 圆头鞋
    for (const side of [-1, 1]) {
      const leg = new Group();
      leg.position.set(side * 0.07, HIP_HEIGHT, 0);
      piece(leg, new CapsuleGeometry(0.056, 0.2, 4, 10), skirt ? skin : toon(pants), [0, -0.15, 0]);
      piece(leg, new CapsuleGeometry(0.05, 0.24, 4, 10), toon(socks), [0, -0.4, 0]);
      piece(leg, new SphereGeometry(0.06, 12, 8), toon(shoes), [0, -0.6, 0.03], {
        scale: [1, 0.6, 1.5],
      });
      this.legs.push(leg);
      body.add(leg);
    }

    piece(body, new SphereGeometry(0.1, 14, 10), toon(pants), [0, HIP_HEIGHT + 0.02, 0], {
      scale: [1.15, 0.75, 0.85],
    });
    if (skirt) {
      piece(body, pleatedSkirt(0.11, 0.21, 0.2), toon(pants, true), [0, HIP_HEIGHT - 0.02, 0], {
        outlined: false,
      });
    }

    // 上身
    piece(body, new CapsuleGeometry(0.105, 0.15, 6, 14), toon(shirt), [0, HIP_HEIGHT + 0.21, 0], {
      scale: [1, 1, 0.8],
    });
    if (accent) {
      // 水手服的披肩领 + 胸前领结
      piece(
        body,
        new SphereGeometry(0.122, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.36),
        toon(accent, true),
        [0, HIP_HEIGHT + 0.3, -0.004],
        { scale: [1.04, 1, 0.86], outlined: false },
      );
      const ribbon = toon(C.whaleRibbon);
      for (const side of [-1, 1]) {
        piece(
          body,
          new ConeGeometry(0.03, 0.06, 8),
          ribbon,
          [side * 0.03, HIP_HEIGHT + 0.31, 0.088],
          {
            rotation: [0, 0, side * (Math.PI / 2)],
            scale: [1, 1, 0.5],
          },
        );
      }
      piece(body, new SphereGeometry(0.016, 8, 6), ribbon, [0, HIP_HEIGHT + 0.31, 0.092]);
    }
    piece(body, new CylinderGeometry(0.035, 0.04, 0.08, 10), skin, [0, HIP_HEIGHT + 0.42, 0], {
      outlined: false,
    });

    // 手臂：泡泡袖 + 袖口 + 小臂 + 手
    for (const side of [-1, 1]) {
      const arm = new Group();
      arm.position.set(side * 0.13, HIP_HEIGHT + 0.34, 0);
      piece(arm, new SphereGeometry(0.052, 12, 8), toon(shirt), [0, -0.03, 0]);
      piece(arm, new CapsuleGeometry(0.038, 0.08, 4, 10), toon(shirt), [0, -0.08, 0]);
      if (accent) {
        piece(arm, new CylinderGeometry(0.042, 0.042, 0.022, 12), toon(accent), [0, -0.135, 0]);
      }
      piece(arm, new CapsuleGeometry(0.03, 0.11, 4, 10), skin, [0, -0.21, 0]);
      piece(arm, new SphereGeometry(0.034, 10, 8), skin, [0, -0.295, 0]);
      this.arms.push(arm);
      body.add(arm);
    }

    this.buildHead(hair, hairShade, eyes, longHair, whale);

    if (whale) {
      // 鲸鱼尾巴：从后腰伸出，往下垂再翘起，末端是两片尾鳍
      const tail = new Group();
      tail.position.set(0, HIP_HEIGHT + 0.02, -0.07);
      const blue = toon(C.whaleBlue);
      piece(tail, taper(0.06, 0.04, 0.24), blue, [0, 0, 0]);
      this.tailTip.position.set(0, 0, -0.24);
      piece(this.tailTip, new SphereGeometry(0.04, 10, 8), blue, [0, 0, 0]);
      piece(this.tailTip, taper(0.04, 0.022, 0.15), blue, [0, 0, 0]);
      for (const side of [-1, 1]) {
        piece(
          this.tailTip,
          new SphereGeometry(0.06, 14, 8),
          toon(C.whaleBelly),
          [side * 0.06, 0, -0.18],
          {
            scale: [1.4, 0.28, 0.6],
            rotation: [0, side * 0.5, 0],
          },
        );
      }
      tail.add(this.tailTip);
      body.add(tail);
      this.tail = tail;
    }
    this.restTail(0);
  }

  private buildHead(
    hair: string,
    hairShade: string,
    eyes: string,
    longHair: boolean,
    whale: boolean,
  ): void {
    const head = this.head;
    head.position.y = HIP_HEIGHT + 0.58;
    this.body.add(head);
    const R = 0.19;
    piece(head, new SphereGeometry(R, 28, 20), toon(C.skin), [0, 0, 0], { scale: [1, 0.97, 0.95] });

    // 脸：贴花，稍微浮在脸的表面上，朝向脸的法线
    const onFace = (map: Texture, w: number, h: number, x: number, y: number) => {
      const mesh = new Mesh(new PlaneGeometry(w, h), decal(map));
      const normal = new Vector3(x, y, Math.sqrt(Math.max(0, R * R - x * x - y * y))).normalize();
      mesh.position.copy(normal).multiplyScalar(R * 0.952);
      mesh.lookAt(normal.multiplyScalar(2));
      head.add(mesh);
    };
    const lash = C.whaleEyeDark;
    const shade = C.whaleEyeDark;
    onFace(eyeTexture(eyes, shade, lash, true), 0.07, 0.093, -0.068, -0.03);
    onFace(eyeTexture(eyes, shade, lash, false), 0.07, 0.093, 0.068, -0.03);
    onFace(mouthTexture(C.signRed), 0.04, 0.02, 0, -0.105);
    onFace(blushTexture(C.blush), 0.06, 0.03, -0.11, -0.075);
    onFace(blushTexture(C.blush), 0.06, 0.03, 0.11, -0.075);

    // 头发：头顶一整块 + 后脑和两侧一块（前面留出脸）+ 刘海
    const hairToon = toon(hair, true);
    const HR = 0.207;
    piece(
      head,
      new SphereGeometry(HR, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.37),
      hairToon,
      [0, 0.012, -0.004],
      {
        outlined: false,
      },
    );
    piece(
      head,
      new SphereGeometry(
        HR,
        28,
        14,
        Math.PI / 2 + 0.95,
        Math.PI * 2 - 1.9,
        0,
        Math.PI * (longHair ? 0.68 : 0.6),
      ),
      hairToon,
      [0, 0.012, -0.006],
      { outlined: false },
    );
    const strand = toon(hair);
    const bangs = [-0.62, -0.32, 0, 0.3, 0.6];
    bangs.forEach((a, i) => {
      const length = i === 2 ? 0.1 : 0.13;
      piece(
        head,
        new ConeGeometry(0.045, length, 6),
        strand,
        [Math.sin(a) * 0.19, 0.075 - length / 2 + 0.03, Math.cos(a) * 0.185],
        {
          rotation: [Math.PI - 0.25, a, 0],
          scale: [1, 1, 0.45],
        },
      );
    });
    // 两侧垂在脸边的鬓发
    for (const side of [-1, 1]) {
      piece(
        head,
        new CapsuleGeometry(0.032, longHair ? 0.22 : 0.1, 4, 8),
        strand,
        [side * 0.17, longHair ? -0.12 : -0.05, 0.06],
        {
          scale: [1, 1, 0.6],
          rotation: [0.1, 0, side * 0.08],
        },
      );
    }
    if (longHair) {
      // 后面的长发垂到腰，内层颜色深一点
      piece(head, new CapsuleGeometry(0.16, 0.34, 6, 16), strand, [0, -0.3, -0.1], {
        scale: [1.08, 1, 0.38],
      });
      piece(head, new CapsuleGeometry(0.14, 0.3, 6, 16), toon(hairShade), [0, -0.3, -0.07], {
        scale: [1, 1, 0.3],
        outlined: false,
      });
    }

    if (whale) {
      // 头顶鲸鱼尾巴形状的呆毛：一根弯的发丝，顶端两片尾鳍
      this.ahoge.position.set(0, R * 0.93, 0.02);
      const curve = new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.0, 0.06, 0.02),
        new Vector3(0.025, 0.11, -0.01),
      ]);
      piece(this.ahoge, new TubeGeometry(curve, 10, 0.012, 6), strand, [0, 0, 0]);
      for (const side of [-1, 1]) {
        piece(
          this.ahoge,
          new SphereGeometry(0.04, 12, 8),
          toon(C.whaleBlue),
          [0.025 + side * 0.04, 0.125, -0.01],
          {
            scale: [1.3, 0.35, 0.55],
            rotation: [0, 0, side * 0.45],
          },
        );
      }
      head.add(this.ahoge);
    }
  }

  /**
   * 走路姿势：phase 是步伐相位（弧度，随走过的距离增加），amount 是摆动幅度（0 站定，1 正常走，更大是跑）。
   */
  pose(phase: number, amount: number): void {
    if (this.sitting) return;
    const swing = Math.sin(phase) * 0.55 * amount;
    this.legs[0]!.rotation.x = swing;
    this.legs[1]!.rotation.x = -swing;
    this.arms[0]!.rotation.set(-swing * 0.8, 0, -0.14);
    this.arms[1]!.rotation.set(swing * 0.8, 0, 0.14);
    this.body.position.y = Math.abs(Math.cos(phase)) * 0.03 * Math.min(amount, 1.5);
    this.head.rotation.z = Math.sin(phase) * 0.04 * amount;
    this.restTail(Math.sin(phase * 0.5) * 0.35 * amount);
    this.ahoge.rotation.z = Math.sin(phase) * 0.18 * amount;
  }

  /** 坐姿：大腿朝前伸，手放在键盘上 */
  sit(sitting: boolean): void {
    this.sitting = sitting;
    this.body.position.y = sitting ? SEAT_HEIGHT - HIP_HEIGHT : 0;
    this.head.rotation.z = 0;
    for (const leg of this.legs) leg.rotation.x = sitting ? -Math.PI / 2 : 0;
    for (const arm of this.arms) arm.rotation.set(sitting ? -1.1 : 0, 0, 0);
    if (sitting && this.tail) {
      // 尾巴绕到椅子一侧，不穿过椅背
      this.tail.rotation.set(-0.5, 1.3, 0);
      this.tailTip.rotation.set(0.5, 0.4, 0);
    } else {
      this.restTail(0);
    }
  }

  /** 坐着时手指在键盘上动；t 单位是秒 */
  type(t: number): void {
    if (!this.sitting) return;
    this.arms[0]!.rotation.x = -1.1 + Math.sin(t * 17) * 0.06;
    this.arms[1]!.rotation.x = -1.1 + Math.sin(t * 13 + 1) * 0.06;
    this.tailTip.rotation.y = 0.4 + Math.sin(t * 1.8) * 0.25;
    this.ahoge.rotation.z = Math.sin(t * 2.2) * 0.08;
  }

  /** 站着时尾巴略向下垂再翘起，sway 是左右摆动的角度 */
  private restTail(sway: number): void {
    if (!this.tail) return;
    this.tail.rotation.set(-0.4, sway, 0);
    this.tailTip.rotation.set(0.55, sway * 0.8, 0);
  }
}
