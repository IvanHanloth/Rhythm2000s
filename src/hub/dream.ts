// 梦核感（2026-10-24 用户要求「来点原神的明亮和梦核感」）：明亮的粉彩调色、边缘泛白的柔光、空中慢慢漂浮的光点。
// 调色是一个后处理 pass，放在色调映射（OutputPass）之后，在显示色彩空间里调，参数比较直观。

import {
  AdditiveBlending,
  BackSide,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  type Vector3,
} from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { STREET_COLORS as C } from '../theme/street.ts';

/** 调色参数（暂定，按截图调出来的） */
const GRADE = {
  /** 饱和度倍数：1 是原样 */
  saturation: 1.28,
  /** 暗部抬亮的程度：把黑色往粉彩色拉，画面不会有死黑 */
  lift: 0.03,
  /** 画面边缘泛白的程度 */
  haze: 0.16,
};

export function createDreamGradePass(): ShaderPass {
  return new ShaderPass({
    name: 'DreamGrade',
    uniforms: {
      tDiffuse: { value: null },
      saturation: { value: GRADE.saturation },
      lift: { value: GRADE.lift },
      liftColor: { value: new Color(C.dreamLift) },
      haze: { value: GRADE.haze },
      hazeColor: { value: new Color(C.dreamHaze) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float saturation;
      uniform float lift;
      uniform vec3 liftColor;
      uniform float haze;
      uniform vec3 hazeColor;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        vec3 color = texel.rgb;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, saturation);
        // 暗部往粉彩色抬：越暗抬得越多
        color = mix(color, liftColor, lift * (1.0 - luma));
        // 边缘泛白：离中心越远越往雾色上靠，像梦里看东西
        float edge = smoothstep(0.35, 0.95, length((vUv - 0.5) * vec2(1.25, 1.0)));
        color = mix(color, hazeColor, edge * haze);
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
      }
    `,
  });
}

/**
 * 风格化的渐变天空：顶上饱和的蓝、往下变浅、地平线淡粉白，太阳方向一圈柔和的暖光。
 * 亮度不超过 1，不会触发辉光（three 自带的物理天空亮度远大于 1，会让辉光糊满画面，2026-10-24 实测）。
 */
export function createDreamSky(sunDirection: Vector3, radius: number): Mesh {
  const material = new ShaderMaterial({
    name: 'DreamSky',
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new Color(C.skyTop) },
      mid: { value: new Color(C.skyMid) },
      horizon: { value: new Color(C.skyHorizon) },
      sunGlow: { value: new Color(C.skySunGlow) },
      sunDirection: { value: sunDirection.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 mid;
      uniform vec3 horizon;
      uniform vec3 sunGlow;
      uniform vec3 sunDirection;
      varying vec3 vDirection;
      void main() {
        float h = clamp(vDirection.y, -1.0, 1.0);
        vec3 color = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        color = mix(color, top, smoothstep(0.25, 0.9, h));
        // 地平线以下用地平线的颜色，被楼挡住看不到
        color = h < 0.0 ? horizon : color;
        float sun = max(dot(normalize(vDirection), sunDirection), 0.0);
        color = mix(color, sunGlow, pow(sun, 24.0) * 0.8 + pow(sun, 4.0) * 0.15);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new Mesh(new SphereGeometry(radius, 32, 16), material);
  sky.frustumCulled = false;
  return sky;
}

/** 一颗柔光点的贴图：中间亮、边缘渐隐 */
function moteTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, C.signText);
  gradient.addColorStop(0.35, `${C.dreamMote}cc`);
  gradient.addColorStop(1, `${C.dreamMote}00`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const MOTE_COUNT = 260;
/** 光点分布在角色周围这么大的范围里（米，半宽） */
const MOTE_RANGE = 14;

/**
 * 漂浮的光点：在角色周围的一个盒子里慢慢往上漂、左右晃，漂出盒子就从另一头回来，
 * 所以走到哪里身边都有。t 用大厅的帧时间。
 */
export class DreamMotes {
  readonly points: Points;
  private readonly seeds: Float32Array;
  private readonly positions: Float32Array;

  constructor() {
    this.seeds = new Float32Array(MOTE_COUNT * 4);
    for (let i = 0; i < this.seeds.length; i++) this.seeds[i] = Math.random();
    this.positions = new Float32Array(MOTE_COUNT * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.points = new Points(
      geometry,
      new PointsMaterial({
        map: moteTexture(),
        size: 0.18,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  update(t: number, center: Vector3): void {
    const span = MOTE_RANGE * 2;
    const wrap = (v: number) => (((v % span) + span) % span) - MOTE_RANGE;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const [a, b, c, d] = [
        this.seeds[i * 4]!,
        this.seeds[i * 4 + 1]!,
        this.seeds[i * 4 + 2]!,
        this.seeds[i * 4 + 3]!,
      ];
      const x = wrap(a * span + Math.sin(t * 0.3 + d * 6) * 0.8 - center.x);
      const z = wrap(c * span + Math.cos(t * 0.25 + a * 6) * 0.8 - center.z);
      // 高度 0.3～6 米之间慢慢往上漂
      const y = 0.3 + ((b * 5.7 + t * (0.08 + d * 0.12)) % 5.7);
      this.positions[i * 3] = center.x + x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = center.z + z;
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
    // 整体轻轻一明一暗
    (this.points.material as PointsMaterial).opacity = 0.65 + Math.sin(t * 1.3) * 0.2;
  }
}
