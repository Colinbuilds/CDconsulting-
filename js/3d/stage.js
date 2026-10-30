/* Renderer, sky, sun, image-based lighting. One stage per canvas.
   hd: true adds a real HDR sky (lighting + 4K backdrop), ambient occlusion,
   multisampled post-processing and a 4K snapshot. */
import * as THREE from "three";
import { Sky } from "three/addons/Sky.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { setAnisotropy, trackLoad } from "./textures.js";

// Objects on this layer (foliage, grass, sky dome) render normally but are left out of
// the ambient-occlusion pass, whose override material would turn leaf cards into squares.
export const NO_AO = 1;

export function createStage(canvas, { mobile = false, hd = false, dpr } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !hd, powerPreference: "high-performance" });
  const maxDpr = dpr || (hd ? (mobile ? 1.75 : 2) : (mobile ? 1.5 : 1.75));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.62;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  setAnisotropy(Math.min(hd ? 16 : 8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#c9d6e3", 260, 1100);
  const camera = new THREE.PerspectiveCamera(34, 1, 5, 3000); // near at 5 ft keeps depth precise enough for overlapping shingle courses
  camera.layers.enable(NO_AO);

  // procedural sky dome (used for dusk, and for everything when not hd)
  const sky = new Sky();
  sky.scale.setScalar(4000);
  sky.layers.set(NO_AO);
  const u = sky.material.uniforms;
  u.turbidity.value = 3.2; u.rayleigh.value = 2.2; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
  scene.add(sky);

  const sun = new THREE.DirectionalLight("#fff4e2", 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
  const sc = sun.shadow.camera;
  sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 10; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  if (hd) sun.shadow.radius = 3;
  sun.target.position.set(10, 0, 5);
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight("#cfe0ff", "#5d6b45", 0.35);
  scene.add(hemi);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envCache = {};
  const sunDir = new THREE.Vector3();

  /* ---------- procedural sky ---------- */
  function setSun(elevation, azimuth, key) {
    usingPhoto = false;
    sky.visible = true;
    scene.background = null;
    const phi = THREE.MathUtils.degToRad(90 - elevation), theta = THREE.MathUtils.degToRad(azimuth);
    sunDir.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sunDir);
    sun.position.copy(sunDir).multiplyScalar(200).add(sun.target.position);
    const t = THREE.MathUtils.clamp((elevation - 2) / 30, 0, 1);
    sun.color.setRGB(1, 0.72 + 0.24 * t, 0.5 + 0.4 * t);
    sun.intensity = 0.6 + 2.6 * t;
    hemi.intensity = 0.12 + 0.25 * t;
    renderer.toneMappingExposure = (hd ? 0.55 : 0.42) + 0.2 * t;
    scene.fog.color.setRGB(0.55 + 0.24 * t, 0.55 + 0.29 * t, 0.62 + 0.27 * t);
    if (key && !envCache[key]) {
      const envScene = new THREE.Scene();
      const s2 = new Sky(); s2.scale.setScalar(1000);
      Object.keys(u).forEach((k) => s2.material.uniforms[k].value = u[k].value.clone ? u[k].value.clone() : u[k].value);
      envScene.add(s2);
      envCache[key] = pmrem.fromScene(envScene).texture;
    }
    if (key) { scene.environment = envCache[key]; scene.environmentIntensity = 1; }
  }

  /* ---------- real photographed sky (Poly Haven HDRI) ---------- */
  let usingPhoto = false, photo = null;
  const WANT_SUN_AZ = THREE.MathUtils.degToRad(-62); // sun from the front-left, like the procedural sky

  function loadPhotoSky() {
    if (photo) return photo;
    photo = new Promise((resolve, reject) => {
      const done = trackLoad();
      const rgbe = new RGBELoader().setDataType(THREE.FloatType);
      rgbe.load("images/tex/sky.hdr", (hdr) => {
        // find the sun: brightest pixel in the HDR
        const { data, width, height } = hdr.image;
        let best = 0, bx = 0, by = 0;
        for (let y = 0; y < height / 2; y++) for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4, l = data[i] + data[i + 1] + data[i + 2];
          if (l > best) { best = l; bx = x; by = y; }
        }
        const elev = (0.5 - (by + 0.5) / height) * Math.PI;
        const az = ((bx + 0.5) / width - 0.5) * Math.PI * 2; // three's equirect: atan2(z, x)
        // rotate the sky so its sun lands where our lighting design wants it
        const want = Math.atan2(Math.cos(WANT_SUN_AZ), Math.sin(WANT_SUN_AZ)); // our azimuth → atan2(z, x)
        const rot = az - want;
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const env = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        new THREE.TextureLoader().load("images/tex/sky.webp", (bg) => {
          bg.mapping = THREE.EquirectangularReflectionMapping;
          bg.colorSpace = THREE.SRGBColorSpace;
          bg.anisotropy = 16;
          resolve({ env, bg, rot, elev, dir: new THREE.Vector3(Math.cos(want) * Math.cos(elev), Math.sin(elev), Math.sin(want) * Math.cos(elev)) });
          done();
        }, undefined, (e) => { done(); reject(e); });
      }, undefined, (e) => { done(); reject(e); });
    });
    return photo;
  }

  async function usePhotoSky() {
    const p = await loadPhotoSky();
    usingPhoto = true;
    sky.visible = false;
    scene.environment = p.env;
    scene.environmentIntensity = 1;
    scene.background = p.bg;
    scene.backgroundIntensity = 1.6;
    scene.environmentRotation.set(0, p.rot, 0);
    scene.backgroundRotation.set(0, p.rot, 0);
    sun.position.copy(p.dir).multiplyScalar(200).add(sun.target.position);
    sun.color.set("#fff3e0");
    sun.intensity = 3.4;
    hemi.intensity = 0.05;
    renderer.toneMappingExposure = 0.62;
    scene.fog.color.set("#cdd8e6");
  }

  /* evening on the photo sky: dim the sky and the sun, warm the light (t: 0 day → 1 dusk) */
  function setPhotoDusk(t) {
    if (!usingPhoto) return;
    scene.backgroundIntensity = 1.6 * (1 - 0.88 * t);
    scene.environmentIntensity = 1 - 0.8 * t;
    sun.intensity = 3.4 * (1 - 0.9 * t);
    sun.color.setRGB(1, 0.95 - 0.3 * t, 0.88 - 0.45 * t);
    hemi.intensity = 0.05;
    renderer.toneMappingExposure = 0.62 + 0.1 * t;
    scene.fog.color.setRGB(0.8 - 0.62 * t, 0.85 - 0.65 * t, 0.9 - 0.62 * t);
  }

  /* ---------- post-processing (hd) ---------- */
  let composer = null, gtao = null;
  const aoCam = camera.clone();
  if (hd) {
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, aoCam, 2, 2, undefined,
      { radius: 2.4, distanceExponent: 1.6, thickness: 3, scale: 1, samples: mobile ? 8 : 16, distanceFallOff: 1, screenSpaceRadius: false },
      { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: mobile ? 8 : 16 });
    gtao.blendIntensity = 0.75;
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  }

  function render() {
    if (!composer) return renderer.render(scene, camera);
    aoCam.copy(camera);
    aoCam.layers.set(0);
    composer.render();
  }

  /* render a still at 4K (or `width`) regardless of screen size */
  function snapshot(width = 3840, type = "image/jpeg") {
    const w0 = canvas.clientWidth, h0 = canvas.clientHeight, pr = renderer.getPixelRatio();
    const height = Math.round(width * (h0 / w0));
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    if (composer) { composer.setPixelRatio(1); composer.setSize(width, height); }
    render();
    return new Promise((res) => canvas.toBlob((b) => {
      renderer.setPixelRatio(pr);
      resize();
      render();
      res(b);
    }, type, 0.92));
  }

  return { renderer, scene, camera, sun, setSun, usePhotoSky, setPhotoDusk, isPhotoSky: () => usingPhoto, resize, render, snapshot };
}
