// 3D model section: orbit around the aircraft and switch between vertical and forward flight.
// Loaded only when the section nears view.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildAircraft, createMaterials, light } from './aircraft3d.js';

export function initModel() {
  const box = document.querySelector('[data-model]');
  const stage = box.querySelector('[data-stage]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.querySelector('.model-hint').remove();
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  camera.position.set(2.6, 1.5, -2.2);
  light(renderer, scene);
  const mats = createMaterials();
  const { root, props } = buildAircraft(mats);
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

  resize();
}
