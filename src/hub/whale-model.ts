// The player character: the DeepSeek whale girl model (assets/public/models/whale-girl.glb), from ai-girls-3d
// (Manny / ningfangtianwai-pixel, CC BY 4.0), compressed with glTF-Transform; see assets/README.md.
// It has no animations: walking, sitting and typing turn its bones in code; blinking uses its own morph targets.
// The code-built puppet (character.ts) shows until it loads, and stays if loading fails.

import {
  Box3,
  Group,
  PropertyBinding,
  Quaternion,
  Vector3,
  type Bone,
  type Mesh,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Character, SEAT_HEIGHT, WHALE_GIRL, type Figure } from './character.ts';

const MODEL_URL = `${import.meta.env.BASE_URL}models/whale-girl.glb`;
/** In-game height (m), matched to the chairs, desks and camera */
const HEIGHT = 1.6;
/** Blinking: one blink somewhere in each window of this length (s), sometimes two in a row */
const BLINK_WINDOW = 4.2;
const BLINK_SECONDS = 0.16;
/** One breath (s) */
const BREATH_SECONDS = 4.0;

/** Axes in the character's frame: the model faces +z and +x is her left */
const SIDE_AXIS = new Vector3(1, 0, 0);
const UP_AXIS = new Vector3(0, 1, 0);
const FORWARD_AXIS = new Vector3(0, 0, 1);

/** Smooth wandering value in about [-1, 1]: a few incommensurate sines, so it never visibly repeats */
function wander(x: number): number {
  return (Math.sin(x) + Math.sin(x * 2.31 + 1.3) * 0.5 + Math.sin(x * 0.57 + 2.1) * 0.7) / 2.2;
}

/** Repeatable 0–1 value for an integer, for the blink timing */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** How closed the eyes are at time t (0–1) */
function blinkAt(t: number): number {
  const window = Math.floor(t / BLINK_WINDOW);
  const local = t - window * BLINK_WINDOW;
  const start = 0.3 + hash(window) * (BLINK_WINDOW - 1);
  const starts = hash(window + 0.5) < 0.2 ? [start, start + 0.32] : [start];
  for (const s of starts) {
    const k = (local - s) / BLINK_SECONDS;
    if (k >= 0 && k < 1) return Math.sin(k * Math.PI);
  }
  return 0;
}

const smooth = (k: number) => {
  const x = Math.min(Math.max(k, 0), 1);
  return x * x * (3 - 2 * x);
};

/**
 * Turns bones about axes in the character's frame. Bones are looked up by their original names (e.g. `thigh.L`);
 * GLTFLoader strips characters such as "." (`thighL`), so lookups apply the same rule. Each bone's local axes differ,
 * so the axis is first converted into the bone parent's frame and then applied on top of the rest pose.
 */
class BoneRig {
  private readonly bones = new Map<
    string,
    { bone: Bone; rest: Quaternion; parentInverse: Quaternion }
  >();

  constructor(model: Object3D) {
    const modelInverse = model.getWorldQuaternion(new Quaternion()).invert();
    model.traverse((node) => {
      if (!(node as Bone).isBone || !node.parent) return;
      const parentInModel = modelInverse
        .clone()
        .multiply(node.parent.getWorldQuaternion(new Quaternion()));
      this.bones.set(node.name, {
        bone: node as Bone,
        rest: node.quaternion.clone(),
        parentInverse: parentInModel.invert(),
      });
    });
  }

  /** Back to the rest pose */
  reset(): void {
    for (const { bone, rest } of this.bones.values()) bone.quaternion.copy(rest);
  }

  /** Rotates by `angle` (radians) about `axis` in the character's frame, on top of the current pose */
  turn(name: string, axis: Vector3, angle: number): void {
    const entry = this.bones.get(PropertyBinding.sanitizeNodeName(name));
    if (!entry || angle === 0) return;
    const local = axis.clone().applyQuaternion(entry.parentInverse);
    entry.bone.quaternion.premultiply(new Quaternion().setFromAxisAngle(local, angle));
  }
}

export class WhaleAvatar implements Figure {
  readonly root = new Group();
  private readonly fallback = new Character(WHALE_GIRL);
  private rig: BoneRig | null = null;
  private model: Group | null = null;
  /** How far the model sinks when seated */
  private sitDrop = 0.3;
  /** Blinking: the mesh holding the morph target and its index */
  private blinkTargets: { mesh: Mesh; index: number }[] = [];
  private sitting = false;
  private phase = 0;
  private amount = 0;
  /** Hub time from animate(), for the idle motion */
  private time = 0;

  constructor() {
    this.root.add(this.fallback.root);
    void this.load();
  }

