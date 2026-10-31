/**
 * Night city for the landing hero. Loaded on demand (dynamic import) so three.js never blocks first paint.
 *
 * - Instanced buildings with procedural windows; a few lights switch on and off slowly, like a city working late.
 * - Sodium street lamps along the avenues.
 * - Amber light streams arc between rooftops: payments settling while the city sleeps.
 * - Slow camera drift with a gentle pointer parallax. Pauses when hidden or off screen.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Fog,
  InstancedBufferAttribute,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  Scene,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from "three";

export interface CityOptions {
  reducedMotion: boolean;
  lowPower: boolean;
}

const NIGHT = new Color("#05081a");

// Small deterministic PRNG so the skyline is the same on every visit.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glowTexture(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, outer);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

const buildingVertex = /* glsl */ `
  attribute vec3 aSize;
  attribute float aSeed;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying float vSeed;
  varying float vDepth;
  varying float vHeight;
  void main() {
    vec3 p = position * aSize;
    p.y += aSize.y * 0.5;
    vLocal = p;
    vNormal = normal;
    vSeed = aSeed;
    vHeight = aSize.y;
    vec4 world = instanceMatrix * vec4(p, 1.0);
    vec4 mv = modelViewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const buildingFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying float vSeed;
  varying float vDepth;
  varying float vHeight;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec3 base = mix(vec3(0.030, 0.045, 0.105), vec3(0.060, 0.085, 0.185), clamp(vLocal.y / 18.0, 0.0, 1.0));
    vec3 color = base;
    float side = 1.0 - abs(vNormal.y);
    if (side > 0.5) {
      float u = abs(vNormal.x) > 0.5 ? vLocal.z : vLocal.x;
      vec2 cellSize = vec2(0.42, 0.62);
      vec2 cell = floor(vec2(u, vLocal.y) / cellSize);
      vec2 f = fract(vec2(u, vLocal.y) / cellSize);
      float inWin = step(0.22, f.x) * step(f.x, 0.78) * step(0.25, f.y) * step(f.y, 0.75);
      float topMargin = step(vLocal.y, vHeight - 0.5) * step(0.6, vLocal.y);
      float h = hash(cell + vSeed * 17.0 + (abs(vNormal.x) > 0.5 ? 3.0 : 7.0));
      // A small share of windows change state slowly over time.
      float phase = floor(uTime * 0.07 + h * 23.0);
      float h2 = hash(cell + vSeed * 9.0 + phase);
      float lit = step(0.80, h) + step(0.965, h2) * step(h, 0.80);
      lit = clamp(lit, 0.0, 1.0) * inWin * topMargin;
      vec3 warm = vec3(1.0, 0.70, 0.30);
      vec3 cool = vec3(0.72, 0.80, 1.0);
      vec3 win = mix(warm, cool, step(0.93, hash(cell * 1.7 + vSeed)));
      float flicker = 0.85 + 0.15 * sin(uTime * 2.0 + h * 40.0);
      color = mix(color, win * (0.9 * flicker), lit);
      // Faint edge light so silhouettes read against the sky.
      color += vec3(0.05, 0.07, 0.14) * smoothstep(0.0, 0.2, vLocal.y / max(vHeight, 0.01)) * 0.4;
    } else if (vNormal.y > 0.5) {
      color = vec3(0.045, 0.06, 0.13);
    }
    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    gl_FragColor = vec4(mix(color, uFog, fog), 1.0);
  }
`;

