// Simplified 3D model of the 4+1 VTOL, built from the technical drawing's dimensions (mm).
// Axes: x = right wing, y = up, z = towards the tail (nose at z = 0). Loaded only when the section nears view.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const PARTS = {
  wing: ['Kanat', '2000 mm açıklık · kök / uç veter 437,5 / 262,5 mm · NACA 2412 · 0,70 m²'],
  pod: ['Gövde podu', '765 mm boy · 170 × 180 mm kesit · elektronik ve batarya burada'],
  booms: ['Bomlar', 'Ø25 mm karbon boru · ~1425 mm · aralık 900 mm; kaldırma motorlarını ve kuyruğu taşır'],
  lift: ['Kaldırma motorları ×4', '15" (Ø381 mm) pervane · ağırlık merkezinin 464 mm önünde ve arkasında'],
  pusher: ['İtici motor', '16×8 (Ø406 mm) pervane · burundan 800 mm, iki bomun arasında'],
  tail: ['Ters V kuyruk', '35° · 2 × 549 mm panel · kök / uç veter 250 / 190 mm · ruddervator'],
  gear: ['İniş takımı', '310 mm yükseklik · itici pervaneyle yer arası 57 mm'],
};
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// NACA 4-digit section as a closed loop (upper TE→LE, lower LE→TE), unit chord.
function naca(m, p, t, n = 24) {
  const up = [];
  const lo = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos((i / n) * Math.PI)) / 2;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x < p ? (m / p ** 2) * (2 * p * x - x * x) : (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
    up.push([x, yc + yt]);
    lo.push([x, yc - yt]);
  }
  return [...up.reverse(), ...lo.slice(1)];
}

