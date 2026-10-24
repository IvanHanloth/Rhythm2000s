// Hub asset loading: GLB models and PBR textures. Sources and licences are listed in assets/README.md.
// Models load asynchronously: the set places empty anchors and attaches each model when it arrives, so nothing waits for everything.

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

// ---------- Models ----------

const modelCache = new Map<string, Promise<Group | null>>();

/** Loads a GLB under public/models/; null on failure (the caller keeps its placeholder) */
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
          // Stock models' own emissive parts (tubes, indicator lights) stay out of the bloom, which is reserved for our signs and lights (hub.ts)
          for (const material of [mesh.material].flat()) {
            const standard = material as MeshStandardMaterial;
            if (standard.isMeshStandardMaterial && standard.emissiveIntensity > 1) {
              standard.emissiveIntensity = 1;
            }
          }
        });
        return gltf.scene;
      },
      (error: unknown) => {
        console.warn(`Failed to load model ${path}`, error);
        return null;
      },
    );
    modelCache.set(path, promise);
  }
  return promise;
}

export interface PropOptions {
  /** Scale the model to this height (m); original size if omitted */
  height?: number;
  /** Scale the model to this width (m, along x); use either this or height */
  width?: number;
  /** Rotation about the vertical axis (radians) */
  rotation?: number;
  /** Centre the model's base on the anchor (default); false keeps the model's own origin (ceiling fans, wall pieces) */
  groundAlign?: boolean;
}

/**
 * Attaches a copy of a model under `anchor`. A placeholder, if given, stands in until it loads and is removed on success.
 * Many copies of one model share its geometry and materials.
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

// ---------- PBR textures ----------

/** Texture sets under public/textures/ (Poly Haven, CC0): colour, normal and roughness */
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
  /** Metres per texture tile */
  tile: number;
  /** Tint multiplied into the colour map, to make one wall set into different buildings */
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
 * Realistic surface material, tiled per metre: geometry UVs must be in metres (see meterBox in world.ts).
 * The material is scaled by 1 / tile, so walls of any size share the same brick size.
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

// ---------- Custom model slots ----------

/**
 * Bespoke models (café computers, arcade cabinets, the newsstand…) are made by the user in Tripo / Blender to the spec in
 * doc/hub-assets.md, saved as public/models/custom/<slot>.glb and listed in that folder's manifest.json;
 * slots missing from the manifest are never requested and keep their placeholder.
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
 * Custom model: loads custom/<slot>.glb over the placeholder when the manifest lists the slot, otherwise keeps the placeholder.
 * Custom models are built to doc/hub-assets.md and used at original size. onLoaded runs once the model is attached.
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