export function startCity(canvas: HTMLCanvasElement, opts: CityOptions): () => void {
  const renderer = new WebGLRenderer({ canvas, antialias: !opts.lowPower, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1 : 1.75));
  renderer.setClearColor(NIGHT, 0); // the CSS sky gradient shows through

  const scene = new Scene();
  scene.fog = new Fog(NIGHT, 30, 110);
  const camera = new PerspectiveCamera(38, 1, 0.1, 400);

  const rand = rng(4663);

  // Buildings
  const grid = opts.lowPower ? 22 : 30;
  const spacing = 2.3;
  const positions: { x: number; z: number; w: number; d: number; h: number }[] = [];
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      if (i % 5 === 2 || j % 6 === 3) continue; // avenues
      const x = (i - grid / 2) * spacing + (rand() - 0.5) * 0.3;
      const z = (j - grid / 2) * spacing + (rand() - 0.5) * 0.3;
      const dist = Math.hypot(x * 0.8, z) / (grid * spacing * 0.5);
      const falloff = Math.max(0, 1 - dist);
      if (rand() > 0.15 + falloff) continue;
      const tall = Math.pow(rand(), 2.6) * 22 * falloff + 1.2 + rand() * 2.5 * falloff;
      positions.push({ x, z, w: 1.25 + rand() * 0.7, d: 1.25 + rand() * 0.7, h: tall });
    }
  }
  const box = new BoxGeometry(1, 1, 1);
  const buildingMat = new ShaderMaterial({
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
    uniforms: {
      uTime: { value: 0 },
      uFog: { value: NIGHT.clone() },
      uFogNear: { value: 30 },
      uFogFar: { value: 110 },
    },
  });
  const buildings = new InstancedMesh(box, buildingMat, positions.length);
  const sizes = new Float32Array(positions.length * 3);
  const seeds = new Float32Array(positions.length);
  const m = new Matrix4();
  positions.forEach((p, k) => {
    m.makeTranslation(p.x, 0, p.z);
    buildings.setMatrixAt(k, m);
    sizes.set([p.w, p.h, p.d], k * 3);
    seeds[k] = rand() * 100;
  });
  box.setAttribute("aSize", new InstancedBufferAttribute(sizes, 3));
  box.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
  buildings.frustumCulled = false;
  scene.add(buildings);

  // Ground
  const ground = new Mesh(new PlaneGeometry(400, 400), new MeshBasicMaterial({ color: "#04061a" }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Sodium street lamps along the avenues
  const lampPts: number[] = [];
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const onAvenueX = i % 5 === 2;
      const onAvenueZ = j % 6 === 3;
      if ((onAvenueX || onAvenueZ) && rand() > 0.35) {
        lampPts.push((i - grid / 2) * spacing, 0.25, (j - grid / 2) * spacing);
      }
    }
  }
  const lampGeo = new BufferGeometry();
  lampGeo.setAttribute("position", new BufferAttribute(new Float32Array(lampPts), 3));
  const lampTex = glowTexture("rgba(255,214,150,1)", "rgba(242,169,59,0.45)");
  const lamps = new Points(
    lampGeo,
    new PointsMaterial({ size: 1.1, map: lampTex, transparent: true, depthWrite: false, blending: AdditiveBlending, color: "#ffb44d", fog: true }),
  );
  scene.add(lamps);

  // Stars
  const starCount = opts.lowPower ? 500 : 1100;
  const starPos = new Float32Array(starCount * 3);
  for (let k = 0; k < starCount; k++) {
    const theta = rand() * Math.PI * 2;
    const phi = rand() * Math.PI * 0.42;
    const r = 180;
    starPos.set([r * Math.sin(phi) * Math.cos(theta), 25 + r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta) - 40], k * 3);
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute("position", new BufferAttribute(starPos, 3));
  const stars = new Points(
    starGeo,
    new PointsMaterial({ size: 0.7, color: "#cfd6ff", transparent: true, opacity: 0.75, depthWrite: false, fog: false, sizeAttenuation: true }),
  );
  scene.add(stars);

  // Moon
  const moon = new Sprite(
    new SpriteMaterial({ map: glowTexture("rgba(244,240,255,1)", "rgba(200,205,255,0.25)"), transparent: true, depthWrite: false, fog: false }),
  );
  moon.position.set(-58, 62, -150);
  moon.scale.set(46, 46, 1);
  scene.add(moon);

  // Payment streams
  const tops = positions.filter((p) => p.h > 6);
  const headTex = glowTexture("rgba(255,236,200,1)", "rgba(242,169,59,0.6)");
  type Stream = { curve: QuadraticBezierCurve3; line: Line; head: Sprite; t: number; speed: number; geo: BufferGeometry };
  const streams: Stream[] = [];
  const streamCount = tops.length < 4 ? 0 : opts.lowPower ? 5 : 9;
  const pick = () => tops[Math.floor(rand() * tops.length)];
  const makeCurve = () => {
    const a = pick();
    let b = pick();
    for (let tries = 0; tries < 6 && Math.hypot(a.x - b.x, a.z - b.z) < 10; tries++) b = pick();
    const from = new Vector3(a.x, a.h + 0.3, a.z);
    const to = new Vector3(b.x, b.h + 0.3, b.z);
    const mid = from.clone().lerp(to, 0.5);
    mid.y += 6 + from.distanceTo(to) * 0.35;
    return new QuadraticBezierCurve3(from, mid, to);
  };
  for (let k = 0; k < streamCount; k++) {
    const curve = makeCurve();
    const geo = new BufferGeometry().setFromPoints(curve.getPoints(48));
    const line = new Line(geo, new LineBasicMaterial({ color: "#f2a93b", transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false }));
    const head = new Sprite(new SpriteMaterial({ map: headTex, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    head.scale.set(1.6, 1.6, 1);
    scene.add(line, head);
    streams.push({ curve, line, head, t: rand(), speed: 0.08 + rand() * 0.1, geo });
  }

  // Sizing
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 50 : 38;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Pointer parallax
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  if (!opts.reducedMotion) window.addEventListener("pointermove", onPointer, { passive: true });

  // Loop
  let raf = 0;
  let running = false;
  let visible = true;
  let last = performance.now();
  let elapsed = 0;
  const lookAt = new Vector3(0, 5, 0);

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    buildingMat.uniforms.uTime.value = elapsed;

    current.x += (target.x - current.x) * 0.03;
    current.y += (target.y - current.y) * 0.03;
    const angle = elapsed * 0.018 + 0.6;
    const radius = 46;
    camera.position.set(Math.sin(angle) * radius + current.x * 2.5, 17 - current.y * 1.5, Math.cos(angle) * radius);
    camera.lookAt(lookAt);

    for (const s of streams) {
      s.t += dt * s.speed;
      if (s.t >= 1) {
        s.t = 0;
        s.curve = makeCurve();
        s.geo.setFromPoints(s.curve.getPoints(48));
      }
      const p = s.curve.getPoint(s.t);
      s.head.position.copy(p);
      const fade = Math.sin(s.t * Math.PI);
      (s.head.material as SpriteMaterial).opacity = 0.35 + 0.65 * fade;
      (s.line.material as LineBasicMaterial).opacity = 0.05 + 0.14 * fade;
    }

    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running || opts.reducedMotion) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  if (opts.reducedMotion) {
    elapsed = 12;
    frame(performance.now());
  } else {
    start();
  }

  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible && !document.hidden) start();
    else stop();
  });
  io.observe(canvas);
  const onVis = () => {
    if (document.hidden) stop();
    else if (visible) start();
  };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    stop();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pointermove", onPointer);
    scene.traverse((o) => {
      const mesh = o as Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as { dispose?: () => void } | undefined;
      mat?.dispose?.();
    });
    lampTex.dispose();
    headTex.dispose();
    renderer.dispose();
  };
}
