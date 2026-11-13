// A 3D asphalt paver, built in code (no downloaded model, no brand markings), rendered live in the browser.
// The page tells it how far the visitor has scrolled (0 to 1): the paver drives forward and lays a mat,
// and the camera swings from the front of the machine round to the fresh asphalt behind it.
// Dragging turns the camera.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function mountPaver(canvas: HTMLCanvasElement, progress: () => number) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const BG = 0x16171a;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 16, 44);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  // fine grain used as surface bump on the ground and the asphalt
  const grain = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!; const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) { const v = 90 + Math.random() * 165; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();

  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xf0a800, roughness: 0.4, metalness: 0.12, clearcoat: 0.55, clearcoatRoughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.55, metalness: 0.35 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.92 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.32, metalness: 0.9 }),
    mix: new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.85, flatShading: true }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff6a00, emissiveIntensity: 2.2 }),
  };

  const paver = new THREE.Group();
  const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => { mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; paver.add(mesh); return mesh; };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, r = 0.05) => add(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), mat), x, y, z);
  const cyl = (r: number, len: number, mat: THREE.Material, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'y') => { const m = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 28), mat), x, y, z); if (axis === 'x') m.rotation.z = Math.PI / 2; if (axis === 'z') m.rotation.x = Math.PI / 2; return m; };

  for (const z of [-0.98, 0.98]) {
    box(3.3, 0.62, 0.42, M.rubber, 0, 0.33, z, 0.24);               // track belt
    box(2.7, 0.3, 0.46, M.dark, 0, 0.34, z, 0.1);                    // track frame
    for (const x of [-1.3, -0.65, 0, 0.65, 1.3]) cyl(0.13, 0.48, M.steel, x, 0.3, z, 'z');
    box(3.3, 0.22, 0.48, M.paint, 0, 0.78, z, 0.07);                 // skirt over the track
    box(2.7, 0.12, 0.08, M.paint, -0.95, 0.66, z * 1.33, 0.03);      // tow arm to the screed
    cyl(0.1, 0.44, M.steel, 3.52, 0.34, z * 0.55, 'z');              // push roller
    const wing = box(1.62, 0.8, 0.1, M.paint, 2.55, 1.12, z * 0.98, 0.04); wing.rotation.x = z > 0 ? 0.32 : -0.32; // hopper wing
    box(0.9, 0.5, 0.06, M.steel, -1.95, 0.3, z * 1.76, 0.02);        // screed end gate
    cyl(0.035, 0.7, M.steel, -2.2, 0.95, z * 1.53);                  // depth crank
    cyl(0.1, 0.03, M.paint, -2.2, 1.31, z * 1.53);
    cyl(0.025, 0.78, M.steel, -1.72, 1.7, z * 0.84); cyl(0.025, 0.95, M.steel, -1.26, 2.08, z * 0.84, 'x');  // deck rails
    cyl(0.04, 1.78, M.dark, -1.6, 2.2, z * 0.82); cyl(0.04, 1.78, M.dark, 0.02, 2.2, z * 0.82);              // canopy posts
    cyl(0.02, 0.62, M.steel, -2.92, 0.86, z * 1.4);                  // walkway rail post
    box(0.92, 0.3, 0.03, M.dark, 0.75, 1.62, z * 0.765, 0.01);       // hood vent
  }
  box(3.5, 0.55, 1.52, M.paint, 0.1, 0.92, 0, 0.09);                 // chassis
  box(1.5, 0.72, 1.5, M.paint, 0.75, 1.55, 0, 0.13);                 // engine hood
  box(0.06, 0.5, 1.1, M.dark, 1.52, 1.55, 0, 0.02);                  // grille
  cyl(0.06, 0.95, M.dark, 1.1, 2.3, 0.45); cyl(0.075, 0.12, M.steel, 1.1, 2.8, 0.45);  // exhaust
  box(1.75, 0.12, 1.72, M.dark, -0.88, 1.26, 0, 0.03);               // operator deck
  box(0.5, 0.12, 0.5, M.rubber, -1.0, 1.62, 0.35, 0.05); box(0.12, 0.55, 0.5, M.rubber, -1.26, 1.92, 0.35, 0.05); box(0.2, 0.3, 0.2, M.dark, -1.0, 1.44, 0.35, 0.03); // seat
  box(0.36, 0.56, 0.95, M.paint, -0.36, 1.6, 0.2, 0.07);             // console
  const wheel = add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 12, 32), M.rubber), -0.6, 1.98, 0.35); wheel.rotation.y = Math.PI / 2; wheel.rotation.z = 0.5;
  cyl(0.025, 1.68, M.steel, -1.72, 2.08, 0, 'z');                    // rear deck rail
  box(2.25, 0.1, 2.02, M.paint, -0.8, 3.13, 0, 0.05);                // canopy roof
  cyl(0.07, 0.11, M.lamp, -0.2, 3.24, 0);                            // beacon
  box(1.62, 0.12, 1.74, M.dark, 2.55, 0.75, 0, 0.03);                // hopper floor
  box(0.1, 0.36, 1.74, M.paint, 3.36, 0.86, 0, 0.04);                // hopper apron
  box(0.1, 0.92, 1.6, M.paint, 1.72, 1.14, 0, 0.04);                 // hopper back wall
  const mound = new THREE.IcosahedronGeometry(1, 3); { const p = mound.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (Math.random() - 0.5) * 0.16; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } mound.computeVertexNormals(); }
  add(new THREE.Mesh(mound, M.mix), 2.5, 0.92, 0).scale.set(0.72, 0.3, 0.74);  // hot mix in the hopper
  box(0.56, 0.4, 3.42, M.dark, -2.2, 0.36, 0, 0.05);                 // screed
  box(0.5, 0.08, 3.3, M.paint, -2.2, 0.6, 0, 0.02);
  cyl(0.14, 3.2, M.steel, -1.82, 0.33, 0, 'z');                      // auger
  box(0.46, 0.05, 3.0, M.steel, -2.72, 0.55, 0, 0.02);               // screed walkway
  cyl(0.02, 2.8, M.steel, -2.92, 1.16, 0, 'z');
  scene.add(paver);

  // the ground (graded base) and the mat of fresh asphalt the screed leaves behind
  const groundBump = grain.clone(); groundBump.repeat.set(70, 70);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x57504a, roughness: 1, envMapIntensity: 0.3, bumpMap: groundBump, bumpScale: 1.6 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const matBump = grain.clone();
  const MAT_START = -60;
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 3.36), new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.82, metalness: 0, envMapIntensity: 0.25, bumpMap: matBump, bumpScale: 1.2 }));
  mat.receiveShadow = true; scene.add(mat);

  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.radius = 5;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x9db8ff, 0.45); scene.add(rim, rim.target);
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x2a2622, 0.35));

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  let yaw = 0, drag: { x: number; yaw: number } | null = null, p = 0, t0 = performance.now(), raf = 0, visible = true, w = 0, h = 0;

  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.006; });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  function frame(now: number) {
    raf = visible ? requestAnimationFrame(frame) : 0;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw !== w || ch !== h) { w = cw; h = ch; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    p += (progress() - p) * 0.12;
    if (!drag) yaw *= 0.94;                                             // ease back after a drag
    const intro = smooth(Math.min(1, (now - t0) / 2200));
    const x = lerp(-2, 7, p) - (1 - intro) * 11;
    paver.position.x = x;
    const back = x - 2.47;                                              // rear edge of the screed
    mat.scale.x = Math.max(0.01, back - MAT_START); mat.position.set((back + MAT_START) / 2, 0.035, 0); matBump.repeat.set(mat.scale.x * 1.4, 4.6);
    const wide = w / h > 1, k = smooth(Math.min(1, p / 0.35));
    const theta = lerp(0.72, 2.5, smooth(p)) + yaw, R = lerp(wide ? 11.5 : 20, wide ? 10.5 : 15, p), H = lerp(3.1, 4.4, p);
    camera.position.set(x + Math.cos(theta) * R, H, Math.sin(theta) * R);
    camera.lookAt(x - lerp(0, 1.2, p), 1.15, 0);
    camera.setViewOffset(w, h, wide ? -lerp(0.2, 0.17, k) * w : 0, wide ? -0.03 * h : lerp(0.33, 0.17, k) * h, w, h);
    sun.position.set(x + 6, 11, 6); sun.target.position.set(x, 0, 0);
    rim.position.set(x - 7, 4, -7); rim.target.position.set(x, 1, 0);
    renderer.render(scene, camera);
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }).observe(canvas);
  raf = requestAnimationFrame(frame);
}
