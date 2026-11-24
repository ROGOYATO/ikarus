// Simplified 3D model of the 4+1 VTOL, built from the technical drawing's dimensions (mm), shared by the
// 3D model section and the flight scene. Axes: x = right wing, y = up, z = towards the tail (nose at z = 0).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';


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

export function buildAircraft(mats) {
  const root = new THREE.Group();
  const add = () => {
    const g = new THREE.Group();
    root.add(g);
    return g;
  };

  // wing: chord line about 64 mm above the pod axis, as in the front view
  const sec = naca(0.02, 0.4, 0.12);
  const tip = { le: 343.4, chord: 262.5, y: 70 };
  const rootSt = { x: 0, le: 299.6, chord: 437.5, y: 64 };
  root.add(new THREE.Mesh(loft(sec, [{ x: -1000, ...tip }, rootSt, { x: 1000, ...tip }]), mats.skin));

  // pod: lathe of the top-view outline, a little taller than wide (170 × 180)
  const outline = [[0, 0], [27, 13], [45, 38], [57, 64], [68, 102], [76, 140], [82, 191], [85, 242], [85, 599], [66, 676], [45, 765], [0, 765]];
  const podGeo = new THREE.LatheGeometry(outline.map(([r, z]) => new THREE.Vector2(r, z)), 32);
  podGeo.rotateX(Math.PI / 2);
  const pod = new THREE.Mesh(podGeo, mats.skin);
  pod.scale.set(1, 180 / 170, 1);
  root.add(pod);

  const props = { lift: [], pusher: null };
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'l' : 'r';
    const x = side * 450;
    const boom = cylinder(12.5, 1424.3, 'z', mats.frame);
    boom.position.set(x, 50, (-74.3 + 1350) / 2);
    root.add(boom);

    const lift = add();
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

    const gear = add();
    for (const z of [45.7, 793.7]) {
      gear.add(strut([x, 38, z], [x + side * 40, -260, z], 6, mats.frame));
      gear.add(strut([x + side * 40, -260, z - 50], [x + side * 40, -260, z + 50], 7, mats.frame));
    }
  }

  // inverted V: each panel rises from a boom (y 62) to meet the other above the centreline (y 377)
  const tail = add();
  for (const side of [-1, 1]) {
    const x = side * 450;
    tail.add(panel([[x, 62, 1100], [0, 377, 1160], [0, 377, 1350], [x, 62, 1350]], mats.tail));
  }

  const pusher = add();
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

// Livery: white skin, team-orange tail, carbon booms and gear, dark motors and propellers.
export function createMaterials() {
  const coat = { roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 };
  const disc = () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  return {
    skin: new THREE.MeshPhysicalMaterial({ ...coat, color: '#f1f3f6' }),
    tail: new THREE.MeshPhysicalMaterial({ ...coat, color: '#e8792b' }),
    frame: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1, color: '#22272e' }),
    motor: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.8, color: '#5b636e' }),
    prop: new THREE.MeshStandardMaterial({ roughness: 0.5, color: '#14171c' }),
    disc: disc(),
    disc2: disc(),
  };
}

// Soft studio reflections plus a key light for shape.
export function light(renderer, scene) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, -3);
  scene.add(sun);
  return sun;
}