// Loft the section through stations {x, le, chord, y}, capping both ends.
function loft(section, stations) {
  const pos = [];
  const idx = [];
  const k = section.length;
  stations.forEach(({ x, le, chord, y }) => section.forEach(([u, v]) => pos.push(x, y + v * chord, le + u * chord)));
  for (let s = 0; s < stations.length - 1; s++) {
    for (let i = 0; i < k - 1; i++) {
      const a = s * k + i;
      const b = a + k;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  [0, stations.length - 1].forEach((s, end) => {
    for (let i = 1; i < k - 2; i++) {
      const tri = [s * k, s * k + i, s * k + i + 1];
      idx.push(...(end ? tri.reverse() : tri));
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function cylinder(r, h, axis, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat);
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  return m;
}

function strut(a, b, r, mat) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 10), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

// Flat four-cornered surface given a little thickness so both faces light correctly.
function panel(corners, mat, t = 5) {
  const [a, b, c] = corners.map((p) => new THREE.Vector3(...p));
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize().multiplyScalar(t / 2);
  const pts = [...corners.map((p) => new THREE.Vector3(...p).add(n)), ...corners.map((p) => new THREE.Vector3(...p).sub(n))];
  const quads = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  const pos = quads.flatMap(([i, j, k, l]) => [i, j, k, i, k, l]).flatMap((i) => pts[i].toArray());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function build(mats) {
  const root = new THREE.Group();
  const add = (key, part) => {
    const g = new THREE.Group();
    g.userData = { part, key };
    root.add(g);
    return g;
  };

  // wing: chord line about 64 mm above the pod axis, as in the front view
  const sec = naca(0.02, 0.4, 0.12);
  const tip = { le: 343.4, chord: 262.5, y: 70 };
  const rootSt = { x: 0, le: 299.6, chord: 437.5, y: 64 };
  add('wing', 'wing').add(new THREE.Mesh(loft(sec, [{ x: -1000, ...tip }, rootSt, { x: 1000, ...tip }]), mats.skin));

  // pod: lathe of the top-view outline, a little taller than wide (170 × 180)
  const outline = [[0, 0], [27, 13], [45, 38], [57, 64], [68, 102], [76, 140], [82, 191], [85, 242], [85, 599], [66, 676], [45, 765], [0, 765]];
  const podGeo = new THREE.LatheGeometry(outline.map(([r, z]) => new THREE.Vector2(r, z)), 32);
  podGeo.rotateX(Math.PI / 2);
  const pod = new THREE.Mesh(podGeo, mats.skin);
  pod.scale.set(1, 180 / 170, 1);
  add('pod', 'pod').add(pod);

  const props = { lift: [], pusher: null };
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'l' : 'r';
    const x = side * 450;
    const boom = cylinder(12.5, 1424.3, 'z', mats.frame);
    boom.position.set(x, 50, (-74.3 + 1350) / 2);
    add(`booms-${s}`, 'booms').add(boom);

    const lift = add(`lift-${s}`, 'lift');
    for (const z of [-44.3, 883.7]) {
      const motor = cylinder(22, 44, 'y', mats.motor);
      motor.position.set(x, 84, z);
      const prop = new THREE.Mesh(new THREE.BoxGeometry(381, 4, 32), mats.prop);
      prop.position.set(x, 112, z);
      prop.rotation.y = side * 0.6 + (z > 0 ? 0.9 : 0);
      prop.userData.dir = side * (z > 0 ? 1 : -1);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(190.5, 40), mats.disc);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 113, z);
      prop.userData.disc = disc;
      lift.add(motor, prop, disc);
      props.lift.push(prop);
    }

    const gear = add(`gear-${s}`, 'gear');
    for (const z of [45.7, 793.7]) {
      gear.add(strut([x, 38, z], [x + side * 40, -260, z], 6, mats.frame));
      gear.add(strut([x + side * 40, -260, z - 50], [x + side * 40, -260, z + 50], 7, mats.frame));
    }
  }

  // inverted V: each panel rises from a boom (y 62) to meet the other above the centreline (y 377)
  const tail = add('tail', 'tail');
  for (const side of [-1, 1]) {
    const x = side * 450;
    tail.add(panel([[x, 62, 1100], [0, 377, 1160], [0, 377, 1350], [x, 62, 1350]], mats.skin));
  }

  const pusher = add('pusher', 'pusher');
  const pm = cylinder(24, 27, 'z', mats.motor);
  pm.position.set(0, 0, 778);
  const pp = new THREE.Mesh(new THREE.BoxGeometry(406, 34, 4), mats.prop);
  pp.position.set(0, 0, 800);
  const pdisc = new THREE.Mesh(new THREE.CircleGeometry(203, 40), mats.disc2);
  pdisc.position.set(0, 0, 801);
  pp.userData.disc = pdisc;
  pusher.add(pm, pp, pdisc);
  props.pusher = pp;

  root.scale.setScalar(0.001);
  root.position.set(0, 0, -0.42); // centre on the target CG (420 mm from the nose)
  return { root, props };
}

export function initModel() {
  const box = document.querySelector('[data-model]');
  const stage = box.querySelector('[data-stage]');
  const tip = box.querySelector('[data-tip]');
  const list = box.querySelector('[data-parts]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.querySelector('.model-hint').remove();
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  camera.position.set(2.6, 1.5, -2.2);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.6);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, -3);
  scene.add(hemi, sun);

  const mats = {
    skin: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    frame: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 }),
    motor: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }),
    prop: new THREE.MeshStandardMaterial({ roughness: 0.5 }),
    disc: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    disc2: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  };
  // fixed deck palette on the navy stage, so the aircraft stands out in both page themes
  const theme = () => {
    mats.skin.color.set('#f2ece0');
    mats.frame.color.set('#c9d3df');
    mats.motor.color.set(css('--accent'));
    mats.prop.color.set('#f7f1e5');
    mats.disc.color.set(css('--accent'));
    mats.disc2.color.set(css('--accent'));
    request();
  };

  const { root, props } = build(mats);
  scene.add(root);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 8;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.8;
  let touched = false;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    touched = true;
  });

  // highlight + tooltip
  const meshes = [];
  root.traverse((o) => o.isMesh && !o.material.transparent && meshes.push(o));
  const partOf = (o) => {
    while (o && !o.userData.part) o = o.parent;
    return o?.userData.part;
  };
  let hot = null;
  const highlight = (part) => {
    if (part === hot) return;
    hot = part;
    meshes.forEach((m) => {
      const on = part && partOf(m) === part;
      if (on && !m.userData.own) {
        m.userData.own = m.material;
        m.material = m.material.clone();
        m.material.emissive = new THREE.Color(css('--accent'));
        m.material.emissiveIntensity = 0.45;
      } else if (!on && m.userData.own) {
        m.material.dispose();
        m.material = m.userData.own;
        m.userData.own = null;
      }
    });
    list.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.part === part));
    request();
  };
  const showTip = (part, x, y) => {
    if (!part) {
      tip.hidden = true;
      return;
    }
    const [name, info] = PARTS[part];
    tip.innerHTML = `<b>${name}</b>${info}`;
    tip.style.left = `${Math.min(x, stage.clientWidth - 270)}px`;
    tip.style.top = `${Math.min(y, stage.clientHeight - 90)}px`;
    tip.hidden = false;
  };
  const ray = new THREE.Raycaster();
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const part = partOf(ray.intersectObjects(meshes, false)[0]?.object);
    highlight(part);
    showTip(part, e.clientX - r.left, e.clientY - r.top);
  };
  renderer.domElement.addEventListener('pointermove', (e) => e.buttons === 0 && pick(e));
  renderer.domElement.addEventListener('pointerdown', (e) => e.pointerType !== 'mouse' && pick(e));
  renderer.domElement.addEventListener('pointerleave', () => {
    highlight(null);
    showTip(null);
  });

  list.innerHTML = Object.entries(PARTS).map(([k, [name]]) => `<li><button type="button" data-part="${k}">${name}</button></li>`).join('');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const part = hot === b.dataset.part ? null : b.dataset.part;
    highlight(part);
    showTip(part, 12, 12);
  });

  // flight mode
  let mode = 'vtol';
  box.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    box.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    request();
  }));
  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // keep the whole aircraft in frame on narrow (portrait) stages
    if (!touched) camera.position.setLength(3.7 * Math.max(1, 1.15 / camera.aspect));
    request();
  };
  new ResizeObserver(resize).observe(stage);

  // render loop runs only while the model is on screen
  let visible = false;
  let raf = 0;
  let last = 0;
  function request() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }
  function frame(t) {
    raf = 0;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    const spin = reduced ? 0 : dt * 40;
    props.lift.forEach((p) => {
      if (mode === 'vtol') p.rotation.y += spin * p.userData.dir;
      p.userData.disc.material.opacity = mode === 'vtol' && !reduced ? 0.18 : 0;
    });
    if (mode === 'cruise') props.pusher.rotation.z += spin;
    props.pusher.userData.disc.material.opacity = mode === 'cruise' && !reduced ? 0.18 : 0;
    controls.update();
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    last = 0;
    request();
  }).observe(stage);

  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);
  theme();
  resize();
}
