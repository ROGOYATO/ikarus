// 3D view for "Nasıl uçar?": one fixed camera, the aircraft stays centred while the ground, trees and
// pads slide past. flight.js computes the flight state; update() only draws it. Loaded lazily.
import * as THREE from 'three';
import { buildAircraft, createMaterials, light } from './aircraft3d.js';

const HORIZON = '#0e3a6b'; // fog colour, matches the bottom of the scene's CSS sky
const CLIMB = 1.2; // scene metres between the ground and cruise altitude (illustrative)
const TREES = 46;
const BAND = 90; // length of the tree band that wraps around

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createFlightScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HORIZON, 14, 55);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 120);
  // beside the aircraft, slightly ahead and above: forward flight (-z) reads as left to right
  const eye = new THREE.Vector3(4.4, 1.45, -1.0);
  const look = new THREE.Vector3(0, 0.9, -0.15);
  light(renderer, scene);

  // ground: dark navy with a cream grid; the texture offset carries the motion
  const grid = canvasTexture(256, (g, n) => {
    g.fillStyle = '#123f6e';
    g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(247, 241, 229, 0.22)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, n, n);
  });
  grid.wrapS = grid.wrapT = THREE.RepeatWrapping;
  grid.repeat.set(100, 100); // 4 m cells over 400 m
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grid, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // trees behind the flight line
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(0.45, 1.5, 7), new THREE.MeshStandardMaterial({ color: '#1d4d73', roughness: 0.95 }), TREES);
  const treeAt = Array.from({ length: TREES }, (_, i) => ({ x: -7 - ((i * 37) % 24) - Math.random() * 2, z: (i / TREES) * BAND, s: 0.7 + ((i * 13) % 7) / 10 }));
  scene.add(trees);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();

  // take-off and landing pads
  const padTop = canvasTexture(256, (g, n) => {
    g.fillStyle = '#e8792b';
    g.beginPath();
    g.arc(n / 2, n / 2, n / 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#f7f1e5';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(n / 2, n / 2, n * 0.38, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#f7f1e5';
    g.font = `700 ${n * 0.5}px "Saira Extra Condensed", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('H', n / 2, n / 2 + n * 0.03);
  });
  const padGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.05, 48);
  const padMats = [new THREE.MeshStandardMaterial({ color: '#c75f1c' }), new THREE.MeshStandardMaterial({ map: padTop, transparent: true }), new THREE.MeshStandardMaterial({ color: '#c75f1c' })];
  const pads = [new THREE.Mesh(padGeo, padMats), new THREE.Mesh(padGeo, padMats)];
  pads.forEach((p) => {
    p.rotation.y = Math.PI; // "H" upright as seen from the camera
    p.position.y = 0.025;
    scene.add(p);
  });

  // soft blob shadow under the aircraft
  const blob = canvasTexture(128, (g, n) => {
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(0,0,0,0.85)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, n, n);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.9), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.06;
  scene.add(shadow);

  const mats = createMaterials();
  const { root, props } = buildAircraft(mats);
  const craft = new THREE.Group();
  craft.add(root);
  scene.add(craft);

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // step back on narrow stages so the climb still fits
    camera.position.copy(look).add(eye.clone().sub(look).multiplyScalar(Math.max(1, 1.2 / camera.aspect)));
    camera.lookAt(look);
  };
  new ResizeObserver(resize).observe(container);
  resize();

  let lastT = null;
  let liftRate = 0;
  let pushRate = 0;
  return {
    // s: flight state from flight.js; dist / total: metres flown so far and over the whole flight; t: seconds
    update(s, dist, total, t) {
      const dt = lastT == null ? 0 : Math.min(0.05, Math.max(0, t - lastT));
      lastT = t;
      const airborne = s.alt > 0.02;
      const bob = airborne ? Math.sin(t * 2.2) * (s.lift ? 0.035 : 0.015) : 0;
      craft.position.y = 0.26 + s.alt * CLIMB + bob;
      craft.rotation.x = THREE.MathUtils.degToRad(s.pitch + (airborne ? Math.sin(t * 1.6) * 0.6 : 0));

      // motors spool up and down instead of switching instantly
      const ease = Math.min(1, dt * 2.5);
      liftRate += ((s.lift ? 1 : 0) - liftRate) * ease;
      pushRate += ((s.push ? 1 : 0) - pushRate) * ease;
      props.lift.forEach((p) => {
        p.rotation.y += dt * 28 * liftRate * p.userData.dir;
        p.userData.disc.material.opacity = 0.2 * liftRate;
      });
      props.pusher.rotation.z += dt * 30 * pushRate;
      props.pusher.userData.disc.material.opacity = 0.2 * pushRate;

      // the world moves towards +z as the aircraft flies towards -z
      grid.offset.y = dist / 4;
      pads[0].position.z = dist;
      pads[1].position.z = dist - total;
      treeAt.forEach((tr, i) => {
        const z = ((((tr.z + dist) % BAND) + BAND) % BAND) - BAND + 25;
        m4.compose(new THREE.Vector3(tr.x, 0.9 * tr.s, z), q, new THREE.Vector3(tr.s, tr.s, tr.s));
        trees.setMatrixAt(i, m4);
      });
      trees.instanceMatrix.needsUpdate = true;

      const k = 1 - 0.45 * s.alt;
      shadow.scale.set(k, k, 1);
      shadow.material.opacity = 0.55 * (1 - 0.7 * s.alt);

      renderer.render(scene, camera);
    },
  };
}
