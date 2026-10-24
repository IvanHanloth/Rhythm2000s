// 大厅的素材加载：GLB 模型、PBR 贴图、HDRI。素材来源与授权登记在 assets/README.md。
// 模型都是异步加载的：布景先放一个空的锚点，模型下载完再挂上去，所以画面不用等全部素材。

import {
  Box3,
  DoubleSide,
  Group,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const textureLoader = new TextureLoader();

// ---------- 模型 ----------

const modelCache = new Map<string, Promise<Group | null>>();

/** 加载 public/models/ 下的一个 GLB；失败时返回 null（调用方保留占位） */
export function loadModel(path: string): Promise<Group | null> {
  let promise = modelCache.get(path);
  if (!promise) {
    promise = gltfLoader.loadAsync(`${BASE}models/${path}`).then(
      (gltf) => {
        gltf.scene.traverse((node) => {
          const mesh = node as Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
        return gltf.scene;
      },
      (error: unknown) => {
        console.warn(`模型 ${path} 加载失败`, error);
        return null;
      },
    );
    modelCache.set(path, promise);
  }
  return promise;
}

export interface PropOptions {
  /** 把模型缩放到这个高度（米）；不写时按原尺寸 */
  height?: number;
  /** 把模型缩放到这个宽度（米，x 方向）；和 height 只用一个 */
  width?: number;
  /** 绕竖轴转多少（弧度） */
  rotation?: number;
  /** 底面中心对齐到锚点（默认）；false 时保留模型自己的原点（吊扇、壁挂物） */
  groundAlign?: boolean;
}

/**
 * 在 anchor 下挂一份模型的副本。加载完成前 placeholder（如果有）先顶着，加载成功后移除。
 * 同一个模型可以挂很多份，几何体和材质共用。
 */
export function attachModel(
  anchor: Group,
  path: string,
  options: PropOptions = {},
  placeholder?: Object3D,
): void {
  if (placeholder) anchor.add(placeholder);
  void loadModel(path).then((template) => {
    if (!template) return;
    const model = template.clone(true);
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    let scale = 1;
    if (options.height) scale = options.height / size.y;
    else if (options.width) scale = options.width / size.x;
    model.scale.setScalar(scale);
    if (options.groundAlign ?? true) {
      const center = box.getCenter(new Vector3());
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    }
    const holder = new Group();
    holder.rotation.y = options.rotation ?? 0;
    holder.add(model);
    if (placeholder) anchor.remove(placeholder);
    anchor.add(holder);
  });
}

// ---------- PBR 贴图 ----------

/** public/textures/ 下的贴图套装（Poly Haven，CC0）：颜色、法线、粗糙度 */
export type SurfaceName =
  | 'asphalt_02'
  | 'square_concrete_pavers'
  | 'rectangular_facade_tiles'
  | 'red_brick_03'
  | 'painted_plaster_wall'
  | 'painted_metal_shutter'
  | 'floor_tiles_06'
  | 'dirty_carpet';

export interface SurfaceOptions {
  /** 贴图一格对应多少米 */
  tile: number;
  /** 乘在颜色贴图上的颜色，用来把同一套墙面染成不同的楼 */
  tint?: string;
  doubleSided?: boolean;
}

const textureCache = new Map<string, Texture>();
function texture(path: string, color: boolean): Texture {
  let t = textureCache.get(path);
  if (!t) {
    t = textureLoader.load(`${BASE}textures/${path}`);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.anisotropy = 8;
    if (color) t.colorSpace = SRGBColorSpace;
    textureCache.set(path, t);
  }
  return t;
}

/**
 * 写实表面材质。贴图按「每米多少格」平铺：几何体的 UV 要以米为单位（见 world.ts 的 meterBox），
 * 材质再按 1 / tile 缩放，所以同一种材质贴在大小不同的墙上，砖块大小一致。
 */
export function surface(name: SurfaceName, options: SurfaceOptions): MeshStandardMaterial {
  const repeat = 1 / options.tile;
  const scaled = (t: Texture) => {
    const copy = t.clone();
    copy.repeat.set(repeat, repeat);
    return copy;
  };
  return new MeshStandardMaterial({
    map: scaled(texture(`${name}/diff.webp`, true)),
    normalMap: scaled(texture(`${name}/nor.webp`, false)),
    roughnessMap: scaled(texture(`${name}/rough.webp`, false)),
    color: options.tint ?? '#ffffff',
    side: options.doubleSided ? DoubleSide : undefined,
  });
}

// ---------- 自制模型槽位 ----------

/**
 * 需要定制的模型（网吧电脑、街机、报刊亭……）由用户用 Tripo / Blender 制作，规格见 doc/hub-assets.md。
 * 文件放在 public/models/custom/<槽位>.glb，并把槽位名加进同目录的 manifest.json；
 * 清单里没有的槽位不去请求，直接用占位形体。
 */
let customSlots: Promise<Set<string>> | null = null;
function loadCustomSlots(): Promise<Set<string>> {
  customSlots ??= fetch(`${BASE}models/custom/manifest.json`)
    .then(async (response) => {
      if (!response.ok) return new Set<string>();
      const manifest = (await response.json()) as { slots?: string[] };
      return new Set(manifest.slots ?? []);
    })
    .catch(() => new Set<string>());
  return customSlots;
}

/**
 * 自制模型：清单里有这个槽位时加载 custom/<槽位>.glb 替换占位，否则一直用占位。
 * 自制模型按 doc/hub-assets.md 的规格做，原尺寸使用，不缩放。onLoaded 在模型挂上去之后调用。
 */
export function attachCustom(
  anchor: Group,
  slot: string,
  placeholder: Object3D,
  options: { rotation?: number; onLoaded?: (model: Object3D) => void } = {},
): void {
  anchor.add(placeholder);
  void loadCustomSlots().then((slots) => {
    if (!slots.has(slot)) return;
    void loadModel(`custom/${slot}.glb`).then((template) => {
      if (!template) return;
      const model = template.clone(true);
      model.rotation.y = options.rotation ?? 0;
      anchor.remove(placeholder);
      anchor.add(model);
      options.onLoaded?.(model);
    });
  });
}
