import * as THREE from 'three';

const FOV = 35;
const CAMERA_Z = 8;
const PORTRAIT_H = 3.6; // world units
const INTRO_SECONDS = 3.2;
const THRESHOLD = 0.06; // pixels darker than this (the black backdrop) get no glyph

const glyphFrag = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBit;

  void main() {
    // atlas holds "0" on the left half and "1" on the right half
    vec2 uv = vec2((gl_PointCoord.x + vBit) * 0.5, 1.0 - gl_PointCoord.y);
    float a = texture2D(uAtlas, uv).a * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const portraitVert = /* glsl */ `
  uniform float uTime;
  uniform float uIntro;
  uniform float uScatter;
  uniform vec3 uMouse;
  uniform float uMouseForce;
  uniform float uSize;
  uniform float uScale;
  uniform vec3 uTint;
  uniform float uTravel;
  uniform float uFall;
  uniform float uRain;
  uniform float uWind;
  uniform float uLogo;
  uniform vec3 uLogoOffset;
  uniform float uPdz;
  uniform vec3 uPdzOffset;
  uniform float uRideA;
  uniform vec3 uRideAOffset;
  uniform float uRideB;
  uniform vec3 uRideBOffset;
  uniform float uRoute;
  uniform vec3 uRouteOffset;
  uniform float uHand;
  uniform vec3 uHandOffset;

  attribute vec3 aStart;
  attribute vec3 aScatter;
  attribute vec3 aColor;
  attribute vec3 aMeta; // x = seed, y = bit, z = light level
  // shape targets: xyz = position, w > 0 when this glyph belongs to the shape
  attribute vec4 aLogo;
  attribute vec4 aPdz;
  attribute vec3 aPdzColor;
  attribute vec4 aRideA;
  attribute vec3 aRideAColor;
  attribute vec4 aRideB;
  attribute vec3 aRideBColor;
  attribute vec4 aRoute; // w = how far along the route, in (0, 1]
  attribute vec4 aHand; // w = how red the print is there

  varying vec3 vColor;
  varying float vAlpha;
  varying float vBit;

  const vec3 LIME = vec3(0.8, 1.0, 0.0);
  const vec3 STRAVA = vec3(0.99, 0.3, 0.01);
  const vec3 MATRIX = vec3(0.3, 1.0, 0.5);
  const vec3 RED = vec3(1.0, 0.1, 0.08);
  // where each rider's trail streams: behind the road rider (riding right),
  // and back into depth for the time-trial rider (coming at the camera, to the left)
  const vec3 TRAIL_A = vec3(-1.0, 0.0, 0.0);
  const vec3 TRAIL_B = vec3(0.8, 0.05, -0.6);

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float easeOut(float t) { return 1.0 - pow(1.0 - t, 3.0); }
  // how far a glyph has travelled into a shape, staggered by its seed
  float join(float amount, float seed, float member) {
    float x = clamp(amount * 1.3 - seed * 0.3, 0.0, 1.0);
    return x * x * (3.0 - 2.0 * x) * member;
  }

  void main() {
    float seed = aMeta.x;
    float lum = aMeta.z;

    // intro: every glyph rains down into its place, staggered
    float t = clamp((uIntro - seed * 0.55) / 0.45, 0.0, 1.0);
    vec3 pos = mix(aStart, position, easeOut(t));

    // idle drift
    pos.xy += vec2(sin(uTime * 0.7 + seed * 40.0), cos(uTime * 0.6 + seed * 31.0)) * 0.004;

    // glitch: now and then a thin horizontal slice slips sideways
    float slot = floor(uTime * 6.0);
    float band = (hash(slot + 1.0) - 0.5) * 3.6;
    float glitch = step(0.96, hash(slot)) * step(abs(pos.y - band), 0.05 + hash(slot + 2.0) * 0.12);
    pos.x += glitch * (hash(slot + 3.0) - 0.5) * 0.5;

    // scroll: the face dissolves into a field of bits
    float s = clamp(uScatter * 1.4 - seed * 0.4, 0.0, 1.0);
    s = s * s * (3.0 - 2.0 * s);
    vec3 drift = vec3(sin(uTime * 0.11 + seed * 12.0), cos(uTime * 0.09 + seed * 9.0), 0.0) * 0.4;
    vec3 field = aScatter + drift;
    // the field rushes sideways while a rider is on screen (nearer bits faster)
    // and falls like rain on \`matrix\`
    field.x = mod(field.x - uTravel * (0.5 + (aScatter.z + 6.0) * 0.2) + 8.0, 16.0) - 8.0;
    field.y = mod(field.y - uFall * (0.6 + seed) + 5.0, 10.0) - 5.0;
    pos = mix(pos, field, s);

    // further down, parts of the field regroup into the two logos
    float l = join(uLogo, seed, aLogo.w);
    pos = mix(pos, aLogo.xyz + uLogoOffset, l);
    float p = join(uPdz, seed, aPdz.w);
    pos = mix(pos, aPdz.xyz + uPdzOffset, p);
    float logos = max(l, p);

    // in the ride section the field becomes the rider, first on the road, then against the clock.
    // Some glyphs keep peeling off and streaming backwards, like the blur of a panning shot.
    float trail = step(0.9, fract(seed * 37.3));
    float k = trail * fract(uTime * (0.35 + seed * 0.5) + seed * 13.0);
    float reach = k * (0.5 + seed * 1.8);
    float ra = join(uRideA, seed, aRideA.w);
    pos = mix(pos, aRideA.xyz + uRideAOffset + TRAIL_A * reach, ra);
    float rb = join(uRideB, seed, aRideB.w);
    pos = mix(pos, aRideB.xyz + uRideBOffset + TRAIL_B * reach, rb);
    float rider = max(ra, rb);

    // the last ride's route draws itself from start to finish, with a pulse riding along it
    float r = clamp(uRoute * 1.6 - aRoute.w * 0.6 - seed * 0.05, 0.0, 1.0);
    r = r * r * (3.0 - 2.0 * r) * step(0.0001, aRoute.w);
    pos = mix(pos, aRoute.xyz + uRouteOffset, r);
    float pulse = (1.0 - smoothstep(0.0, 0.025, abs(aRoute.w - fract(uTime * 0.06)))) * r;

    // and at the very end, a red hand, slowly reaching out at you
    float hd = join(uHand, seed, step(0.0001, aHand.w));
    vec3 reachOut = vec3(0.0, 0.0, (sin(uTime * 0.6) * 0.5 + 0.5) * 0.3);
    pos = mix(pos, aHand.xyz + uHandOffset + reachOut, hd);
    float shapes = max(max(max(logos, rider), r), hd);

    // fast scrolling smears everything sideways, like a photo finish
    pos.x -= uWind * (0.1 + seed * 0.9) * 0.6;

    // cursor lens: glyphs get pushed aside and toward the camera
    vec2 d = pos.xy - uMouse.xy;
    float f = (1.0 - smoothstep(0.0, 0.55, length(d))) * uMouseForce * max(1.0 - s, shapes);
    pos.xy += normalize(d + 1e-5) * f * 0.12;
    pos.z += f * 0.5;

    // scan line sweeping down the face
    float scanY = 2.4 - mod(uTime * 0.55, 9.0);
    float scan = (1.0 - smoothstep(0.0, 0.07, abs(pos.y - scanY))) * (1.0 - s) * lum;

    // bit comes from the light (warm = 1, cool = 0), flips now and then,
    // and flickers while falling, raining or disturbed
    float flip = step(0.92, fract(seed * 91.7 + uTime * (0.03 + seed * 0.1)));
    float hot = step(0.1, f + scan + glitch + (1.0 - t) + k * rider + uRain + pulse);
    float flicker = mod(floor(uTime * 14.0 + seed * 20.0), 2.0);
    vBit = abs(aMeta.y - max(flip, hot * flicker));

    vec3 color = mix(aColor * uTint, MATRIX, uRain * s * 0.7);
    color = mix(mix(color, LIME, l), aPdzColor, p);
    color = mix(mix(mix(color, aRideAColor, ra), aRideBColor, rb), STRAVA, r);
    color = mix(color, RED * (0.3 + 0.95 * aHand.w), hd);
    vColor = mix(color, vec3(1.0), clamp(f * 0.8 + scan * 0.5 + pulse, 0.0, 1.0));

    float base = lum * mix(1.0, 0.22, s) * (1.0 - min(1.0, uLogo + uPdz + uRoute + uHand) * 0.6) + uRain * s * 0.55;
    float shaped = mix(mix(mix(mix(base, 0.75, logos), 0.9 * (1.0 - k), rider), 0.85, r), 0.9, hd);
    vAlpha = (shaped + f * 0.7 + scan * 0.4 + (1.0 - t) * 0.3 + pulse * 0.5) * smoothstep(0.0, 0.06, t);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    // riders are sampled finer than the face, so their glyphs shrink to keep the detail crisp
    gl_PointSize = uSize * (0.8 + mix(lum, 0.6, shapes) * 0.35 + f * 0.5 + uRain * s * 0.5) * mix(1.0, 0.62, max(rider, hd)) * uScale / -mv.z;
  }
`;

const rainVert = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  uniform float uFade;

  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSpeed;
  attribute float aTrail;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vBit;

  void main() {
    vec3 p = position;
    p.y = mod(p.y - uTime * aSpeed + 7.0, 14.0) - 7.0;

    vBit = mod(floor(uTime * (0.6 + aSeed * 2.5) + aSeed * 10.0), 2.0);
    vColor = aColor;
    vAlpha = (1.0 - aTrail) * 0.2 * uFade * (1.0 - smoothstep(4.0, 7.0, abs(p.y)));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / -mv.z;
  }
`;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function makeAtlas() {
  const font = '500 48px "JetBrains Mono"';
  await Promise.race([document.fonts.load(font), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});

  const cell = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cell * 2;
  canvas.height = cell;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${cell * 0.78}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = cell * 0.07;
  ['0', '1'].forEach((ch, i) => ctx.fillText(ch, cell * (i + 0.5), cell * 0.53));
  return new THREE.CanvasTexture(canvas);
}

function pixels(img, w, h, { filter = 'none', crop = [0, 0, img.width, img.height] } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.filter = filter;
  ctx.drawImage(img, ...crop, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

// Turns the photo into glyph attributes: one glyph per lit pixel on a cols×rows grid.
function samplePortrait(img, cols) {
  const rows = Math.round((cols * img.height) / img.width);
  const px = pixels(img, cols, rows);
  const soft = pixels(img, cols, rows, { filter: `blur(${Math.max(1, cols / 60)}px)` }); // smooth depth map

  const cell = PORTRAIT_H / rows;
  const halfW = (cols * cell) / 2;
  const halfH = PORTRAIT_H / 2;
  const a = { position: [], aStart: [], aScatter: [], aColor: [], aMeta: [] };
  const rnd = (k = 1) => (Math.random() - 0.5) * k;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = px[i] / 255;
      const g = px[i + 1] / 255;
      const b = px[i + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < THRESHOLD) continue;

      const tx = (x + 0.5) * cell - halfW + rnd(cell * 0.3);
      const ty = halfH - (y + 0.5) * cell + rnd(cell * 0.3);
      // relief: a soft dome plus the blurred brightness pulling lit areas forward
      const depth = (0.2126 * soft[i] + 0.7152 * soft[i + 1] + 0.0722 * soft[i + 2]) / 255;
      const nx = tx / halfW;
      const ny = (ty + 0.1) / halfH;
      const tz = Math.max(0, 1 - nx * nx - ny * ny) * 0.55 + depth * 0.6 - 0.2;

      // keep the hue, lift the brightness; alpha carries the actual light level
      const m = Math.max(r, g, b);
      const k = Math.min(1, m * 1.8) / m;

      a.position.push(tx, ty, tz);
      a.aStart.push(tx + rnd(0.15), ty + 4 + Math.random() * 6, tz + rnd(1.5));
      a.aScatter.push(rnd(16), rnd(10), -6 + Math.random() * 8);
      a.aColor.push(r * k, g * k, b * k);
      a.aMeta.push(
        Math.random(),
        r > b ? 1 : 0,
        Math.max(0.15, Math.min(1, ((lum - THRESHOLD) / (0.45 - THRESHOLD)) ** 0.6)),
      );
    }
  }

  return { attrs: a, cell, width: cols * cell, count: a.position.length / 3 };
}

// Extra glyphs so the shapes further down can be denser than the face.
// In the hero they hang far behind the portrait as faint bits.
function padField(a, extra) {
  const rnd = (k = 1) => (Math.random() - 0.5) * k;
  for (let n = 0; n < extra; n++) {
    const [x, y, z] = [rnd(12), rnd(8), -3 - Math.random() * 4];
    a.position.push(x, y, z);
    a.aStart.push(x, y + 4 + Math.random() * 6, z);
    a.aScatter.push(rnd(16), rnd(10), -6 + Math.random() * 8);
    a.aColor.push(...(Math.random() < 0.25 ? [1, 0.48, 0.17] : [0.25, 0.55, 1]));
    a.aMeta.push(Math.random(), Math.random() < 0.5 ? 1 : 0, 0.04 + Math.random() * 0.08);
  }
}

function toGeometry(a) {
  const count = a.position.length / 3;
  const geo = new THREE.BufferGeometry();
  for (const [name, arr] of Object.entries(a)) geo.setAttribute(name, new THREE.Float32BufferAttribute(arr, arr.length / count));
  return geo;
}

// Hands each target point to a random face glyph; leftover glyphs stay in the field.
// `points` hold one value per attribute, `sizes` maps attribute name → item size.
function attachTargets(geo, count, points, sizes) {
  const pts = points.slice();
  // more points than glyphs: keep a random subset so the shape thins out evenly
  for (let k = pts.length - 1; k > 0 && pts.length > count; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [pts[k], pts[j]] = [pts[j], pts[k]];
  }
  const entries = Object.entries(sizes);
  const arrays = Object.fromEntries(entries.map(([name, size]) => [name, new Float32Array(count * size)]));
  const order = Uint32Array.from({ length: count }, (_, i) => i);
  const n = Math.min(pts.length, count);
  for (let k = 0; k < n; k++) {
    const j = k + Math.floor(Math.random() * (count - k));
    [order[k], order[j]] = [order[j], order[k]];
    for (const [name, size] of entries) arrays[name].set(pts[k][name], order[k] * size);
  }
  for (const [name, size] of entries) geo.setAttribute(name, new THREE.BufferAttribute(arrays[name], size));
}

// Glyph targets from an image with a transparent background, `height` world units tall,
// one per opaque pixel on a grid of `step`. `tone` maps a pixel's rgb to the glyph colour.
function sampleCutout(img, height, step, { crop = false, fadeBottom = 0, tone = (c) => c } = {}) {
  let box = [0, 0, img.width, img.height];
  if (crop) {
    const full = pixels(img, img.width, img.height);
    let [x0, y0, x1, y1] = [img.width, img.height, 0, 0];
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (full[(y * img.width + x) * 4 + 3] < 128) continue;
        [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      }
    }
    box = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  }

  const rows = Math.round(height / step);
  const cols = Math.round((rows * box[2]) / box[3]);
  const d = pixels(img, cols, rows, { crop: box });
  const pts = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      if (d[i + 3] < 128) continue;
      // a photo cut by its frame fades out at the bottom instead of ending in a hard line
      if (fadeBottom && Math.random() > (rows - y) / (rows * fadeBottom)) continue;
      pts.push({
        pos: [(x + 0.5 - cols / 2) * step, (rows / 2 - y - 0.5) * step, (Math.random() - 0.5) * 0.08],
        color: tone([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]),
      });
    }
  }
  return pts;
}

// Photos keep their shading (that is where the detail lives), lifted a little for the dark page.
const photoTone = (c) => c.map((v) => Math.min(1, Math.max(0.1, v * 1.3)));
// The Predialize wordmark is dark navy: on a black page it becomes lavender; the gradient mark stays.
const pdzTone = (c) => (Math.max(...c) < 0.35 ? [0.9, 0.87, 1] : c.map((v) => Math.min(1, v * 1.1)));

// The last ride's route (planar points, see scripts/strava.mjs) fitted into a w×h box and
// resampled every `step` along the path; w on each point says how far along the ride it is.
function sampleRoute(route, step, w = 3.4, h = 2.0) {
  if (!route?.length) return [];
  const xs = route.map(([x]) => x);
  const ys = route.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1));
  const pts = route.map(([x, y]) => [(x - (minX + maxX) / 2) * scale, (y - (minY + maxY) / 2) * scale]);

  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const total = seg.reduce((sum, d) => sum + d, 0);
  const out = [];
  let i = 0;
  let walked = 0;
  for (let d = 0; d <= total && i < seg.length; d += step) {
    while (i < seg.length - 1 && walked + seg[i] < d) walked += seg[i++];
    const f = seg[i] ? (d - walked) / seg[i] : 0;
    const [a, b] = [pts[i], pts[i + 1]];
    out.push({ aRoute: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, (Math.random() - 0.5) * 0.04, Math.max(0.001, d / total)] });
  }
  return out;
}

function makeRain() {
  const a = { position: [], aColor: [], aSeed: [], aSpeed: [], aTrail: [] };
  const blue = [0.25, 0.55, 1.0];
  const orange = [1.0, 0.48, 0.17];
  for (let c = 0; c < 46; c++) {
    const x = (Math.random() - 0.5) * 20;
    const z = -9 + Math.random() * 6;
    const y0 = (Math.random() - 0.5) * 14;
    const speed = 0.35 + Math.random() * 0.9;
    const len = 6 + Math.floor(Math.random() * 11);
    const color = Math.random() < 0.2 ? orange : blue;
    for (let k = 0; k < len; k++) {
      a.position.push(x, y0 + k * 0.22, z);
      a.aColor.push(...color);
      a.aSeed.push(Math.random());
      a.aSpeed.push(speed);
      a.aTrail.push(k / len); // k = 0 is the stream's head (lowest, brightest)
    }
  }
  const geo = new THREE.BufferGeometry();
  for (const [name, arr] of Object.entries(a)) {
    const size = arr.length / a.aSeed.length;
    geo.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
  }
  return geo;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export async function createScene({ canvas, image, logos, rides, hand, route, tint = [1, 1, 1], reduced = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x030304, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.z = CAMERA_Z;

  const [img, xpImg, pdzImg, roadImg, ttImg, handImg, routePoints, atlas] = await Promise.all([
    loadImage(image),
    loadImage(logos.eventosxp),
    loadImage(logos.predialize),
    loadImage(rides.road),
    loadImage(rides.tt),
    loadImage(hand),
    route,
    makeAtlas(),
  ]);
  const portrait = samplePortrait(img, innerWidth < 700 ? 72 : 105);
  const { cell } = portrait;
  const xp = sampleCutout(xpImg, 1.7, cell * 0.55, { crop: true });
  const pdz = sampleCutout(pdzImg, 0.95, cell * 0.5, { crop: true, tone: pdzTone });
  const road = sampleCutout(roadImg, 2.9, cell * 0.5, { tone: photoTone });
  const tt = sampleCutout(ttImg, 2.9, cell * 0.5, { fadeBottom: 0.12, tone: photoTone });
  const ridden = sampleRoute(routePoints, cell * 0.5);
  const palm = sampleCutout(handImg, 2.9, cell * 0.5, { fadeBottom: 0.15 });

  // the face sets the glyph count, unless a shape needs more
  const count = Math.max(portrait.count, xp.length, pdz.length, road.length, tt.length, ridden.length, palm.length);
  padField(portrait.attrs, count - portrait.count);
  const geo = toGeometry(portrait.attrs);
  attachTargets(geo, count, xp.map((p) => ({ aLogo: [...p.pos, 1] })), { aLogo: 4 });
  attachTargets(geo, count, pdz.map((p) => ({ aPdz: [...p.pos, 1], aPdzColor: p.color })), { aPdz: 4, aPdzColor: 3 });
  attachTargets(geo, count, road.map((p) => ({ aRideA: [...p.pos, 1], aRideAColor: p.color })), { aRideA: 4, aRideAColor: 3 });
  attachTargets(geo, count, tt.map((p) => ({ aRideB: [...p.pos, 1], aRideBColor: p.color })), { aRideB: 4, aRideBColor: 3 });
  attachTargets(geo, count, ridden, { aRoute: 4 });
  // the print's red channel becomes the shade, so its grain survives
  attachTargets(geo, count, palm.map((p) => ({ aHand: [...p.pos, Math.max(0.05, p.color[0])] })), { aHand: 4 });

  const uniforms = {
    uTime: { value: 0 },
    uIntro: { value: reduced ? 1 : 0 },
    uScatter: { value: 0 },
    uMouse: { value: new THREE.Vector3(99, 99, 0) },
    uMouseForce: { value: 0 },
    uSize: { value: 1 },
    uScale: { value: 1 },
    uAtlas: { value: atlas },
    uLogo: { value: 0 },
    uLogoOffset: { value: new THREE.Vector3() },
    uPdz: { value: 0 },
    uPdzOffset: { value: new THREE.Vector3() },
    uRideA: { value: 0 },
    uRideAOffset: { value: new THREE.Vector3() },
    uRideB: { value: 0 },
    uRideBOffset: { value: new THREE.Vector3() },
    uRoute: { value: 0 },
    uRouteOffset: { value: new THREE.Vector3() },
    uHand: { value: 0 },
    uHandOffset: { value: new THREE.Vector3() },
    uTint: { value: new THREE.Vector3(...tint) },
    uTravel: { value: 0 },
    uFall: { value: 0 },
    uRain: { value: 0 },
    uWind: { value: 0 },
  };
  const rainUniforms = {
    uTime: uniforms.uTime,
    uScale: uniforms.uScale,
    uAtlas: uniforms.uAtlas,
    uSize: { value: 0.16 },
    uFade: { value: 1 },
  };
  const material = (vertexShader, u) =>
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: glyphFrag,
      uniforms: u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

  const face = new THREE.Points(geo, material(portraitVert, uniforms));
  face.frustumCulled = false; // the shader moves glyphs far outside the geometry bounds
  const group = new THREE.Group();
  group.add(face);
  scene.add(group);

  const rain = new THREE.Points(makeRain(), material(rainVert, rainUniforms));
  rain.frustumCulled = false;
  scene.add(rain);

  const view = { w: 1, h: 1 };
  function layout() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();

    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    uniforms.uScale.value = (innerHeight * renderer.getPixelRatio()) / (2 * tan);

    // Wide screens: portrait on the right, text on the left. Narrow: portrait on top.
    const visH = 2 * CAMERA_Z * tan;
    const visW = visH * camera.aspect;
    view.w = visW;
    view.h = visH;
    const wide = camera.aspect > 1.1;
    group.scale.setScalar(Math.min(1, (visW * (wide ? 0.6 : 0.92)) / portrait.width));
    // point sizes are in world units, so they follow the group's scale by hand
    uniforms.uSize.value = portrait.cell * 1.7 * group.scale.x;
    group.position.set(wide ? visW * 0.17 : 0, wide ? 0 : visH * 0.13, 0);
  }
  layout();
  addEventListener('resize', layout);

  // Pointer → local position on the portrait plane
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let inside = false;
  let energy = 0;
  let last = null;

  addEventListener(
    'pointermove',
    (e) => {
      pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (last) energy = Math.min(1, energy + Math.hypot(e.clientX - last.x, e.clientY - last.y) * 0.004);
      last = { x: e.clientX, y: e.clientY };
      inside = true;
    },
    { passive: true },
  );
  const leave = () => {
    inside = false;
    last = null;
  };
  document.addEventListener('mouseout', (e) => !e.relatedTarget && leave());
  addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && leave());
  addEventListener('pointercancel', leave);
  addEventListener('blur', leave);

  let time = 0;
  let intro = reduced ? 1 : 0;
  let scatterTarget = 0;
  // DOM elements the field regroups over: two logos and two riders
  const stages = {
    pdz: { el: null, amount: uniforms.uPdz, offset: uniforms.uPdzOffset },
    logo: { el: null, amount: uniforms.uLogo, offset: uniforms.uLogoOffset },
    rideA: { el: null, amount: uniforms.uRideA, offset: uniforms.uRideAOffset },
    rideB: { el: null, amount: uniforms.uRideB, offset: uniforms.uRideBOffset },
    route: { el: null, amount: uniforms.uRoute, offset: uniforms.uRouteOffset },
    hand: { el: null, amount: uniforms.uHand, offset: uniforms.uHandOffset },
  };
  let rainUntil = 0;
  let lastScrollY = scrollY;
  let wind = 0;
  let resolveIntro;
  const introDone = new Promise((r) => (resolveIntro = r));
  if (intro === 1) resolveIntro();

  let prev = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(Math.max(0, now - prev) / 1000, 0.05);
    prev = now;
    const ease = (rate) => 1 - Math.exp(-rate * dt);
    if (!reduced) time += dt;

    if (intro < 1) {
      intro = Math.min(1, intro + dt / INTRO_SECONDS);
      if (intro === 1) resolveIntro();
    }
    uniforms.uTime.value = time;
    uniforms.uIntro.value = intro;
    // `matrix`: for a few seconds everything dissolves and falls as rain
    const raining = now < rainUntil ? 1 : 0;
    uniforms.uRain.value += (raining - uniforms.uRain.value) * ease(3);
    uniforms.uFall.value += dt * 4 * uniforms.uRain.value;
    uniforms.uScatter.value += (Math.max(scatterTarget, raining) - uniforms.uScatter.value) * ease(4);
    rainUniforms.uFade.value = 1 - uniforms.uScatter.value * 0.5;

    // scroll speed (viewports per second) becomes wind: bits smear sideways and the field rushes
    const velocity = dt ? (scrollY - lastScrollY) / dt / innerHeight : 0;
    lastScrollY = scrollY;
    wind += (Math.min(1, Math.abs(velocity) * 0.35) - wind) * ease(6);
    uniforms.uWind.value = reduced ? 0 : wind;
    if (!reduced) uniforms.uTravel.value += dt * velocity * 0.8;

    // a shape forms while its stage element sits near the middle of the viewport,
    // anchored to it so it scrolls with the page
    for (const stage of Object.values(stages)) {
      let target = 0;
      const r = stage.el?.getBoundingClientRect();
      if (r?.height) {
        const cx = (r.left + r.width / 2) / innerWidth;
        const cy = (r.top + r.height / 2) / innerHeight;
        target = (1 - smoothstep(0.18, 0.55, Math.abs(cy - 0.5))) * (1 - raining);
        stage.offset.value.set(
          ((cx - 0.5) * view.w - group.position.x) / group.scale.x,
          ((0.5 - cy) * view.h - group.position.y) / group.scale.y,
          0,
        );
      }
      stage.amount.value += (target - stage.amount.value) * ease(5);
    }
    // the road rider heads right, so the world streams left; the time-trial rider the other way
    if (!reduced) uniforms.uTravel.value += dt * 2.2 * (uniforms.uRideA.value - uniforms.uRideB.value);

    // cursor lens: gentle while hovering, stronger when moving fast, heals when idle
    energy *= Math.exp(-2.5 * dt);
    const force = inside ? 0.45 + 0.55 * energy : 0;
    uniforms.uMouseForce.value += (force - uniforms.uMouseForce.value) * ease(6);
    if (inside) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        group.worldToLocal(hit);
        const m = uniforms.uMouse.value;
        if (m.x > 50) m.copy(hit);
        else m.lerp(hit, ease(14));
      }
    }

    // parallax so the relief reads as 3D
    const sway = Math.sin(time * 0.25) * 0.06;
    group.rotation.y += (pointer.x * 0.3 + sway - group.rotation.y) * ease(3);
    group.rotation.x += (-pointer.y * 0.15 - group.rotation.x) * ease(3);

    renderer.render(scene, camera);
  });

  return {
    count: portrait.count,
    introDone,
    setScroll(p) {
      scatterTarget = p;
    },
    setStages(els) {
      for (const [name, el] of Object.entries(els)) stages[name].el = el;
    },
    hasRoute: ridden.length > 0,
    matrix(ms = 5000) {
      rainUntil = performance.now() + ms;
    },
  };
}
