// three.js 로 만든 "제주 3D 입체 지도".
// 한라산·오름·해안·풍력발전기·등대·돌하르방과, 관광지·올레길·항포구·감귤 재배지를 한 장면에 그립니다.
// 지형은 실제 지형을 단순화한 "모형"이고, 1 단위 = 1km (세로는 VS 배 과장) 입니다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ───────────────────────── 좌표 / 상수 ───────────────────────── */
const LON0 = 126.55, LAT0 = 33.38, KX = 92.8, KZ = 111.0; // 경위도 → km
export const lonLatToXZ = (lon, lat) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];

const W = 96, D = 64, NX = 320, NZ = 214; // 지형 크기(km)와 격자 수
const CW = W / NX, CD = D / NZ;
const VS = 5; // 세로 과장 배율
const TH = (9 * Math.PI) / 180, CT = Math.cos(TH), ST = Math.sin(TH); // 섬의 긴 축이 동쪽으로 살짝 올라가 있어요
const AX = 37, BZ = 15.2; // 섬 타원 반지름(km): 동서 / 남북
const toUV = (x, z) => [x * CT - z * ST, x * ST + z * CT];
const SUMMIT = lonLatToXZ(126.5333, 33.3617);
const [SU, SV] = toUV(SUMMIT[0], SUMMIT[1]);

/* ───────────────────────── 작은 도구들 ───────────────────────── */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), u), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), u), v);
}
function fbm(x, y) {
  return (vnoise(x, y) * 0.5 + vnoise(x * 2.03, y * 2.03) * 0.25 + vnoise(x * 4.1, y * 4.1) * 0.125 + vnoise(x * 8.3, y * 8.3) * 0.0625) / 0.9375;
}
const C = (hex) => new THREE.Color(hex);

/* ───────────────────────── 지형 높이(km) ───────────────────────── */
function makeFeatures() {
  const adds = [], maxs = [];
  const add = (lon, lat, R, H, o = {}) => { const [x, z] = lonLatToXZ(lon, lat); adds.push({ x, z, R, H, pw: 1.3, crater: 0, craterR: 0.35, ...o }); };
  const max = (lon, lat, R, H, o = {}) => { const [x, z] = lonLatToXZ(lon, lat); maxs.push({ x, z, R, H, pw: 0.8, crater: 0, craterR: 0.35, ...o }); };

  // 이름 있는 오름 (원래 지형 위에 얹는 봉우리)
  add(126.3606, 33.3663, 1.1, 0.13, { crater: 0.04 }); // 새별오름
  add(126.3006, 33.3507, 1.0, 0.11, { crater: 0.05 }); // 금오름
  add(126.8133, 33.4619, 1.0, 0.12, { crater: 0.04 }); // 용눈이오름
  add(126.8031, 33.4727, 1.1, 0.16, { crater: 0.07 }); // 다랑쉬오름
  add(126.6717, 33.4378, 1.2, 0.14, { crater: 0.06 }); // 거문오름
  add(126.6842, 33.4306, 1.0, 0.05, { crater: 0.07, craterR: 0.5 }); // 산굼부리
  add(126.469, 33.5128, 0.8, 0.07); // 도두봉

  // 바다 위로 솟은 곳 (섬·절벽): 절대 높이
  max(126.9425, 33.458, 1.25, 0.18, { pw: 0.7, crater: 0.06, craterR: 0.4 }); // 성산일출봉
  max(126.953, 33.5, 1.7, 0.13, { pw: 0.8 }); // 우도
  max(126.228, 33.4208, 0.75, 0.114, { pw: 0.9 }); // 비양도
  max(126.27, 33.17, 0.9, 0.05, { pw: 0.6 }); // 가파도
  max(126.27, 33.115, 0.8, 0.045, { pw: 0.6 }); // 마라도
  max(126.1627, 33.3125, 0.85, 0.08, { pw: 0.8 }); // 차귀도
  max(126.3145, 33.2395, 1.15, 0.395, { pw: 0.6 }); // 산방산
  max(126.29, 33.205, 1.1, 0.105, { pw: 0.9, crater: 0.03 }); // 송악산
  max(126.5233, 33.2189, 0.5, 0.09); // 범섬
  max(126.564, 33.226, 0.4, 0.06); // 문섬

  // 흩어진 작은 오름 (제주에는 오름이 368개 있어요)
  const rng = mulberry32(20240607);
  for (let k = 0; k < 85; k++) {
    let x = 0, z = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = (rng() * 2 - 1) * 34; z = (rng() * 2 - 1) * 13.5;
      const [u, v] = toUV(x, z);
      if (Math.hypot(u / AX, v / BZ) < 0.86 && Math.hypot(x - SUMMIT[0], z - SUMMIT[1]) > 3.8) break;
    }
    const H = 0.05 + rng() * 0.17;
    adds.push({ x, z, R: 0.6 + rng() * 0.9, H, pw: 1.3, crater: rng() < 0.7 ? H * 0.35 : 0, craterR: 0.35 });
  }
  return { adds, maxs };
}

