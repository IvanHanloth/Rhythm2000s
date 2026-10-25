// The dreamcore look: bright pastel grading, a soft whitened edge and slowly drifting motes of light.
// Grading is a post-processing pass after tone mapping (OutputPass), in display colour space where the parameters read naturally.

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
import { STREET_COLORS as C } from '@/theme/street.ts';

/**
 * Grading parameters (provisional, tuned from screenshots). Kept restrained (doc/hub.md): stronger saturation and
 * haze turned the street milky and plastic, the look of a generated picture.
 */
const GRADE = {
  /** Saturation multiplier; 1 is unchanged */
  saturation: 1.12,
  /** How far the shadows lift towards pastel, so nothing is pure black */
  lift: 0.025,
  /** How much the edges whiten */
  haze: 0.06,
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
        // Lift the shadows towards pastel, darker parts more
        color = mix(color, liftColor, lift * (1.0 - luma));
        // Whiten towards the haze colour away from the centre, like seeing in a dream
        float edge = smoothstep(0.35, 0.95, length((vUv - 0.5) * vec2(1.25, 1.0)));
        color = mix(color, hazeColor, edge * haze);
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
      }
    `,
  });
}

/**
 * Stylised gradient sky: saturated blue overhead fading down to a pale pink horizon, with a soft warm glow around the sun.
 * Brightness stays at or below 1 so it never blooms (three's physical sky is far brighter and floods the bloom).
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
        // Below the horizon, the horizon colour (hidden behind buildings anyway)
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

/** Texture for one soft mote: bright centre, fading edges */
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

/** A sparse scatter: a cloud of motes reads as decoration, not air */
const MOTE_COUNT = 70;
/** Half-size of the box around the character the motes fill (m) */
const MOTE_RANGE = 14;

/**
 * Drifting motes: they rise and sway in a box around the character and wrap round when they leave it,
 * so they are always nearby. t is the hub's frame time.
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
        size: 0.11,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.5,
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
      // Drift slowly upwards between 0.3 and 6 m
      const y = 0.3 + ((b * 5.7 + t * (0.08 + d * 0.12)) % 5.7);
      this.positions[i * 3] = center.x + x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = center.z + z;
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
    // A gentle overall shimmer
    (this.points.material as PointsMaterial).opacity = 0.42 + Math.sin(t * 0.7) * 0.08;
  }
}
