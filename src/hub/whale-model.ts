// 玩家角色：DeepSeek 鲸鱼娘的 3D 模型（public/models/whale-girl.glb）。
// 模型来自 ai-girls-3d（Manny / ningfangtianwai-pixel，CC BY 4.0），经 glTF-Transform 压缩，见 assets/README.md。
// 模型没有动画，走路、坐下、打字都由代码转动骨骼；眨眼用模型自带的形态键。
// 模型下载完之前先显示代码生成的人偶（character.ts），下载失败也一直用人偶。

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
/** 游戏里的身高（米）。和椅子、桌子、镜头高度配套 */
const HEIGHT = 1.6;
/** 多久眨一次眼（秒） */
const BLINK_PERIOD = 3.7;
const BLINK_SECONDS = 0.16;

/** 角色自身坐标系里的轴：模型面朝 +z，+x 是她的左手边 */
const SIDE_AXIS = new Vector3(1, 0, 0);
const UP_AXIS = new Vector3(0, 1, 0);

/**
 * 按「角色坐标系里的轴」转骨骼。骨骼按模型里的原名查找（如 `thigh.L`）；
 * GLTFLoader 会把名字里的「.」等字符去掉（`thighL`），查找时按同样的规则换算。骨骼自己的局部轴方向因模型而异，
 * 所以先把角色坐标系里的轴换算到骨骼父节点的坐标系，再乘在静止姿势上。
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

  /** 回到静止姿势 */
  reset(): void {
    for (const { bone, rest } of this.bones.values()) bone.quaternion.copy(rest);
  }

  /** 在当前姿势上，绕角色坐标系里的 axis 再转 angle（弧度） */
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
  /** 坐下时模型整体下沉多少 */
  private sitDrop = 0.3;
  /** 眨眼：形态键所在的网格和下标 */
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
      console.error('鲸鱼娘模型加载失败，继续使用代码生成的人偶', error);
      return;
    }
    const model = gltf.scene;

    model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      // 蒙皮网格的包围盒按绑定姿势算，转动骨骼后可能被误裁掉
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const dictionary = mesh.morphTargetDictionary ?? {};
      for (const name of ['Blink_L', 'Blink_R', 'Close']) {
        const index = dictionary[name];
        if (index !== undefined) this.blinkTargets.push({ mesh, index });
      }
    });

    // 缩放到游戏里的身高，脚底放在原点
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

    // 坐下时骨盆要落在椅面上
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
    // 向前迈腿是绕侧轴的负方向
    rig.turn('thigh.L', SIDE_AXIS, -swing);
    rig.turn('thigh.R', SIDE_AXIS, swing);
    // 腿在身后时膝盖弯一点
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
    // 腿部权重扛不住 90° 弯曲，袜子和裙边会被撕开；裙摆一起往前转，正好盖住
    for (const side of ['L', 'R']) {
      rig.turn(`thigh.${side}`, SIDE_AXIS, -Math.PI / 2);
      rig.turn(`shin.${side}`, SIDE_AXIS, Math.PI / 2);
      rig.turn(`skirt.${side}`, SIDE_AXIS, -0.8);
    }
    this.typingPose(0);
    // 尾巴绕到椅子左侧并放低：坐下后的镜头在右肩后面，不能让尾巴挡住屏幕
    rig.turn('tail.01', UP_AXIS, -0.9);
    rig.turn('tail.01', SIDE_AXIS, -0.4);
  }

  type(t: number): void {
    if (!this.rig || !this.sitting) {
      this.fallback.type(t);
      return;
    }
    // 只重算手臂：先把手臂恢复成坐姿里的样子
    this.sit(true);
    this.typingPose(t);
  }

  /** 每帧调用：眨眼 */
  animate(t: number): void {
    const k = (t % BLINK_PERIOD) / BLINK_SECONDS;
    const closed = k < 1 ? Math.sin(k * Math.PI) : 0;
    for (const { mesh, index } of this.blinkTargets) {
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = closed;
    }
  }

  /**
   * 手放到键盘上，小臂跟着时间轻轻动。
   * 这个模型手臂附近的蒙皮权重不干净，大臂转多了（尤其往里收）会把袖子拉成片，所以幅度要小（2026-10-24 实测）。
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
