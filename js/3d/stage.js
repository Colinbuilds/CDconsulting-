/* Renderer, sky, sun, image-based lighting. One stage per canvas. */
import * as THREE from "three";
import { Sky } from "three/addons/Sky.js";
import { setAnisotropy } from "./textures.js";

export function createStage(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.62;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#c9d6e3", 260, 1100);
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 3000);

  // sky dome + matching environment light
  const sky = new Sky();
  sky.scale.setScalar(4000);
  const u = sky.material.uniforms;
  u.turbidity.value = 3.2; u.rayleigh.value = 2.2; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
  scene.add(sky);

  const sun = new THREE.DirectionalLight("#fff4e2", 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
  const sc = sun.shadow.camera;
  sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 10; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  sun.target.position.set(10, 0, 5);
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight("#cfe0ff", "#5d6b45", 0.35);
  scene.add(hemi);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envCache = {};
  const sunDir = new THREE.Vector3();

  function setSun(elevation, azimuth, key) {
    const phi = THREE.MathUtils.degToRad(90 - elevation), theta = THREE.MathUtils.degToRad(azimuth);
    sunDir.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sunDir);
    sun.position.copy(sunDir).multiplyScalar(200).add(sun.target.position);
    // warm + dim as the sun drops
    const t = THREE.MathUtils.clamp((elevation - 2) / 30, 0, 1);
    sun.color.setRGB(1, 0.72 + 0.24 * t, 0.5 + 0.4 * t);
    sun.intensity = 0.6 + 2.6 * t;
    hemi.intensity = 0.12 + 0.25 * t;
    renderer.toneMappingExposure = 0.42 + 0.2 * t;
    scene.fog.color.setRGB(0.55 + 0.24 * t, 0.55 + 0.29 * t, 0.62 + 0.27 * t);
    if (key && !envCache[key]) {
      const envScene = new THREE.Scene();
      const s2 = new Sky(); s2.scale.setScalar(1000);
      Object.keys(u).forEach((k) => s2.material.uniforms[k].value = u[k].value.clone ? u[k].value.clone() : u[k].value);
      envScene.add(s2);
      envCache[key] = pmrem.fromScene(envScene).texture;
    }
    if (key) scene.environment = envCache[key];
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const render = () => renderer.render(scene, camera);
  return { renderer, scene, camera, sun, setSun, resize, render };
}