function makeHeightFn() {
  const { adds, maxs } = makeFeatures();
  const body = (f, x, z) => {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d >= f.R) return null;
    return { d, v: f.H * Math.pow(1 - d / f.R, f.pw) };
  };
  return (x, z) => {
    const [u, v] = toUV(x, z);
    let r = Math.hypot(u / AX, v / BZ);
    r *= 1 + 0.1 * (fbm(x * 0.09 + 10, z * 0.09 + 3) - 0.5) + 0.035 * (fbm(x * 0.35, z * 0.35) - 0.5); // 구불구불한 해안선
    let h = r < 1 ? 0.6 * Math.pow(1 - r, 1.1) : -0.38 * (1 - Math.exp(-(r - 1) * 9));
    const land = smooth(1.0, 0.82, r); // 육지 안쪽에서만 산·오름을 더해요
    // 한라산 (동서로 길쭉한 순상화산) + 백록담
    const d = Math.hypot((u - SU) / 1.4, v - SV);
    h += land * (1.2 * Math.exp(-Math.pow(d / 7.2, 1.6)) + 0.22 * Math.exp(-Math.pow(d / 13, 2)));
    h -= 0.12 * Math.exp(-Math.pow(d / 0.55, 2));
    for (const f of adds) {
      if (Math.abs(x - f.x) >= f.R || Math.abs(z - f.z) >= f.R) continue;
      const b = body(f, x, z);
      if (!b) continue;
      h += land * (b.v - (f.crater ? f.crater * Math.exp(-Math.pow(b.d / (f.R * f.craterR), 2)) : 0));
    }
    for (const f of maxs) {
      if (Math.abs(x - f.x) >= f.R || Math.abs(z - f.z) >= f.R) continue;
      const b = body(f, x, z);
      if (!b) continue;
      h = Math.max(h, b.v) - (f.crater ? f.crater * Math.exp(-Math.pow(b.d / (f.R * f.craterR), 2)) : 0);
    }
    return h;
  };
}

/* ───────────────────────── 지형 색 ───────────────────────── */
const PAL = {
  sand: C(0xe3d3a0), basalt: C(0x4a4642),
  seaShallow: C(0xd2c496), seaDeep: C(0x16455f), seaAbyss: C(0x0a2740),
  fields: [C(0xa9c85a), C(0xc9cf5b), C(0x86b85a), C(0xd8bd5c), C(0x73ae52), C(0xb7d062)],
  forestA: C(0x3c7a3a), forestB: C(0x2b6a37),
  alpineA: C(0x7c9a4c), alpineB: C(0x9a9a5e),
  rock: C(0x8e867b), rockHi: C(0xc4bdb2), rockSlope: C(0x7d756b),
  citrus: C(0x8fb53a),
};
const tmpC = new THREE.Color();
function terrainColor(x, z, h, slope, zones, out) {
  if (h < 0) {
    out.copy(PAL.seaShallow).lerp(PAL.seaDeep, smooth(0, 0.14, -h));
    if (-h > 0.22) out.lerp(PAL.seaAbyss, clamp((-h - 0.22) / 0.15));
    return;
  }
  const nf = vnoise(x * 0.7, z * 0.7);
  out.copy(PAL.fields[Math.floor(hash2(Math.floor(x / 0.9), Math.floor(z / 0.65)) * PAL.fields.length)]);
  // 숲 / 초원 / 바위로 높이에 따라 바뀌어요
  out.lerp(tmpC.copy(PAL.forestA).lerp(PAL.forestB, nf), smooth(0.28, 0.42, h) * (0.75 + 0.25 * nf));
  out.lerp(tmpC.copy(PAL.alpineA).lerp(PAL.alpineB, nf), smooth(1.0, 1.2, h));
  out.lerp(tmpC.copy(PAL.rock).lerp(PAL.rockHi, smooth(1.75, 1.95, h)), smooth(1.55, 1.8, h));
  out.lerp(PAL.rockSlope, smooth(0.34, 0.6, slope) * 0.85);
  // 감귤 재배지
  let m = 0;
  for (const zn of zones) m = Math.max(m, smooth(zn.R, zn.R * 0.55, Math.hypot(x - zn.x, z - zn.z)));
  if (m > 0 && h < 0.6) out.lerp(PAL.citrus, m * 0.6);
  // 해안: 모래 + 검은 현무암
  const wc = 1 - smooth(0.006, 0.035, h);
  if (wc > 0) out.lerp(tmpC.copy(PAL.sand).lerp(PAL.basalt, vnoise(x * 1.9, z * 1.9) > 0.55 ? 0.8 : 0.05), wc);
}

