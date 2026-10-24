// The player character: the DeepSeek whale girl model (public/models/whale-girl.glb), from ai-girls-3d
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
/** How often she blinks (s) */
const BLINK_PERIOD = 3.7;
const BLINK_SECONDS = 0.16;

/** Axes in the character's frame: the model faces +z and +x is her left */
const SIDE_AXIS = new Vector3(1, 0, 0);
const UP_AXIS = new Vector3(0, 1, 0);

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
    const rig = this.rig;
    rig.reset();
    const swing = Math.sin(phase) * 0.42 * amount;
    // Stepping forward is negative rotation about the side axis
    rig.turn('thigh.L', SIDE_AXIS, -swing);
    rig.turn('thigh.R', SIDE_AXIS, swing);
    // Bend the knee a little when the leg is behind
    rig.turn('shin.L', SIDE_AXIS, Math.max(0, -swing) * 1.1);
    rig.turn('shin.R', SIDE_AXIS, Math.max(0, swing) * 1.1);
    rig.turn('skirt.L', SIDE_AXIS, -swing * 0.4);
    rig.turn('skirt.R', SIDE_AXIS, swing * 0.4);
    rig.turn('upper_arm.L', SIDE_AXIS, swing * 0.7);
    rig.turn('upper_arm.R', SIDE_AXIS, -swing * 0.7);
    rig.turn('spine', UP_AXIS, Math.sin(phase) * 0.06 * amount);
    rig.turn('tail.01', UP_AXIS, Math.sin(phase * 0.5) * 0.25 * amount);
    rig.turn('tail.02', UP_AXIS, Math.sin(phase * 0.5 - 0.6) * 0.3 * amount);
    rig.turn('tail.03', UP_AXIS, Math.sin(phase * 0.5 - 1.2) * 0.35 * amount);
    this.model!.position.y = Math.abs(Math.cos(phase)) * 0.025 * Math.min(amount, 1.5);
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
    const rig = this.rig;
    rig.reset();
    this.model!.position.y = sitting ? -this.sitDrop : 0;
    if (!sitting) return;
    // The leg weights can't take a 90° bend and tear the socks and skirt hem; turning the skirt forward too covers it
    for (const side of ['L', 'R']) {
      rig.turn(`thigh.${side}`, SIDE_AXIS, -Math.PI / 2);
      rig.turn(`shin.${side}`, SIDE_AXIS, Math.PI / 2);
      rig.turn(`skirt.${side}`, SIDE_AXIS, -0.8);
    }
    this.typingPose(0);
    // The tail goes round the left of the chair and lower: the seated camera is over the right shoulder, so it must not block the screen
    rig.turn('tail.01', UP_AXIS, -0.9);
    rig.turn('tail.01', SIDE_AXIS, -0.4);
  }

  type(t: number): void {
    if (!this.rig || !this.sitting) {
      this.fallback.type(t);
      return;
    }
    // Recompute the arms only, starting from their seated pose
    this.sit(true);
    this.typingPose(t);
  }

  /** Every frame: blinking */
  animate(t: number): void {
    const k = (t % BLINK_PERIOD) / BLINK_SECONDS;
    const closed = k < 1 ? Math.sin(k * Math.PI) : 0;
    for (const { mesh, index } of this.blinkTargets) {
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = closed;
    }
  }

  /**
   * Hands on the keyboard, forearms moving slightly over time.
   * The model's skin weights near the arms are messy and large upper-arm turns (inwards especially) tear the sleeves, so keep it small.
   */
  private typingPose(t: number): void {
    const rig = this.rig!;
    for (const [side, speed] of [
      ['L', 17],
      ['R', 13],
    ] as const) {
      rig.turn(`upper_arm.${side}`, SIDE_AXIS, -0.3);
      rig.turn(`forearm.${side}`, SIDE_AXIS, -0.6 + Math.sin(t * speed) * 0.04);
    }
  }
}