  private async load(): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    let gltf;
    try {
      gltf = await loader.loadAsync(MODEL_URL);
    } catch (error) {
      console.error('Failed to load the whale girl model; keeping the code-built puppet', error);
      return;
    }
    const model = gltf.scene;

    model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      // Skinned mesh bounds come from the bind pose and can wrongly cull once bones turn
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const dictionary = mesh.morphTargetDictionary ?? {};
      for (const name of ['Blink_L', 'Blink_R', 'Close']) {
        const index = dictionary[name];
        if (index !== undefined) this.blinkTargets.push({ mesh, index });
      }
    });

    // Scale to the in-game height with the feet at the origin
    const box = new Box3().setFromObject(model, true);
    const scale = HEIGHT / (box.max.y - box.min.y);
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale;
    model.updateMatrixWorld(true);

    const wrapper = new Group();
    wrapper.add(model);
    this.root.add(wrapper);
    this.root.updateMatrixWorld(true);
    this.rig = new BoneRig(model);

    // Seated, the pelvis must rest on the chair seat
    const pelvis = model.getObjectByName('pelvis');
    if (pelvis) {
      const hip = pelvis.getWorldPosition(new Vector3());
      this.root.worldToLocal(hip);
      this.sitDrop = Math.max(0, hip.y - SEAT_HEIGHT - 0.04);
    }

    this.root.remove(this.fallback.root);
    this.model = wrapper;
    this.sit(this.sitting);
    this.pose(this.phase, this.amount);
  }

  pose(phase: number, amount: number): void {
    this.phase = phase;
    this.amount = amount;
    if (!this.rig) {
      this.fallback.pose(phase, amount);
      return;
    }
    if (this.sitting) return;
    this.rig.reset();
    this.model!.position.y = this.standingPose(phase, amount);
  }

  /** Seated on a chair (sit(true)) */
  get isSitting(): boolean {
    return this.sitting;
  }

  sit(sitting: boolean): void {
    this.sitting = sitting;
    if (!this.rig) {
      this.fallback.sit(sitting);
      return;
    }
    this.rig.reset();
    if (sitting) {
      this.seatedPose(1, 0);
      this.model!.position.y = -this.sitDrop;
    } else {
      this.model!.position.y = this.standingPose(this.phase, 0);
    }
  }

  settle(k: number): void {
    if (!this.rig) {
      this.fallback.settle(k);
      return;
    }
    const s = smooth(k);
    this.sitting = s >= 1;
    this.rig.reset();
    // The last steps fade out while the body lowers into the seat
    const bob = s < 1 ? this.standingPose(this.phase + k * 6, 0.6 * (1 - s) * (1 - s)) : 0;
    this.seatedPose(s, 0);
    this.model!.position.y = bob * (1 - s) - this.sitDrop * s;
  }

  type(t: number): void {
    if (!this.rig || !this.sitting) {
      this.fallback.type(t);
      return;
    }
    this.rig.reset();
    this.seatedPose(1, t);
    this.model!.position.y = -this.sitDrop;
  }

  /** Every frame: blinking, and the clock the idle motion runs on */
  animate(t: number): void {
    this.time = t;
    const closed = blinkAt(t);
    for (const { mesh, index } of this.blinkTargets) {
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = closed;
    }
  }

  /**
   * Standing and walking, on top of the rest pose. `amount` is the stride (0 standing, 1 walking, more running).
   * Standing she breathes, shifts her weight and looks around; walking she leans in, hips and shoulders twist
   * against each other and the arms swing with bent elbows (doc/hub.md). Returns the model's bob height.
   */
  private standingPose(phase: number, amount: number): number {
    const rig = this.rig!;
    const t = this.time;
    const idle = Math.max(0, 1 - amount);
    const breath = Math.sin((t / BREATH_SECONDS) * Math.PI * 2);
    const step = Math.sin(phase);
    const swing = step * 0.42 * amount;

    // Breathing: the chest rises and the shoulders with it
    rig.turn('chest', SIDE_AXIS, breath * 0.018);
    rig.turn('clavicle.L', FORWARD_AXIS, breath * 0.015);
    rig.turn('clavicle.R', FORWARD_AXIS, -breath * 0.015);

    // Weight shifting from one leg to the other, the free knee softening
    const shift = wander(t * 0.23) * idle;
    rig.turn('pelvis', FORWARD_AXIS, shift * 0.035);
    rig.turn('spine', FORWARD_AXIS, -shift * 0.03);
    rig.turn('thigh.L', SIDE_AXIS, -Math.max(0, shift) * 0.06);
    rig.turn('shin.L', SIDE_AXIS, Math.max(0, shift) * 0.12);
    rig.turn('thigh.R', SIDE_AXIS, -Math.max(0, -shift) * 0.06);
    rig.turn('shin.R', SIDE_AXIS, Math.max(0, -shift) * 0.12);

    // Glancing around while standing; walking, the head stays with the body
    const look = wander(t * 0.17 + 4) * idle;
    rig.turn('neck', UP_AXIS, look * 0.14);
    rig.turn('head', UP_AXIS, look * 0.22);
    rig.turn('head', SIDE_AXIS, wander(t * 0.13 + 9) * 0.05 * idle);

    // Stride: stepping forward is negative rotation about the side axis
    rig.turn('thigh.L', SIDE_AXIS, -swing);
    rig.turn('thigh.R', SIDE_AXIS, swing);
    // The knee bends as the leg swings through behind
    rig.turn('shin.L', SIDE_AXIS, Math.max(0, -swing) * 1.1);
    rig.turn('shin.R', SIDE_AXIS, Math.max(0, swing) * 1.1);
    // The skirt follows a little late
    const lag = Math.sin(phase - 0.6) * 0.42 * amount;
    rig.turn('skirt.L', SIDE_AXIS, -lag * 0.45);
    rig.turn('skirt.R', SIDE_AXIS, lag * 0.45);

    // Arms: elbows slightly bent at rest, more on the forward swing
    const run = Math.max(0, amount - 1);
    rig.turn('upper_arm.L', SIDE_AXIS, swing * 0.65 - 0.04);
    rig.turn('upper_arm.R', SIDE_AXIS, -swing * 0.65 - 0.04);
    rig.turn(
      'forearm.L',
      SIDE_AXIS,
      -0.12 - 0.12 * amount - Math.max(0, -swing) * 0.45 - run * 0.5,
    );
    rig.turn('forearm.R', SIDE_AXIS, -0.12 - 0.12 * amount - Math.max(0, swing) * 0.45 - run * 0.5);

    // Hips turn with the leading leg, shoulders against them; a slight hip drop on each step
    rig.turn('pelvis', UP_AXIS, step * 0.09 * amount);
    rig.turn('pelvis', FORWARD_AXIS, -step * 0.03 * amount);
    rig.turn('chest', UP_AXIS, -step * 0.11 * amount);
    rig.turn('neck', UP_AXIS, step * 0.03 * amount);
    // Leaning into the stride, more when running
    rig.turn('spine', SIDE_AXIS, -0.035 * Math.min(amount, 1) - 0.13 * run);
    rig.turn('head', SIDE_AXIS, 0.03 * Math.min(amount, 1) + 0.08 * run);

    // The tail sways with the stride, and drifts a little at rest
    const tail = (k: number) =>
      Math.sin(phase * 0.5 - k) * amount + wander(t * 0.4 + k) * 0.3 * idle;
    rig.turn('tail.01', UP_AXIS, tail(0) * 0.25);
    rig.turn('tail.02', UP_AXIS, tail(0.6) * 0.3);
    rig.turn('tail.03', UP_AXIS, tail(1.2) * 0.35);

    return Math.abs(Math.cos(phase)) * 0.025 * Math.min(amount, 1.5);
  }

  /**
   * Seated at a desk, `s` of the way down (0 standing, 1 seated); t moves the typing hands.
   * The leg weights can't take a 90° bend and tear the socks and skirt hem; turning the skirt forward too covers it.
   * The model's skin weights near the arms are messy and large upper-arm turns (inwards especially) tear the sleeves,
   * so the arms stay within the angles here.
   */
  private seatedPose(s: number, t: number): void {
    const rig = this.rig!;
    for (const side of ['L', 'R']) {
      rig.turn(`thigh.${side}`, SIDE_AXIS, (-Math.PI / 2) * s);
      rig.turn(`shin.${side}`, SIDE_AXIS, (Math.PI / 2) * s);
      rig.turn(`skirt.${side}`, SIDE_AXIS, -0.8 * s);
    }
    // Hands on the keyboard, forearms moving slightly as she types
    for (const [side, speed] of [
      ['L', 17],
      ['R', 13],
    ] as const) {
      rig.turn(`upper_arm.${side}`, SIDE_AXIS, -0.6 * s);
      rig.turn(`forearm.${side}`, SIDE_AXIS, (-1.2 + Math.sin(t * speed) * 0.04) * s);
    }
    // Breathing, and the odd glance away from the screen
    const breath = Math.sin((this.time / BREATH_SECONDS) * Math.PI * 2);
    rig.turn('chest', SIDE_AXIS, breath * 0.015 * s);
    rig.turn('head', UP_AXIS, wander(this.time * 0.15 + 2) * 0.1 * s);
    // The tail goes round the left of the chair and lower: the seated camera is over the right shoulder, so it must not block the screen
    rig.turn('tail.01', UP_AXIS, -0.9 * s);
    rig.turn('tail.01', SIDE_AXIS, -0.4 * s);
  }
}