/* ───────────────────────── 바다 / 하늘 셰이더 ───────────────────────── */
const SEA_VERT = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SEA_FRAG = `
uniform float uTime; uniform float uNight; uniform sampler2D uH; uniform vec2 uSize;
uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFog; uniform vec3 uSun; uniform vec3 uSunCol;
varying vec3 vW;
float depthAt(vec2 p){
  vec2 uv = vec2(p.x / uSize.x + 0.5, p.y / uSize.y + 0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.5;
  float h = texture2D(uH, uv).r * 3.0 - 0.6;
  return max(-h, 0.0);
}
void main(){
  vec2 p = vW.xz; float t = uTime;
  float d = depthAt(p);
  float dist = length(vW - cameraPosition);
  float k = 1.0 - smoothstep(20.0, 90.0, dist); // 멀리서는 잔물결을 줄여서 격자무늬(모아레)를 없애요
  float dx = cos(p.x*0.9 + t*0.6)*0.05 + (cos(p.x*2.1 + t*0.9)*0.10 + cos(p.x*7.0 + t*1.6)*sin(p.y*6.0 - t*1.3)*0.05) * k + cos((p.x+p.y)*0.5 + t*0.4)*0.04;
  float dz = cos(p.y*1.1 - t*0.5)*0.05 + (cos(p.y*2.7 - t*0.7)*0.08 + sin(p.x*6.0 + t*1.6)*cos(p.y*6.0 - t*1.3)*0.05) * k + cos((p.x+p.y)*0.5 + t*0.4)*0.04;
  vec3 n = normalize(vec3(-dx, 1.0, -dz));
  vec3 V = normalize(cameraPosition - vW);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 0.32, d));
  col += (sin(p.x*0.8 + t*0.5) + sin(p.y*0.7 - t*0.4)) * 0.012;
  float foam = smoothstep(0.04, 0.0, d) * (0.55 + 0.45*sin(t*1.8 + d*140.0 + p.x*0.5));
  col = mix(col, vec3(1.0), foam * 0.85 * (1.0 - uNight*0.6));
  vec3 Hh = normalize(normalize(uSun) + V);
  float spec = pow(max(dot(n, Hh), 0.0), 120.0);
  col += uSunCol * spec * 1.2;
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col = mix(col, uFog, fres * 0.4);
  float alpha = mix(0.2, 0.97, smoothstep(0.0, 0.1, d));
  alpha = max(alpha, foam * 0.9);
  float fg = smoothstep(140.0, 520.0, dist);
  col = mix(col, uFog, fg); alpha = mix(alpha, 1.0, fg);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const SKY_VERT = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FRAG = `
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uNight; varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir); float e = max(d.y, 0.0);
  vec3 col = mix(uHor, uTop, pow(e, 0.5));
  float s = max(dot(d, normalize(uSun)), 0.0);
  col += uSunCol * (pow(s, 500.0) * 2.5 + pow(s, 10.0) * 0.18);
  float st = step(0.9978, fract(sin(dot(floor(d * 260.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453));
  col += vec3(st) * uNight * step(0.05, d.y);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/* 낮 / 밤 분위기 */
const LOOK = {
  day: { top: C(0x3f8fe0), hor: C(0xbfe3f5), sun: new THREE.Vector3(-0.6, 0.5, 0.6), sunCol: C(0xfff1c8), hemiSky: C(0xdff1ff), hemiGround: C(0x8a7a5a), hemiI: 1.7, dirI: 2.6, dirCol: C(0xfff0d6), seaShallow: C(0x3fd0c9), seaDeep: C(0x0b5d8c) },
  night: { top: C(0x050b1f), hor: C(0x1b2a4a), sun: new THREE.Vector3(0.5, 0.45, -0.6), sunCol: C(0xcfe0ff), hemiSky: C(0x34508a), hemiGround: C(0x10131f), hemiI: 0.75, dirI: 0.55, dirCol: C(0x9db8ff), seaShallow: C(0x0e4a5e), seaDeep: C(0x04132a) },
};

/* ───────────────────────── 메인 ───────────────────────── */
export function createJejuMap(container, { places, categories, onSelect, onAutoRotateChange }) {
  const catColor = Object.fromEntries(categories.map((c) => [c.id, c.color]));
  const catEmoji = Object.fromEntries(categories.map((c) => [c.id, c.emoji]));

  /* 렌더러 / 장면 / 카메라 */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbfe3f5, 140, 480);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 3000);
  const HOME = { pos: new THREE.Vector3(-8, 46, 62), target: new THREE.Vector3(0, 0.5, 1) };
  camera.position.copy(HOME.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.5;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.screenSpacePanning = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.addEventListener('start', () => {
    flight = null; controls.enabled = true;
    if (controls.autoRotate) { controls.autoRotate = false; onAutoRotateChange && onAutoRotateChange(false); }
  });

  /* 조명 */
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.5);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  scene.add(hemi, sun, sun.target);

  /* 하늘 */
  const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  /* ── 지형 ── */
  const places2 = places.map((p) => {
    const [x, z] = p.lon != null ? lonLatToXZ(p.lon, p.lat) : lonLatToXZ(p.line[0][0], p.line[0][1]);
    return { ...p, x, z };
  });
  const zones = places2.filter((p) => p.cat === 'citrus' && p.radius).map((p) => ({ x: p.x, z: p.z, R: p.radius }));

  const raw = makeHeightFn();
  const NXv = NX + 1, NZv = NZ + 1;
  const Hs = new Float32Array(NXv * NZv);
  for (let j = 0; j < NZv; j++) for (let i = 0; i < NXv; i++) Hs[j * NXv + i] = raw(-W / 2 + i * CW, -D / 2 + j * CD);

  const heightAt = (x, z) => { // km
    const fx = (x + W / 2) / CW, fz = (z + D / 2) / CD;
    if (fx < 0 || fz < 0 || fx > NX || fz > NZ) return -0.4;
    const i = Math.min(Math.floor(fx), NX - 1), j = Math.min(Math.floor(fz), NZ - 1);
    const tx = fx - i, tz = fz - j, k = j * NXv + i;
    return lerp(lerp(Hs[k], Hs[k + 1], tx), lerp(Hs[k + NXv], Hs[k + NXv + 1], tx), tz);
  };
  const slopeAt = (x, z) => Math.hypot(heightAt(x + 0.3, z) - heightAt(x - 0.3, z), heightAt(x, z + 0.3) - heightAt(x, z - 0.3)) / 0.6;
  const yAt = (x, z) => heightAt(x, z) * VS;

  const terrainGeo = new THREE.PlaneGeometry(W, D, NX, NZ);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colArr = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let j = 0; j < NZv; j++) {
    for (let i = 0; i < NXv; i++) {
      const idx = j * NXv + i, h = Hs[idx];
      const x = pos.getX(idx), z = pos.getZ(idx);
      pos.setY(idx, h * VS);
      const ip = Math.min(i + 1, NX), im = Math.max(i - 1, 0), jp = Math.min(j + 1, NZ), jm = Math.max(j - 1, 0);
      const sx = (Hs[j * NXv + ip] - Hs[j * NXv + im]) / ((ip - im) * CW);
      const sz = (Hs[jp * NXv + i] - Hs[jm * NXv + i]) / ((jp - jm) * CD);
      terrainColor(x, z, h, Math.hypot(sx, sz), zones, col);
      colArr[idx * 3] = col.r; colArr[idx * 3 + 1] = col.g; colArr[idx * 3 + 2] = col.b;
    }
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  scene.add(terrain);

  /* ── 바다 ── */
  const heightTexData = new Uint8Array(NXv * NZv);
  for (let k = 0; k < Hs.length; k++) heightTexData[k] = Math.round(clamp((Hs[k] + 0.6) / 3.0) * 255);
  const heightTex = new THREE.DataTexture(heightTexData, NXv, NZv, THREE.RedFormat, THREE.UnsignedByteType);
  heightTex.unpackAlignment = 1; // 한 줄이 321바이트라서 4바이트 정렬을 끄지 않으면 비뚤어져요
  heightTex.magFilter = THREE.LinearFilter; heightTex.minFilter = THREE.LinearFilter;
  heightTex.wrapS = heightTex.wrapT = THREE.ClampToEdgeWrapping;
  heightTex.needsUpdate = true;
  const seaU = { uTime: { value: 0 }, uNight: { value: 0 }, uH: { value: heightTex }, uSize: { value: new THREE.Vector2(W, D) }, uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() } };
  const seaGeo = new THREE.PlaneGeometry(1800, 1800, 1, 1); seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({ uniforms: seaU, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, transparent: true, depthWrite: false }));
  sea.renderOrder = 1;
  scene.add(sea);

  /* ── 위치 찾기 도우미 ── */
  function findLand(x, z, minH = 0.012, maxR = 7) {
    if (heightAt(x, z) >= minH) return [x, z];
    for (let r = 0.3; r <= maxR; r += 0.3) {
      const n = Math.max(8, Math.round(r * 10));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (heightAt(px, pz) >= minH) return [px, pz];
      }
    }
    let px = x, pz = z;
    for (let k = 0; k < 400 && heightAt(px, pz) < minH; k++) { px *= 0.99; pz *= 0.99; }
    return [px, pz];
  }
  function toShore(x, z) { // 가장 가까운 해안선 + 바다 쪽 방향
    let [px, pz] = findLand(x, z, 0.01, 9);
    const e = 0.25;
    let gx = heightAt(px + e, pz) - heightAt(px - e, pz), gz = heightAt(px, pz + e) - heightAt(px, pz - e);
    const m = Math.hypot(gx, gz) || 1, rm = Math.hypot(px, pz) || 1;
    let nx = -gx / m * 0.5 + (px / rm) * 0.5, nz = -gz / m * 0.5 + (pz / rm) * 0.5;
    const nm = Math.hypot(nx, nz) || 1; nx /= nm; nz /= nm;
    for (let k = 0; k < 240 && heightAt(px, pz) > 0.002; k++) { px += nx * 0.05; pz += nz * 0.05; }
    return { x: px, z: pz, nx, nz };
  }
  function toSea(x, z) {
    const rm = Math.hypot(x, z) || 1, nx = x / rm, nz = z / rm;
    for (let k = 0; k < 300 && heightAt(x, z) > -0.03; k++) { x += nx * 0.1; z += nz * 0.1; }
    return [x, z];
  }

  /* ── 장식: 숲 / 구름 / 백록담 ── */
  const rng = mulberry32(777);
  const disposables = [];
  const layers = {}; // 카테고리별로 켜고 끌 3D 물체
  const addLayer = (cat, obj) => { (layers[cat] = layers[cat] || []).push(obj); scene.add(obj); };
  const anims = [];
  const track = (...r) => { disposables.push(...r); return r[0]; };

  {
    const FN = 4800;
    const g = track(new THREE.ConeGeometry(0.06, 0.24, 5)); g.translate(0, 0.12, 0);
    const forest = new THREE.InstancedMesh(g, track(new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true })), FN);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), cc = new THREE.Color();
    let n = 0;
    for (let tries = 0; n < FN && tries < 80000; tries++) {
      const x = (rng() * 2 - 1) * 40, z = (rng() * 2 - 1) * 17, h = heightAt(x, z);
      if (h < 0.3 || h > 1.5 || slopeAt(x, z) > 0.55) continue;
      if (fbm(x * 0.35 + 50, z * 0.35) < 0.42) continue;
      if (rng() > smooth(1.5, 1.0, h)) continue;
      const s = 0.7 + rng() * 0.9;
      m4.compose(ps.set(x, h * VS - 0.02, z), q.identity(), sc.set(s, s * (0.9 + rng() * 0.6), s));
      forest.setMatrixAt(n, m4);
      cc.setHSL(0.3 + rng() * 0.05, 0.45 + rng() * 0.2, 0.2 + rng() * 0.1); forest.setColorAt(n, cc);
      n++;
    }
    forest.count = n; forest.instanceMatrix.needsUpdate = true; forest.instanceColor.needsUpdate = true;
    scene.add(forest);
  }

  // 백록담 (화구호)
  {
    let hmin = 9, lx = SUMMIT[0], lz = SUMMIT[1];
    for (let a = -1; a <= 1; a += 0.1) for (let b = -1; b <= 1; b += 0.1) { const h = heightAt(SUMMIT[0] + a * 0.5, SUMMIT[1] + b * 0.5); if (h < hmin) { hmin = h; lx = SUMMIT[0] + a * 0.5; lz = SUMMIT[1] + b * 0.5; } }
    const lake = new THREE.Mesh(track(new THREE.CircleGeometry(0.2, 20)), track(new THREE.MeshStandardMaterial({ color: 0x2f86d6, roughness: 0.2, metalness: 0.1 })));
    lake.rotation.x = -Math.PI / 2; lake.position.set(lx, hmin * VS + 0.05, lz);
    scene.add(lake);
  }

  // 구름: 한라산 허리를 돌고, 먼 하늘에도 몇 개
  {
    const puffG = track(new THREE.SphereGeometry(1, 10, 8));
    const puffM = track(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 }));
    const clouds = new THREE.Group();
    const mk = (cx, cy, cz, spread, count) => {
      const grp = new THREE.Group(); grp.position.set(cx, cy, cz);
      for (let k = 0; k < count; k++) {
        const p = new THREE.Mesh(puffG, puffM), r = 0.6 + rng() * 0.9;
        p.scale.set(r * 1.7, r * 0.6, r * 1.1);
        p.position.set((rng() - 0.5) * spread, (rng() - 0.5) * 0.5, (rng() - 0.5) * spread * 0.6);
        p.renderOrder = 2; grp.add(p);
      }
      clouds.add(grp); return grp;
    };
    const ring = new THREE.Group(); ring.position.set(SUMMIT[0], 0, SUMMIT[1]);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.5, g = mk(Math.cos(a) * 6.2, 5.2 + (k % 2) * 0.7, Math.sin(a) * 4.4, 2.2, 3); g.scale.setScalar(0.75); ring.add(g); }
    scene.add(ring);
    anims.push((t) => { ring.rotation.y = t * 0.02; });
    const far = [[-34, 15, -20], [30, 17, 10], [-10, 19, 30], [42, 14, -26], [-44, 16, 18]].map(([x, y, z]) => mk(x, y, z, 7, 7));
    far.forEach((g) => scene.add(g));
    anims.push((t) => far.forEach((g, i) => { g.position.x += 0.004 * (i % 2 ? 1 : -1); }));
  }

  /* ── 감귤 재배지 (나무 + 귤) ── */
  {
    const trees = [];
    for (const zn of zones) {
      for (let k = 0, got = 0; got < 260 && k < 4000; k++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * zn.R * 0.95;
        const x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r, h = heightAt(x, z);
        if (h < 0.025 || h > 0.5 || slopeAt(x, z) > 0.2) continue;
        trees.push([x, z, h]); got++;
      }
    }
    const canopyG = track(new THREE.IcosahedronGeometry(0.075, 0));
    const fruitG = track(new THREE.IcosahedronGeometry(0.026, 0));
    const canopy = new THREE.InstancedMesh(canopyG, track(new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.9, flatShading: true })), Math.max(1, trees.length));
    const fruit = new THREE.InstancedMesh(fruitG, track(new THREE.MeshStandardMaterial({ color: 0xff8a10, roughness: 0.5, emissive: 0x552200, emissiveIntensity: 0.25 })), Math.max(1, trees.length * 3));
    const m4 = new THREE.Matrix4();
    trees.forEach(([x, z, h], i) => {
      m4.makeTranslation(x, h * VS + 0.07, z); canopy.setMatrixAt(i, m4);
      for (let f = 0; f < 3; f++) { const a = rng() * Math.PI * 2; m4.makeTranslation(x + Math.cos(a) * 0.06, h * VS + 0.1 + rng() * 0.05, z + Math.sin(a) * 0.06); fruit.setMatrixAt(i * 3 + f, m4); }
    });
    canopy.count = trees.length; fruit.count = trees.length * 3;
    const grp = new THREE.Group(); grp.add(canopy, fruit);
    addLayer('citrus', grp);
  }

  /* ── 풍력발전기 ── */
  const windInfo = {};
  {
    const towerG = track(new THREE.CylinderGeometry(0.009, 0.016, 0.5, 8)); towerG.translate(0, 0.25, 0);
    const nacG = track(new THREE.BoxGeometry(0.05, 0.03, 0.03)); nacG.translate(0, 0.51, 0);
    const hubG = track(new THREE.SphereGeometry(0.018, 8, 6)); hubG.translate(0, 0, 0.02);
    const bladeG = track(new THREE.BoxGeometry(0.016, 0.3, 0.004)); bladeG.translate(0, 0.15, 0.02);
    const white = track(new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.6 }));
    const lightM = track(new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    const lightG = track(new THREE.SphereGeometry(0.014, 6, 4)); lightG.translate(0, 0.545, 0);
    const lights = [];
    const makeTurbine = () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(towerG, white), new THREE.Mesh(nacG, white));
      const rotor = new THREE.Group(); rotor.position.set(0.04, 0.51, 0);
      rotor.rotation.y = Math.PI / 2; // 날개 면이 바람 쪽(+x)을 보도록
      rotor.add(new THREE.Mesh(hubG, white));
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(bladeG, white); b.rotation.z = (k / 3) * Math.PI * 2; rotor.add(b); }
      g.add(rotor);
      const l = new THREE.Mesh(lightG, lightM); g.add(l); lights.push(l);
      return { g, rotor };
    };
    for (const p of places2.filter((q) => q.cat === 'wind' && q.line)) {
      const grp = new THREE.Group(); const pts = [];
      const [ax, az] = lonLatToXZ(...p.line[0]), [bx, bz] = lonLatToXZ(...p.line[1]);
      for (let k = 0; k < p.n; k++) {
        const t = (k + 0.5) / p.n;
        let x = lerp(ax, bx, t), z = lerp(az, bz, t);
        if (p.offshore) [x, z] = toSea(x, z); else [x, z] = findLand(x, z, 0.02, 4);
        const { g, rotor } = makeTurbine();
        const y = p.offshore ? 0.02 : yAt(x, z);
        g.position.set(x, y, z);
        g.rotation.y = -Math.PI / 4 + (rng() - 0.5) * 0.4; // 북서풍을 마주보게
        const spd = 1.1 + rng() * 0.8, ph = rng() * 6;
        anims.push((t) => { rotor.rotation.z = ph + t * spd; });
        grp.add(g); pts.push([x, z]);
      }
      windInfo[p.id] = pts;
      addLayer('wind', grp);
    }
    anims.push((t) => { const on = night > 0.4 && Math.sin(t * 3) > 0 ? 1 : 0.25 + 0.75 * (1 - night); lightM.color.setRGB(on, on * 0.15, on * 0.15); });
  }

  /* ── 등대 ── */
  const beamMats = [], lanternMats = [];
  {
    const whiteM = track(new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.7 }));
    const redM = track(new THREE.MeshStandardMaterial({ color: 0xd9433a, roughness: 0.7 }));
    const lanternM = track(new THREE.MeshBasicMaterial({ color: 0xcfd8dc })); lanternMats.push(lanternM);
    const bodyG = track(new THREE.CylinderGeometry(0.06, 0.09, 0.22, 10));
    const bodyG2 = track(new THREE.CylinderGeometry(0.052, 0.06, 0.22, 10));
    const bodyG3 = track(new THREE.CylinderGeometry(0.046, 0.052, 0.16, 10));
    const galG = track(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 12));
    const lanG = track(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 10));
    const roofG = track(new THREE.ConeGeometry(0.058, 0.1, 10));
    const beamG = track(new THREE.ConeGeometry(0.2, 3.2, 14, 1, true)); beamG.translate(0, -1.6, 0); beamG.rotateZ(Math.PI / 2);
    const makeLight = () => {
      const g = new THREE.Group();
      const put = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); };
      put(bodyG, whiteM, 0.11); put(bodyG2, redM, 0.33); put(bodyG3, whiteM, 0.52);
      put(galG, redM, 0.62); put(lanG, lanternM, 0.68); put(roofG, redM, 0.78);
      const beams = new THREE.Group(); beams.position.y = 0.68;
      for (let k = 0; k < 2; k++) {
        const bm = track(new THREE.MeshBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beamMats.push(bm);
        const b = new THREE.Mesh(beamG, bm); b.rotation.y = k * Math.PI; b.renderOrder = 3; beams.add(b);
      }
      g.add(beams);
      const sp = 0.7 + rng() * 0.3; anims.push((t) => { beams.rotation.y = t * sp; });
      g.scale.setScalar(1.25);
      return g;
    };
    for (const p of places2.filter((q) => q.cat === 'light')) {
      const g = makeLight();
      if (p.islet) { const [x, z] = findLand(p.x, p.z, 0.02, 3); g.position.set(x, yAt(x, z), z); p.px = x; p.pz = z; }
      else { const s = toShore(p.x, p.z); const x = s.x - s.nx * 0.12, z = s.z - s.nz * 0.12; g.position.set(x, Math.max(yAt(x, z), 0.05), z); p.px = x; p.pz = z; }
      addLayer('light', g);
    }
  }

  /* ── 돌하르방 ── */
  {
    const stone = track(new THREE.MeshStandardMaterial({ color: 0x6d6760, roughness: 1, flatShading: true }));
    const dark = track(new THREE.MeshStandardMaterial({ color: 0x24211f, roughness: 1 }));
    const bodyG = track(new THREE.CylinderGeometry(0.07, 0.1, 0.26, 9));
    const headG = track(new THREE.SphereGeometry(0.095, 12, 9));
    const hatG = track(new THREE.CylinderGeometry(0.07, 0.092, 0.085, 10));
    const topG = track(new THREE.SphereGeometry(0.072, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2));
    const noseG = track(new THREE.SphereGeometry(0.024, 8, 6));
    const eyeG = track(new THREE.SphereGeometry(0.017, 6, 5));
    const handG = track(new THREE.SphereGeometry(0.03, 7, 5));
    const make = () => {
      const g = new THREE.Group();
      const put = (geo, mat, x, y, z, sy = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.y = sy; g.add(m); return m; };
      put(bodyG, stone, 0, 0.13, 0); put(headG, stone, 0, 0.33, 0, 1.05);
      put(hatG, stone, 0, 0.44, 0); put(topG, stone, 0, 0.485, 0);
      put(noseG, stone, 0, 0.32, 0.09, 1.2);
      put(eyeG, dark, -0.04, 0.36, 0.08); put(eyeG, dark, 0.04, 0.36, 0.08);
      put(handG, stone, -0.03, 0.17, 0.085); put(handG, stone, 0.035, 0.21, 0.085);
      g.scale.setScalar(1.45);
      return g;
    };
    for (const p of places2.filter((q) => q.cat === 'dol')) {
      const [cx, cz] = findLand(p.x, p.z, 0.02, 3);
      const grp = new THREE.Group();
      for (let k = 0; k < p.statues; k++) {
        const g = make();
        const off = (k - (p.statues - 1) / 2) * 0.32;
        const x = cx + off, z = cz + (rng() - 0.5) * 0.12;
        g.position.set(x, Math.max(yAt(x, z), 0.02), z);
        g.rotation.y = (rng() - 0.5) * 0.5; // 남쪽(앞)을 바라봐요
        grp.add(g);
      }
      p.px = cx; p.pz = cz;
      addLayer('dol', grp);
    }
  }

  /* ── 항구 + 배 ── */
  {
    const quayM = track(new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.9 }));
    const redLM = track(new THREE.MeshStandardMaterial({ color: 0xd9433a, emissive: 0x551010, roughness: 0.6 }));
    const greenLM = track(new THREE.MeshStandardMaterial({ color: 0x2f9e5b, emissive: 0x0a3a1c, roughness: 0.6 }));
    const hullM = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
    const cabinMs = [0x1c6fe0, 0xe8527a, 0xff8a10, 0x2f9e5b].map((c) => track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })));
    const quayG = track(new THREE.BoxGeometry(1.0, 0.08, 0.22));
    const armG = track(new THREE.BoxGeometry(0.14, 0.12, 1.0));
    const arm2G = track(new THREE.BoxGeometry(0.14, 0.12, 0.7));
    const capG = track(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 8));
    const hullG = track(new THREE.BoxGeometry(0.07, 0.04, 0.22));
    const cabinG = track(new THREE.BoxGeometry(0.05, 0.04, 0.07));
    for (const p of places2.filter((q) => q.cat === 'harbor')) {
      const s = toShore(p.x, p.z);
      const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = Math.atan2(s.nx, s.nz); // 로컬 +z = 바다 쪽
      const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
      put(quayG, quayM, 0, 0.04, 0.05); put(armG, quayM, 0.55, 0.06, 0.55); put(arm2G, quayM, -0.5, 0.06, 0.4);
      put(capG, redLM, 0.55, 0.2, 1.05); put(capG, greenLM, -0.5, 0.17, 0.78);
      for (let k = 0; k < (p.boats || 3); k++) {
        const b = new THREE.Group();
        const hull = new THREE.Mesh(hullG, hullM); const cab = new THREE.Mesh(cabinG, cabinMs[k % 4]); cab.position.set(0, 0.04, -0.03);
        b.add(hull, cab);
        const bx = -0.28 + k * 0.14, bz = 0.3 + (k % 2) * 0.16;
        b.position.set(bx, 0.02, bz); b.rotation.y = (rng() - 0.5) * 1.2;
        const ph = rng() * 6;
        anims.push((t) => { b.position.y = 0.02 + Math.sin(t * 1.4 + ph) * 0.012; b.rotation.z = Math.sin(t * 1.1 + ph) * 0.07; });
        g.add(b);
      }
      p.px = s.x + s.nx * 0.15; p.pz = s.z + s.nz * 0.15;
      addLayer('harbor', g);
    }
  }

  /* ── 올레길 (섬 한 바퀴) + 걸어 다니는 감귤이 ── */
  let olleCurve = null;
  {
    const pts = [], N = 720;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      let r = 2; // 섬 가운데에서 바깥으로 걸어 나가다 처음 바다를 만나는 곳 = 해안선 (우도 같은 외딴 섬은 건너뛰어요)
      while (r < 60 && heightAt(dx * r, dz * r) >= 0.02) r += 0.1;
      r -= 0.5; // 해안선에서 살짝 안쪽
      pts.push([dx * r, dz * r]);
    }
    const sm = pts.map((_, i) => { let sx = 0, sz = 0; for (let d = -3; d <= 3; d++) { const q = pts[(i + d + N) % N]; sx += q[0]; sz += q[1]; } return [sx / 7, sz / 7]; });
    const v3 = sm.map(([x, z]) => new THREE.Vector3(x, Math.max(yAt(x, z), 0.02) + 0.07, z));
    olleCurve = new THREE.CatmullRomCurve3(v3, true, 'catmullrom', 0.5);
    const SEG = 900, RAD = 5;
    const tube = track(new THREE.TubeGeometry(olleCurve, SEG, 0.04, RAD, true));
    const ca = new Float32Array(tube.attributes.position.count * 3), blue = C(0x1c6fe0), orange = C(0xff8a10);
    for (let i = 0; i <= SEG; i++) {
      const c = Math.floor((i / SEG) * 21) % 2 ? orange : blue;
      for (let j = 0; j <= RAD; j++) { const id = (i * (RAD + 1) + j) * 3; ca[id] = c.r; ca[id + 1] = c.g; ca[id + 2] = c.b; }
    }
    tube.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    const tubeMesh = new THREE.Mesh(tube, track(new THREE.MeshBasicMaterial({ vertexColors: true })));
    addLayer('olle', tubeMesh);

    // 감귤이 (올레길을 따라 폴짝폴짝)
    const w = new THREE.Group();
    const body = new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 14, 10)), track(new THREE.MeshStandardMaterial({ color: 0xff8a10, roughness: 0.5 })));
    body.position.y = 0.13; w.add(body);
    const leaf = new THREE.Mesh(track(new THREE.SphereGeometry(0.05, 8, 6)), track(new THREE.MeshStandardMaterial({ color: 0x3aa655 }))); leaf.scale.set(1.6, 0.5, 1); leaf.position.set(0.04, 0.27, 0); leaf.rotation.z = 0.4; w.add(leaf);
    const eyeM = track(new THREE.MeshBasicMaterial({ color: 0x12222c })), eyeG = track(new THREE.SphereGeometry(0.018, 6, 5));
    for (const s of [-1, 1]) { const e = new THREE.Mesh(eyeG, eyeM); e.position.set(0.11, 0.16, s * 0.05); w.add(e); }
    w.scale.setScalar(1.6);
    addLayer('olle', w);
    const len = olleCurve.getLength(), tan = new THREE.Vector3(), pp = new THREE.Vector3();
    anims.push((t) => {
      const u = (t * 2.8 / len) % 1;
      olleCurve.getPointAt(u, pp); olleCurve.getTangentAt(u, tan);
      w.position.set(pp.x, pp.y + Math.abs(Math.sin(t * 7)) * 0.2, pp.z);
      w.rotation.y = Math.atan2(-tan.z, tan.x);
    });
  }

  /* ───────────────────────── 핀(HTML) ───────────────────────── */
  const pinsEl = document.createElement('div');
  pinsEl.className = 'jm-pins';
  container.appendChild(pinsEl);
  const LIFT = { sight: 0.7, oreum: 0.6, olle: 0.6, harbor: 0.7, citrus: 0.8, wind: 0.9, light: 1.35, dol: 0.9 };
  const pins = places2.map((p) => {
    let x = p.px, z = p.pz;
    if (x == null) {
      if (p.cat === 'wind') { const arr = windInfo[p.id]; x = arr.reduce((s, q) => s + q[0], 0) / arr.length; z = arr.reduce((s, q) => s + q[1], 0) / arr.length; }
      else [x, z] = findLand(p.x, p.z, 0.02, 6);
    }
    const ground = p.cat === 'wind' && p.offshore ? 0.02 : Math.max(yAt(x, z), 0.02);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'jm-pin';
    el.style.setProperty('--c', catColor[p.cat]);
    el.innerHTML = `<span class="jm-ic">${catEmoji[p.cat]}</span><span class="jm-lb">${p.name}</span>`;
    el.setAttribute('aria-label', p.name);
    el.addEventListener('click', (e) => { e.stopPropagation(); onSelect && onSelect(p.id); });
    pinsEl.appendChild(el);
    return { place: p, el, pos: new THREE.Vector3(x, ground + (LIFT[p.cat] || 0.7) + (p.id === 'hallasan' ? 0.5 : 0), z), ground: new THREE.Vector3(x, ground, z), visible: true, near: false, occluded: false, hidden: false };
  });
  const pinById = Object.fromEntries(pins.map((p) => [p.place.id, p]));

  /* 카테고리 켜고 끄기 */
  const catOn = new Set(categories.map((c) => c.id));
  function setCategories(set) {
    catOn.clear(); set.forEach((c) => catOn.add(c));
    for (const [cat, objs] of Object.entries(layers)) objs.forEach((o) => { o.visible = catOn.has(cat); });
  }

  /* 낮 / 밤 */
  let night = 0, nightTarget = 0, lastApplied = -1;
  const tc = new THREE.Color();
  function applyLook(n) {
    const d = LOOK.day, k = LOOK.night;
    skyU.uTop.value.copy(d.top).lerp(k.top, n);
    skyU.uHor.value.copy(d.hor).lerp(k.hor, n);
    skyU.uSun.value.copy(d.sun).lerp(k.sun, n);
    skyU.uSunCol.value.copy(d.sunCol).lerp(k.sunCol, n);
    skyU.uNight.value = n;
    scene.fog.color.copy(skyU.uHor.value);
    hemi.color.copy(d.hemiSky).lerp(k.hemiSky, n); hemi.groundColor.copy(d.hemiGround).lerp(k.hemiGround, n); hemi.intensity = lerp(d.hemiI, k.hemiI, n);
    sun.color.copy(d.dirCol).lerp(k.dirCol, n); sun.intensity = lerp(d.dirI, k.dirI, n);
    sun.position.copy(skyU.uSun.value).normalize().multiplyScalar(120);
    seaU.uNight.value = n;
    seaU.uShallow.value.copy(d.seaShallow).lerp(k.seaShallow, n); seaU.uDeep.value.copy(d.seaDeep).lerp(k.seaDeep, n);
    seaU.uFog.value.copy(skyU.uHor.value); seaU.uSun.value.copy(skyU.uSun.value); seaU.uSunCol.value.copy(skyU.uSunCol.value);
    beamMats.forEach((m) => { m.opacity = 0.26 * n; });
    lanternMats.forEach((m) => m.color.copy(tc.set(0xcfd8dc)).lerp(C(0xffe27a), n));
  }
  applyLook(0);

  /* 카메라 날아가기 */
  let flight = null;
  const v1 = new THREE.Vector3();
  function flyTo(target, dist) {
    const off = v1.copy(camera.position).sub(controls.target); off.y = Math.max(off.y, 0.001);
    off.normalize(); off.y = clamp(off.y, 0.5, 0.78); off.normalize().multiplyScalar(dist);
    flight = { t0: performance.now(), dur: 1400, fromT: controls.target.clone(), toT: target.clone(), fromP: camera.position.clone(), toP: target.clone().add(off) };
    controls.enabled = false;
  }
  const FOCUS = { sight: 7, oreum: 9, olle: 10, harbor: 6, citrus: 9, wind: 8, light: 5, dol: 5 };
  function select(id) {
    for (const p of pins) p.el.classList.toggle('sel', p.place.id === id);
    if (!id) return;
    const p = pinById[id]; if (!p) return;
    if (controls.autoRotate) { controls.autoRotate = false; onAutoRotateChange && onAutoRotateChange(false); }
    flyTo(p.ground, p.place.focus || FOCUS[p.place.cat] || 7);
  }
  function resetView() { flight = { t0: performance.now(), dur: 1400, fromT: controls.target.clone(), toT: HOME.target.clone(), fromP: camera.position.clone(), toP: HOME.pos.clone() }; controls.enabled = false; }
  function setAutoRotate(b) { controls.autoRotate = !!b; }
  function setNight(b) { nightTarget = b ? 1 : 0; }

  /* 크기 */
  const resize = () => {
    const w = container.clientWidth || 800, h = container.clientHeight || 500;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  /* 루프 */
  const clock = new THREE.Clock();
  let raf = 0, tAcc = 0, disposed = false;
  const pv = new THREE.Vector3();
  function updatePins() {
    const w = container.clientWidth, h = container.clientHeight;
    for (const p of pins) {
      const on = catOn.has(p.place.cat);
      let show = on;
      if (on) {
        pv.copy(p.pos).project(camera);
        show = pv.z < 1 && pv.x > -1.05 && pv.x < 1.05 && pv.y > -1.05 && pv.y < 1.05;
        if (show) {
          // 산 뒤에 가려졌는지 높이 격자로 확인
          let occ = false;
          for (let k = 1; k < 14; k++) {
            const t = k / 14, x = lerp(camera.position.x, p.pos.x, t), z = lerp(camera.position.z, p.pos.z, t), y = lerp(camera.position.y, p.pos.y, t);
            if (heightAt(x, z) * VS > y + 0.15) { occ = true; break; }
          }
          show = !occ;
        }
        if (show) {
          const x = (pv.x * 0.5 + 0.5) * w, y = (-pv.y * 0.5 + 0.5) * h;
          p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
          p.el.style.zIndex = String(Math.round((1 - pv.z) * 10000));
          const near = camera.position.distanceTo(p.pos) < 24;
          if (near !== p.near) { p.near = near; p.el.classList.toggle('near', near); }
        }
      }
      if (show === p.hidden) { p.hidden = !show; p.el.style.display = show ? '' : 'none'; }
    }
  }
  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1); tAcc += dt;
    if (flight) {
      const k = clamp((performance.now() - flight.t0) / flight.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      controls.target.lerpVectors(flight.fromT, flight.toT, e);
      camera.position.lerpVectors(flight.fromP, flight.toP, e);
      if (k >= 1) { flight = null; controls.enabled = true; }
    }
    controls.update();
    controls.target.x = clamp(controls.target.x, -50, 50); controls.target.z = clamp(controls.target.z, -34, 34); controls.target.y = clamp(controls.target.y, 0, 9);
    const minY = Math.max(heightAt(camera.position.x, camera.position.z) * VS, 0) + 0.6;
    if (camera.position.y < minY) camera.position.y = minY;
    if (Math.abs(night - nightTarget) > 0.001) { night += (nightTarget - night) * Math.min(1, dt * 2.5); if (Math.abs(night - nightTarget) < 0.004) night = nightTarget; }
    if (night !== lastApplied) { applyLook(night); lastApplied = night; }
    seaU.uTime.value = tAcc;
    sky.position.copy(camera.position);
    for (const f of anims) f(tAcc, dt);
    updatePins();
    renderer.render(scene, camera);
  }
  frame();

  function dispose() {
    disposed = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
    disposables.forEach((d) => d.dispose && d.dispose());
    heightTex.dispose(); renderer.dispose();
    if (canvas.parentNode === container) container.removeChild(canvas);
    if (pinsEl.parentNode === container) container.removeChild(pinsEl);
  }

  return { setCategories, setNight, select, resetView, setAutoRotate, dispose };
}
